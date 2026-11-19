import { z } from "zod";

import { isInstagramPublishDryRun } from "../../../../../lib/instagram/config";
import { advancePost } from "../../../../../lib/instagram/publisher";
import { createPublisherDeps } from "../../../../../lib/instagram/runtime";
import {
  canPublishNow,
  createSocialPostRepository,
  getVideoAvailableUntil,
  socialPostActionSchema,
  toPublicSocialPost,
  updateSocialPostSchema,
  validateSchedule,
  planEdit,
  planRetry,
  PUBLISH_REQUESTED_CONFIRMATION,
  type SocialPostRow,
} from "../../../../../lib/social-posts";
import type { SupabaseServiceConfig } from "../../../../../lib/supabase";
import { getGoogleAccessToken, getRenderJob, getVideoRenderConfig, signStorageUrl } from "../../../../../lib/video-render";
import { authorizeVideoAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const maxDuration = 60;

const paramsSchema = z.object({ id: z.string().uuid() });

const CLEARED_CONTAINER = { ig_container_id: null, ig_container_created_at: null, publish_requested_at: null };

const present = async (supabase: SupabaseServiceConfig, post: SocialPostRow) => {
  const job = post.video_job_id ? await getRenderJob(supabase, post.video_job_id) : null;
  return {
    job,
    post: toPublicSocialPost(post, {
      raceTitle: job?.race_title ?? null,
      videoAvailableUntil: job?.finished_at ? getVideoAvailableUntil(job.finished_at).toISOString() : null,
    }),
  };
};

const needsConfirmation = () => renderJson({ message: PUBLISH_REQUESTED_CONFIRMATION, needsConfirmation: true }, 409);

const conflict = (message = "La publication a changé entre-temps : recharge la page.") => renderJsonError(message, 409);

/** One post with a 1-hour signed preview of its video. */
export async function GET(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Publication invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;

  try {
    const row = await createSocialPostRepository(supabase).get(params.data.id);
    if (!row) return renderJsonError("Publication introuvable.", 404);
    const { job, post } = await present(supabase, row);
    const config = getVideoRenderConfig();
    let previewUrl: string | null = null;
    let previewMessage: string | null = null;
    if (!job || job.status !== "done" || !row.video_url) previewMessage = "Vidéo supprimée.";
    else if (!config) previewMessage = "Aperçu indisponible : stockage vidéo non configuré.";
    else {
      try {
        previewUrl = await signStorageUrl({
          config,
          accessToken: await getGoogleAccessToken(config, request),
          method: "GET",
          objectName: row.video_url,
          expiresSeconds: 60 * 60,
        });
      } catch (error) {
        previewMessage = describeRenderError(error, "Aperçu indisponible.");
      }
    }
    return renderJson({ post, previewUrl, previewMessage });
  } catch (error) {
    console.error("Social post read failed", error instanceof Error ? error.message : error);
    return renderJsonError("La publication n’a pas pu être lue.", 502);
  }
}

/** Edits the caption of a draft (or of a failed post, whose container is then dropped). */
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Publication invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;

  const parsed = updateSocialPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError(parsed.error.issues[0]?.message ?? "Texte invalide.", 400);

  try {
    const posts = createSocialPostRepository(supabase);
    const current = await posts.get(params.data.id);
    if (!current) return renderJsonError("Publication introuvable.", 404);
    if (current.status !== "draft" && current.status !== "failed") {
      return conflict("Seul un brouillon (ou une publication en échec) peut être modifié : annule d’abord la programmation.");
    }
    const plan = planEdit(current, parsed.data.confirmRestart);
    if (plan.kind === "needs_confirmation") return needsConfirmation();
    const updated = await posts.update(current.id, {
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags,
      cover_text: parsed.data.coverText || null,
      ...(plan.dropContainer ? CLEARED_CONTAINER : {}),
    }, `status=eq.${current.status}&ig_media_id=is.null`);
    if (!updated) return conflict();
    return renderJson({ post: (await present(supabase, updated)).post });
  } catch (error) {
    console.error("Social post update failed", error instanceof Error ? error.message : error);
    return renderJsonError("La publication n’a pas pu être enregistrée.", 502);
  }
}

/** publish_now | schedule | unschedule | retry | advance (one step of an in-flight publication). */
export async function POST(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Publication invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;

  const parsed = socialPostActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Action invalide.", 400);
  const action = parsed.data;

  try {
    const posts = createSocialPostRepository(supabase);
    const current = await posts.get(params.data.id);
    if (!current) return renderJsonError("Publication introuvable.", 404);
    const job = current.video_job_id ? await getRenderJob(supabase, current.video_job_id) : null;
    const now = new Date();
    const dryRun = isInstagramPublishDryRun();
    let updated: SocialPostRow | null = null;

    const runStep = async (row: SocialPostRow) => {
      // A simulation completes at once; a live post continues with the cron or the page polling.
      const result = await advancePost(row.id, row.dry_run, createPublisherDeps(supabase, request));
      return result?.post ?? (await posts.get(row.id)) ?? row;
    };

    if (action.action === "publish_now") {
      if (current.status !== "draft" && current.status !== "scheduled") return conflict("Cette publication n’est plus un brouillon.");
      if (!job || job.status !== "done" || !canPublishNow(job.finished_at, now)) return conflict("La vidéo n’est plus disponible : relance un rendu.");
      updated = await posts.update(current.id, {
        status: "publishing",
        scheduled_at: now.toISOString(),
        dry_run: dryRun,
        attempt_count: 0,
        error: null,
        locked_until: null,
      }, "status=in.(draft,scheduled)");
      if (!updated) return conflict();
      updated = await runStep(updated);
    } else if (action.action === "schedule") {
      if (current.status !== "draft") return conflict("Seul un brouillon peut être programmé.");
      const check = validateSchedule({ local: action.scheduledAtLocal, finishedAt: job?.status === "done" ? job.finished_at : null, now });
      if (!check.ok) return renderJsonError(check.message, 400);
      updated = await posts.update(current.id, {
        status: "scheduled",
        scheduled_at: check.scheduledAt.toISOString(),
        dry_run: dryRun,
        error: null,
      }, "status=eq.draft");
      if (!updated) return conflict();
    } else if (action.action === "unschedule") {
      updated = await posts.update(current.id, { status: "draft", scheduled_at: null }, "status=eq.scheduled");
      if (!updated) return conflict("Cette publication n’est plus programmée.");
    } else if (action.action === "retry") {
      if (current.status !== "failed") return conflict("Seule une publication en échec peut être relancée.");
      const plan = planRetry(current, dryRun, action.confirmRestart);
      if (plan.kind === "needs_confirmation") return needsConfirmation();
      const restart = plan.dropContainer;
      if (!current.ig_container_id || restart) {
        if (!job || job.status !== "done" || !canPublishNow(job.finished_at, now)) return conflict("La vidéo n’est plus disponible : relance un rendu.");
      }
      updated = await posts.update(current.id, {
        status: "publishing",
        scheduled_at: now.toISOString(),
        dry_run: dryRun,
        attempt_count: 0,
        error: null,
        locked_until: null,
        ...(restart ? CLEARED_CONTAINER : {}),
      }, "status=eq.failed&ig_media_id=is.null");
      if (!updated) return conflict();
      updated = await runStep(updated);
    } else {
      updated = current.status === "publishing" ? await runStep(current) : current;
    }

    return renderJson({ post: (await present(supabase, updated)).post });
  } catch (error) {
    console.error("Social post action failed", action.action, error instanceof Error ? error.message : error);
    return renderJsonError("L’action n’a pas pu aboutir.", 502);
  }
}

/** Deletes a draft or a failed post; published history is kept. */
export async function DELETE(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Publication invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const deleted = await createSocialPostRepository(gate.value.supabase).remove(params.data.id, "status=in.(draft,failed)&ig_media_id=is.null");
    if (!deleted) return conflict("Seul un brouillon ou une publication en échec peut être supprimé.");
    return renderJson({ deleted: true });
  } catch (error) {
    console.error("Social post deletion failed", error instanceof Error ? error.message : error);
    return renderJsonError("La publication n’a pas pu être supprimée.", 502);
  }
}

import { withAdminAudit, auditBody, pickAuditFields } from "../../../../../lib/admin-audit-log";
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
  scheduleSocialPostDraft,
  planEdit,
  planRetry,
  PUBLISH_REQUESTED_CONFIRMATION,
  type SocialPostRow,
} from "../../../../../lib/social-posts";
import { getPostMedia } from "../../../../../lib/social-post-media";
import type { SupabaseServiceConfig } from "../../../../../lib/supabase";
import { getGoogleAccessToken, getVideoRenderConfig, signStorageUrl } from "../../../../../lib/video-render";
import { authorizeVideoAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const maxDuration = 60;

const paramsSchema = z.object({ id: z.string().uuid() });

const CLEARED_CONTAINER = { ig_container_id: null, ig_container_created_at: null, publish_requested_at: null, ig_child_container_ids: [] as string[] };

const present = async (supabase: SupabaseServiceConfig, post: SocialPostRow) => {
  // The reel's video render or the carousel's slide render: same lifetime rules.
  const job = await getPostMedia(supabase, post);
  return {
    job,
    post: toPublicSocialPost(post, {
      raceTitle: job?.title ?? null,
      videoAvailableUntil: job?.finished_at ? getVideoAvailableUntil(job.finished_at).toISOString() : null,
    }),
  };
};

const needsConfirmation = () => renderJson({ message: PUBLISH_REQUESTED_CONFIRMATION, needsConfirmation: true }, 409);

const conflict = (message = "La publication a changé entre-temps : recharge la page.") => renderJsonError(message, 409);

/** One post with a 1-hour signed preview of its video, or of each carousel slide in order. */
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
    let previewImages: string[] = [];
    let previewMessage: string | null = null;
    const objects = row.media_type === "carousel" ? row.image_paths ?? [] : row.video_url ? [row.video_url] : [];
    if (!job || job.status !== "done" || !objects.length) previewMessage = row.media_type === "carousel" ? "Images supprimées." : "Vidéo supprimée.";
    else if (!config) previewMessage = "Aperçu indisponible : stockage vidéo non configuré.";
    else {
      try {
        const accessToken = await getGoogleAccessToken(config, request);
        const urls = await Promise.all(objects.map((objectName) => signStorageUrl({ config, accessToken, method: "GET", objectName, expiresSeconds: 60 * 60 })));
        if (row.media_type === "carousel") previewImages = urls;
        else previewUrl = urls[0];
      } catch (error) {
        previewMessage = describeRenderError(error, "Aperçu indisponible.");
      }
    }
    return renderJson({ post, previewUrl, previewImages, previewMessage });
  } catch (error) {
    console.error("Social post read failed", error instanceof Error ? error.message : error);
    return renderJsonError("La publication n’a pas pu être lue.", 502);
  }
}

/** Edits the caption of a draft (or of a failed post, whose container is then dropped). */
async function patchRoute(request: Request, context: { params: { id: string } }) {
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
async function postRoute(request: Request, context: { params: { id: string } }) {
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
    const job = await getPostMedia(supabase, current);
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
      if (!job || job.status !== "done" || !canPublishNow(job.finished_at, now)) return conflict(current.media_type === "carousel" ? "Les images ne sont plus disponibles : relance un rendu." : "La vidéo n’est plus disponible : relance un rendu.");
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
      const scheduled = await scheduleSocialPostDraft({
        posts,
        post: current,
        finishedAt: job?.status === "done" ? job.finished_at : null,
        local: action.scheduledAtLocal,
        now,
        dryRun,
      });
      if (!scheduled.ok) return scheduled.conflict ? conflict(scheduled.message ?? undefined) : renderJsonError(scheduled.message ?? "Programmation invalide.", 400);
      updated = scheduled.post;
    } else if (action.action === "unschedule") {
      updated = await posts.update(current.id, { status: "draft", scheduled_at: null }, "status=eq.scheduled");
      if (!updated) return conflict("Cette publication n’est plus programmée.");
    } else if (action.action === "retry") {
      if (current.status !== "failed") return conflict("Seule une publication en échec peut être relancée.");
      const plan = planRetry(current, dryRun, action.confirmRestart);
      if (plan.kind === "needs_confirmation") return needsConfirmation();
      const restart = plan.dropContainer;
      if (!current.ig_container_id || restart) {
        if (!job || job.status !== "done" || !canPublishNow(job.finished_at, now)) return conflict(current.media_type === "carousel" ? "Les images ne sont plus disponibles : relance un rendu." : "La vidéo n’est plus disponible : relance un rendu.");
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
async function deleteRoute(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Publication invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    // A draft or a failed post that never reached Instagram, or a published one: only removed from this
    // list (the API cannot delete an Instagram post). Scheduled and in-flight posts must be stopped first.
    const deleted = await createSocialPostRepository(gate.value.supabase).remove(
      params.data.id,
      "or=(and(status.in.(draft,failed),ig_media_id.is.null),status.eq.published)",
    );
    if (!deleted) return conflict("Annule d’abord la programmation : une publication programmée ou en cours ne peut pas être supprimée.");
    return renderJson({ deleted: true });
  } catch (error) {
    console.error("Social post deletion failed", error instanceof Error ? error.message : error);
    return renderJsonError("La publication n’a pas pu être supprimée.", 502);
  }
}

export const PATCH = withAdminAudit(patchRoute, {
  action: "content.post-update",
  targetType: "post",
  targetId: (c) => c.params.id,
  summary: "Publication modifiée",
});

export const POST = withAdminAudit(postRoute, {
  action: (c) => (auditBody(c).action === "schedule" || auditBody(c).action === "unschedule" ? "content.post-schedule" : "content.post-publish"),
  targetType: "post",
  targetId: (c) => c.params.id,
  skip: (c) => auditBody(c).action === "advance",
  summary: (c) =>
    ({
      publish_now: "Publication immédiate lancée",
      schedule: `Publication programmée (${auditBody(c).scheduledAtLocal ?? "?"})`,
      unschedule: "Programmation annulée",
      retry: "Publication relancée après un échec",
    } as Record<string, string>)[String(auditBody(c).action)] ?? "Publication modifiée",
  after: (c) => pickAuditFields(c.body, ["action", "scheduledAtLocal", "confirmRestart"]),
});

export const DELETE = withAdminAudit(deleteRoute, {
  action: "content.post-delete",
  targetType: "post",
  targetId: (c) => c.params.id,
  summary: "Publication supprimée",
  after: () => null,
});

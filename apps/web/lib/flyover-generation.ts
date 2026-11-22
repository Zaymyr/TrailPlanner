import { buildReelSettings, freshClipsFor, hasGpxElevations, isReadyDetail, type ReadyDetail } from "../app/admin/video-generator/reel-composition";
import { pickPoolVoice } from "../app/admin/video-generator/voice-pool";
import {
  applyFlyoverSettings,
  buildFlyoverDetail,
  buildFlyoverOrderUrl,
  buildFlyoverPaidEmail,
  buildFlyoverReadyEmail,
  buildFlyoverTeamAlertEmail,
  createFlyoverOrderRepository,
  FLYOVER_MAX_ATTEMPTS,
  flyoverNotifyEmail,
  getFlyoverMode,
  withCollabMention,
  type FlyoverOrderRepository,
  type FlyoverOrderRow,
} from "./flyover-orders";
import { parseGpx } from "./gpx/parseGpx";
import { isInstagramPublishDryRun } from "./instagram/config";
import { launchReelRender, readWork, synthesizeReelClips, writeReelWork } from "./reel-generation";
import { sendTransactionalEmail } from "./resend";
import { buildSocialPostDraftRow } from "./social-post-auto-draft";
import { buildDraftPrefill } from "./reel-content";
import { createSocialPostRepository, scheduleSocialPostDraft, type SocialPostRepository } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";
import { getRenderJob, isRenderJobStale, type VideoRenderJobRow } from "./video-render";
import { listPoolVoices } from "./video-voices";

/**
 * Executor of the organizer flyover orders, called by /api/cron/flyover-orders every 10 minutes:
 * follows the renders in flight, then runs one step of one paid order (text, then voice + render).
 * Same building blocks as the automatic reels (lib/reel-generation.ts), with the order's own GPX.
 */

const LEASE_MS = 10 * 60 * 1_000;

export type FlyoverEmail = { to: string; subject: string; html: string; text: string; idempotencyKey: string; replyTo?: string };

export type FlyoverDeps = {
  now: () => Date;
  orders: FlyoverOrderRepository;
  /** Text step: the reel work (settings, place names, text) of the order. */
  writeContent: (order: FlyoverOrderRow) => Promise<Record<string, unknown>>;
  /** Voice + render step: the id of the started render job. */
  startRender: (order: FlyoverOrderRow) => Promise<string>;
  getRenderJob: (id: string) => Promise<Pick<VideoRenderJobRow, "id" | "status" | "message" | "created_at" | "updated_at" | "finished_at" | "content"> | null>;
  /** Collab: the Instagram draft of the finished render, scheduled at the order's slot. */
  publishCollab: (order: FlyoverOrderRow, job: Pick<VideoRenderJobRow, "id" | "race_id" | "content" | "finished_at">) => Promise<{ postId: string | null; scheduled: boolean; message: string | null }>;
  sendEmail: (email: FlyoverEmail) => Promise<boolean>;
  orderUrl: (orderId: string) => string;
};

export type FlyoverTickResult = { followed: number; finished: string[]; failed: string[]; step: { orderId: string; from: string; to: string } | null };

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback).slice(0, 1_000);

/** A failed step: retried at the next tick, until FLYOVER_MAX_ATTEMPTS; then failed and the team is told. */
const recordFailure = async (deps: FlyoverDeps, order: FlyoverOrderRow, message: string, retryStatus: "paid" | "scripted") => {
  const attempts = order.attempts + 1;
  const failed = attempts >= FLYOVER_MAX_ATTEMPTS;
  await deps.orders.update(order.id, {
    status: failed ? "failed" : retryStatus,
    attempts,
    error: message,
    locked_until: null,
  });
  if (failed) {
    await deps.sendEmail({
      to: flyoverNotifyEmail(),
      ...buildFlyoverTeamAlertEmail(order, `Échec après ${attempts} tentatives : ${message}`),
      idempotencyKey: `flyover/failed/${order.id}`,
    }).catch(() => false);
  }
  return failed;
};

const finishOrder = async (deps: FlyoverDeps, order: FlyoverOrderRow, job: NonNullable<Awaited<ReturnType<FlyoverDeps["getRenderJob"]>>>) => {
  let scheduled = false;
  let postId: string | null = order.social_post_id;
  if (order.offer === "collab") {
    const result = await deps.publishCollab(order, { id: job.id, race_id: null, content: job.content, finished_at: job.finished_at });
    scheduled = result.scheduled;
    postId = result.postId ?? postId;
    if (!scheduled) {
      await deps.sendEmail({
        to: flyoverNotifyEmail(),
        ...buildFlyoverTeamAlertEmail(order, `Vidéo prête mais programmation Instagram impossible : ${result.message ?? "raison inconnue"}. Le brouillon est dans Publications.`),
        idempotencyKey: `flyover/schedule-failed/${order.id}`,
      }).catch(() => false);
    }
  }
  const now = deps.now().toISOString();
  const updated = await deps.orders.update(order.id, {
    status: "ready",
    ready_at: now,
    social_post_id: postId,
    error: order.offer === "collab" && !scheduled ? "Programmation Instagram à faire à la main." : null,
    locked_until: null,
  }, "status=eq.rendering");
  if (!updated) return false;
  await sendReadyEmail(deps, updated);
  return true;
};

/** The organizer email once the video is ready (scheduled on Instagram, or downloadable). */
const sendReadyEmail = async (deps: FlyoverDeps, order: FlyoverOrderRow) => {
  if (order.ready_email_sent_at) return;
  const scheduled = order.offer === "collab" && !order.error;
  const sent = await deps.sendEmail({
    to: order.contact_email,
    ...buildFlyoverReadyEmail(order, deps.orderUrl(order.id), scheduled),
    replyTo: flyoverNotifyEmail(),
    idempotencyKey: `flyover/ready/${order.id}`,
  }).catch(() => false);
  if (sent) await deps.orders.update(order.id, { ready_email_sent_at: deps.now().toISOString() });
};

export const runFlyoverTick = async (deps: FlyoverDeps): Promise<FlyoverTickResult> => {
  const result: FlyoverTickResult = { followed: 0, finished: [], failed: [], step: null };
  const now = deps.now();

  // 1. Renders in flight.
  for (const order of await deps.orders.listByStatus(["rendering"], 20)) {
    result.followed += 1;
    const job = order.render_job_id ? await deps.getRenderJob(order.render_job_id) : null;
    if (job?.status === "done") {
      if (await finishOrder(deps, order, job)) result.finished.push(order.id);
      continue;
    }
    if (!job || job.status === "failed" || isRenderJobStale(job, now.getTime())) {
      const failed = await recordFailure(deps, order, `Rendu échoué : ${job?.message ?? "rendu introuvable ou silencieux"}`, "scripted");
      if (failed) result.failed.push(order.id);
    }
  }

  // Ready emails that failed to go out.
  for (const order of await deps.orders.listReadyWithoutEmail(10)) await sendReadyEmail(deps, order);

  // 2. One step of the oldest paid order whose lease is free.
  const nowMs = now.getTime();
  const due = (await deps.orders.listByStatus(["paid", "scripted"], 10))
    .find((order) => !order.locked_until || Date.parse(order.locked_until) < nowMs);
  if (!due) return result;
  const claimed = await deps.orders.update(
    due.id,
    { locked_until: new Date(nowMs + LEASE_MS).toISOString() },
    `status=eq.${due.status}&or=(locked_until.is.null,locked_until.lt.${encodeURIComponent(now.toISOString())})`,
  );
  if (!claimed) return result;

  if (claimed.status === "paid") {
    try {
      const work = await deps.writeContent(claimed);
      await deps.orders.update(claimed.id, { status: "scripted", work, attempts: 0, error: null, locked_until: null }, "status=eq.paid");
      result.step = { orderId: claimed.id, from: "paid", to: "scripted" };
    } catch (error) {
      if (await recordFailure(deps, claimed, errorMessage(error, "La rédaction a échoué."), "paid")) result.failed.push(claimed.id);
      result.step = { orderId: claimed.id, from: "paid", to: "error" };
    }
    return result;
  }

  try {
    const jobId = await deps.startRender(claimed);
    await deps.orders.update(claimed.id, { status: "rendering", render_job_id: jobId, error: null, locked_until: null }, "status=eq.scripted");
    result.step = { orderId: claimed.id, from: "scripted", to: "rendering" };
  } catch (error) {
    if (await recordFailure(deps, claimed, errorMessage(error, "Le rendu n’a pas pu démarrer."), "scripted")) result.failed.push(claimed.id);
    result.step = { orderId: claimed.id, from: "scripted", to: "error" };
  }
  return result;
};

// ---------------------------------------------------------------------------------------------
// Real services

const serviceHeaders = (supabase: SupabaseServiceConfig) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
});

/** The order's GPX (private race-gpx bucket) as the detail the reel steps read. */
export const loadFlyoverDetail = async (supabase: SupabaseServiceConfig, order: FlyoverOrderRow): Promise<ReadyDetail> => {
  const response = await fetch(`${supabase.supabaseUrl}/storage/v1/object/race-gpx/${order.gpx_storage_path}`, { headers: serviceHeaders(supabase), cache: "no-store" });
  if (!response.ok) throw new Error(`GPX de la commande illisible (${response.status}).`);
  const detail = buildFlyoverDetail(order, parseGpx(await response.text()));
  if (!isReadyDetail(detail) || !hasGpxElevations(detail)) throw new Error("GPX sans altitudes.");
  return detail;
};

/** The order's mode (its choice, else the distance rule for older orders), basemap and relief. */
export const getFlyoverSettings = (order: FlyoverOrderRow) =>
  applyFlyoverSettings(buildReelSettings(order.story_mode ?? getFlyoverMode(order.distance_km)), order);

export const createFlyoverDeps = (supabase: SupabaseServiceConfig, request: Request): FlyoverDeps => {
  const posts: SocialPostRepository = createSocialPostRepository(supabase);
  return {
    now: () => new Date(),
    orders: createFlyoverOrderRepository(supabase),
    writeContent: async (order) => {
      const detail = await loadFlyoverDetail(supabase, order);
      const work = await writeReelWork(detail, getFlyoverSettings(order));
      const content = order.offer === "collab"
        ? { ...work.content, caption: withCollabMention(work.content.caption, order.instagram_handle) }
        : work.content;
      return { ...work, content } as unknown as Record<string, unknown>;
    },
    startRender: async (order) => {
      const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY absent : la voix off n’est pas configurée.");
      if (!order.work) throw new Error("Texte de la vidéo absent : relance depuis le texte.");
      const work = readWork(order.work);
      const detail = await loadFlyoverDetail(supabase, order);
      const pool = await listPoolVoices(supabase);
      const voice = pickPoolVoice(pool.filter((entry) => entry.active), null);
      const { written, clips } = await synthesizeReelClips({ detail, work, voiceId: voice?.voiceId ?? null, apiKey });
      return launchReelRender({
        supabase,
        request,
        detail,
        work,
        clips: freshClipsFor(written, clips),
        // No automatic draft from the completion route: the collab draft is made here, with its collaborator.
        job: { flyover_order_id: order.id, race_title: order.race_name, created_by: null, content: work.content, auto_draft: false },
      });
    },
    getRenderJob: (id) => getRenderJob(supabase, id),
    publishCollab: async (order, job) => {
      const handle = order.instagram_handle;
      let post = await posts.findAutoDraft(job.id);
      if (!post) {
        const prefill = buildDraftPrefill(order.race_name, job.content);
        try {
          post = await posts.insert({
            ...buildSocialPostDraftRow({
              job,
              caption: withCollabMention(prefill.caption, handle),
              hashtags: prefill.hashtags,
              coverText: prefill.coverText,
              createdBy: null,
              autoGenerated: true,
            }),
            collaborators: handle ? [handle] : [],
          });
        } catch (error) {
          post = await posts.findAutoDraft(job.id).catch(() => null);
          if (!post) throw error;
        }
      }
      if (post.status !== "draft") return { postId: post.id, scheduled: post.status === "scheduled" || post.status === "published", message: null };
      if (!order.publish_local) return { postId: post.id, scheduled: false, message: "Date de publication absente." };
      const scheduled = await scheduleSocialPostDraft({
        posts,
        post,
        finishedAt: job.finished_at,
        local: order.publish_local,
        dryRun: isInstagramPublishDryRun(),
      });
      return scheduled.ok
        ? { postId: post.id, scheduled: true, message: null }
        : { postId: post.id, scheduled: false, message: scheduled.message };
    },
    sendEmail: async ({ idempotencyKey, ...email }) => {
      const sent = await sendTransactionalEmail({ ...email, idempotencyKey });
      if (sent.status !== "sent") console.warn(`Flyover email ${idempotencyKey} not sent: ${sent.status}`);
      return sent.status === "sent";
    },
    orderUrl: (orderId) => buildFlyoverOrderUrl(orderId),
  };
};

/** The confirmation email after payment (webhook), at most once per order. */
export const sendFlyoverPaidEmail = async (supabase: SupabaseServiceConfig, order: FlyoverOrderRow) => {
  if (order.paid_email_sent_at) return;
  const sent = await sendTransactionalEmail({
    to: order.contact_email,
    ...buildFlyoverPaidEmail(order, buildFlyoverOrderUrl(order.id)),
    replyTo: flyoverNotifyEmail(),
    idempotencyKey: `flyover/paid/${order.id}`,
  });
  if (sent.status === "sent") {
    await createFlyoverOrderRepository(supabase).update(order.id, { paid_email_sent_at: new Date().toISOString() }).catch(() => null);
  }
};

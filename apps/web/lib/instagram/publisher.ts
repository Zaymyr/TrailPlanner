import {
  buildFullCaption,
  canPublishNow,
  type SocialPostRepository,
  type SocialPostRow,
} from "../social-posts";
import { InstagramGraphError, isDryRunId, type InstagramGraphClient } from "./graph";

/**
 * Resumable publishing state machine of one `publishing` post, advanced one step per call:
 *
 *   no container  -> create the REELS container, store ig_container_id at once
 *   container     -> poll status_code (at most once a minute)
 *     IN_PROGRESS -> wait
 *     FINISHED    -> mark publish_requested_at, media_publish, store ig_media_id at once
 *     PUBLISHED   -> already published by an interrupted step: recover the media, never publish again
 *     ERROR/EXPIRED -> failed (the container is dropped so a retry creates a new one)
 *   publish_requested_at set, no ig_media_id -> the container status decides first, before any
 *     deadline or expiry rule: PUBLISHED recovers the media (or asks for a manual check),
 *     FINISHED publishes, ERROR/EXPIRED fails keeping every id; never a new container
 *   ig_media_id   -> fetch the permalink, mark published
 *
 * The caller holds the post lease (`locked_until`), so two workers never run the same step.
 * media_publish is only called on a FINISHED container with no ig_media_id: Meta refuses to
 * publish a container twice, so a crash between the call and the write cannot double-post.
 */

export const CLAIM_LEASE_MS = 90_000;
/** Meta suggests checking a container about once a minute. */
export const POLL_INTERVAL_MS = 60_000;
export const RATE_LIMIT_BACKOFF_MS = 15 * 60_000;
export const QUOTA_BACKOFF_MS = 30 * 60_000;
export const TRANSIENT_BACKOFF_MS = 2 * 60_000;
export const MAX_TRANSIENT_ATTEMPTS = 8;
/** Containers expire after 24 h; a publication never lasts longer. */
export const CONTAINER_LIFETIME_MS = 24 * 60 * 60_000;
export const PUBLISHING_DEADLINE_MS = 24 * 60 * 60_000;

/** Tolerance between our clock and Instagram's media timestamps when recovering a lost media id. */
export const RECOVERY_CLOCK_SKEW_MS = 5 * 60_000;
export const MANUAL_CHECK_NOTE =
  "Publiée sur Instagram, mais le média n’a pas pu être identifié : vérifie la publication sur le compte (lien indisponible).";

export type PublishingAccount = { id: string; igUserId: string; accessToken: string };

export type PublisherDeps = {
  posts: SocialPostRepository;
  now: () => Date;
  /** Real client for a live post, simulated client for a dry-run post. */
  graphFor: (dryRun: boolean) => InstagramGraphClient;
  /** Live posts only: the connected account with its decrypted token, or a reason. */
  getAccount: () => Promise<PublishingAccount | { error: string }>;
  markNeedsReconnect: (accountId: string, message: string) => Promise<void>;
  getVideoJob: (jobId: string) => Promise<{ status: string; finished_at: string | null } | null>;
  /** Signed GET URL of the MP4 for Meta (live posts only). */
  signVideoUrl: (objectPath: string) => Promise<string>;
};

export type StepOutcome =
  | "skipped"
  | "container_created"
  | "waiting"
  | "published"
  | "failed"
  | "retry_later";

export type StepResult = { outcome: StepOutcome; post: SocialPostRow };

const DRY_RUN_ACCOUNT: PublishingAccount = { id: "dry-run", igUserId: "dry-run", accessToken: "dry-run" };

const later = (now: Date, ms: number) => new Date(now.getTime() + ms).toISOString();

export const advanceSocialPost = async (post: SocialPostRow, deps: PublisherDeps): Promise<StepResult> => {
  if (post.status !== "publishing") return { outcome: "skipped", post };
  const now = deps.now();
  const graph = deps.graphFor(post.dry_run);

  const save = async (patch: Record<string, unknown>, outcome: StepOutcome): Promise<StepResult> => {
    const updated = await deps.posts.update(post.id, patch, "status=eq.publishing");
    if (updated) Object.assign(post, updated);
    return { outcome: updated ? outcome : "skipped", post: updated ?? post };
  };
  const fail = (error: string, extra: Record<string, unknown> = {}) =>
    save({ status: "failed", error: error.slice(0, 1_000), locked_until: null, ...extra }, "failed");
  const wait = (ms: number, extra: Record<string, unknown> = {}) =>
    save({ locked_until: later(now, ms), ...extra }, "waiting");

  const finalize = async (mediaId: string, permalink: string | null, note: string | null = null) =>
    save({
      status: "published",
      ig_media_id: mediaId,
      ig_permalink: permalink,
      published_at: now.toISOString(),
      error: note,
      locked_until: null,
    }, "published");

  let account: PublishingAccount = DRY_RUN_ACCOUNT;

  /** FINISHED: record the attempt before calling Meta, then store the media id at once. */
  const publishFinishedContainer = async (containerId: string): Promise<StepResult> => {
    const marked = await deps.posts.update(post.id, { publish_requested_at: now.toISOString() }, "status=eq.publishing&ig_media_id=is.null");
    if (!marked) return { outcome: "skipped", post };
    Object.assign(post, marked);
    const mediaId = await graph.publishContainer(account.igUserId, containerId, account.accessToken);
    await deps.posts.update(post.id, { ig_media_id: mediaId }, "status=eq.publishing");
    const permalink = await graph.getPermalink(mediaId, account.accessToken).catch(() => null);
    return finalize(mediaId, permalink);
  };

  /**
   * The container is PUBLISHED but the media id was never stored (lost response): find the reel
   * among the account's latest media; when it cannot be identified for sure, mark the post
   * published with a manual-check note. Never a new container, never a second media_publish.
   */
  const recoverPublishedMedia = async (since: string | null): Promise<StepResult> => {
    const media = await graph.listRecentMedia(account.igUserId, account.accessToken).catch(() => null);
    const sinceMs = since ? Date.parse(since) - RECOVERY_CLOCK_SKEW_MS : Number.NEGATIVE_INFINITY;
    const candidates = (media ?? []).filter((item) =>
      (!item.mediaProductType || item.mediaProductType === "REELS") && item.timestampMs !== null && item.timestampMs >= sinceMs);
    if (candidates.length === 1) return finalize(candidates[0].id, candidates[0].permalink);
    return save({
      status: "published",
      published_at: now.toISOString(),
      error: MANUAL_CHECK_NOTE,
      locked_until: null,
    }, "published");
  };

  /** A publish was requested: only the container status may decide what happens next. */
  const resumeRequestedPublish = async (containerId: string, requestedAt: string): Promise<StepResult> => {
    let result: { statusCode: string; status: string | null };
    try {
      result = await graph.getContainerStatus(containerId, account.accessToken);
    } catch (error) {
      if (error instanceof InstagramGraphError && error.kind === "permanent") {
        return fail(`Publication demandée à Instagram mais le conteneur est illisible (${error.message}) : vérifie sur Instagram avant de relancer.`);
      }
      throw error;
    }
    if (result.statusCode === "PUBLISHED") return recoverPublishedMedia(requestedAt);
    // FINISHED: Meta confirms the container was not published, so publishing it is safe.
    if (result.statusCode === "FINISHED") return await publishFinishedContainer(containerId);
    if (result.statusCode === "IN_PROGRESS") return wait(POLL_INTERVAL_MS, { error: null });
    // ERROR / EXPIRED after a request: keep every id, the admin checks Instagram first.
    return fail(`Instagram indique ${result.statusCode} après une demande de publication : vérifie sur Instagram avant de relancer.`);
  };
  try {
    if (!post.dry_run) {
      // A post started in simulation can never reach Meta with its fake ids, and vice versa.
      if (isDryRunId(post.ig_container_id) || isDryRunId(post.ig_media_id)) {
        return fail("Publication commencée en simulation : relance-la pour publier pour de vrai.", {
          ig_container_id: null, ig_container_created_at: null, publish_requested_at: null, ig_media_id: null,
        });
      }
      const resolved = await deps.getAccount();
      if ("error" in resolved) {
        // 1a. Already published: it stays published even if the account needs a reconnect.
        if (post.ig_media_id) return finalize(post.ig_media_id, post.ig_permalink, post.error);
        return fail(resolved.error);
      }
      account = resolved;
    }

    // 1. Already published: only the permalink may be missing.
    if (post.ig_media_id) {
      const permalink = post.ig_permalink ?? await graph.getPermalink(post.ig_media_id, account.accessToken).catch(() => null);
      return finalize(post.ig_media_id, permalink, post.error);
    }

    // 2. A publish was already requested (media_publish called, its result unknown): the
    //    container status decides, before any deadline or expiry rule could drop the container.
    if (post.ig_container_id && post.publish_requested_at) {
      return await resumeRequestedPublish(post.ig_container_id, post.publish_requested_at);
    }

    const startedAt = Date.parse(post.scheduled_at ?? post.created_at);
    if (now.getTime() - startedAt > PUBLISHING_DEADLINE_MS) {
      return fail("La publication n’a pas abouti en 24 h.", { ig_container_id: null, ig_container_created_at: null });
    }

    // 3. No container yet: create it (the video must still be in storage).
    if (!post.ig_container_id) {
      if (!post.video_job_id || !post.video_url) return fail("La vidéo de cette publication a été supprimée.");
      const job = await deps.getVideoJob(post.video_job_id);
      if (!job || job.status !== "done") return fail("La vidéo de cette publication n’est plus disponible.");
      if (!canPublishNow(job.finished_at, now)) return fail("La vidéo arrive en fin de conservation (30 jours) : relance un rendu.");

      const limit = await graph.getPublishingLimit(account.igUserId, account.accessToken).catch(() => null);
      if (limit && limit.usage >= limit.total) {
        return wait(QUOTA_BACKOFF_MS, { error: `Quota Instagram atteint (${limit.usage}/${limit.total} sur 24 h) : nouvel essai automatique.` });
      }

      const videoUrl = post.dry_run ? `dry-run://${post.video_url}` : await deps.signVideoUrl(post.video_url);
      const containerId = await graph.createReelContainer({
        igUserId: account.igUserId,
        accessToken: account.accessToken,
        videoUrl,
        caption: buildFullCaption(post.caption, post.hashtags),
        shareToFeed: true,
      });
      return save({
        ig_container_id: containerId,
        ig_container_created_at: now.toISOString(),
        error: null,
        locked_until: post.dry_run ? null : later(now, POLL_INTERVAL_MS),
      }, "container_created");
    }

    // 4. Container, no publish requested yet: poll, then publish once.
    const containerAge = now.getTime() - Date.parse(post.ig_container_created_at ?? post.updated_at);
    if (containerAge > CONTAINER_LIFETIME_MS) {
      return fail("Le conteneur Instagram a expiré (24 h).", { ig_container_id: null, ig_container_created_at: null });
    }

    const { statusCode, status } = await graph.getContainerStatus(post.ig_container_id, account.accessToken);
    if (statusCode === "IN_PROGRESS") return wait(POLL_INTERVAL_MS, { error: null });
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      return fail(
        statusCode === "EXPIRED" ? "Le conteneur Instagram a expiré." : `Instagram a refusé la vidéo${status ? ` : ${status}` : "."}`,
        { ig_container_id: null, ig_container_created_at: null },
      );
    }
    if (statusCode === "PUBLISHED") return await recoverPublishedMedia(post.publish_requested_at ?? post.ig_container_created_at);
    return await publishFinishedContainer(post.ig_container_id);
  } catch (error) {
    if (error instanceof InstagramGraphError) {
      if (error.kind === "auth") {
        if (account.id !== DRY_RUN_ACCOUNT.id) await deps.markNeedsReconnect(account.id, error.message).catch(() => undefined);
        // The container is kept: once reconnected, "Réessayer" resumes from it.
        return fail(`Jeton Instagram refusé : reconnecte le compte (${error.message}).`);
      }
      if (error.kind === "rate_limit") return wait(RATE_LIMIT_BACKOFF_MS, { error: `Limite Instagram atteinte : nouvel essai automatique (${error.message}).` });
      if (error.kind === "not_ready") return wait(POLL_INTERVAL_MS, { error: null });
      if (error.kind === "permanent") return fail(`Instagram a refusé la publication : ${error.message}`);
    }
    const attempts = post.attempt_count + 1;
    const message = error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue";
    if (attempts >= MAX_TRANSIENT_ATTEMPTS) return fail(`Publication abandonnée après ${attempts} essais : ${message}`, { attempt_count: attempts });
    return save({
      attempt_count: attempts,
      error: `Erreur temporaire, nouvel essai automatique : ${message}`,
      locked_until: later(now, TRANSIENT_BACKOFF_MS),
    }, "retry_later");
  }
};

/** Claims the lease of one post, then runs one step; null when another worker holds it. */
export const claimAndAdvance = async (postId: string, deps: PublisherDeps): Promise<StepResult | null> => {
  const now = deps.now();
  const claimed = await deps.posts.claim(postId, now, new Date(now.getTime() + CLAIM_LEASE_MS));
  if (!claimed) return null;
  return advanceSocialPost(claimed, deps);
};

/** One step for a live post; a simulated post never waits on Meta, so it runs to the end. */
export const advancePost = async (postId: string, dryRun: boolean, deps: PublisherDeps) => {
  let result = await claimAndAdvance(postId, deps);
  for (let step = 0; result && dryRun && result.post.status === "publishing" && step < 4; step += 1) {
    result = await claimAndAdvance(postId, deps);
  }
  return result;
};

/**
 * One scheduler tick: due scheduled posts enter `publishing`, then each publishing post whose
 * lease is free advances one step (a dry-run post runs to the end within the tick). A post stuck
 * in `publishing` after a crash is simply resumed from its stored container id once its lease expires.
 */
export const runPublishingTick = async (deps: PublisherDeps & { dryRun: boolean; limit?: number }) => {
  const { promoted, refused } = await deps.posts.promoteDue(deps.now(), deps.dryRun);
  const runnable = await deps.posts.listRunnable(deps.now(), deps.limit ?? 10);
  const results: { id: string; outcome: StepOutcome | "locked" }[] = [];
  for (const candidate of runnable) {
    const result = await advancePost(candidate.id, candidate.dry_run, deps);
    results.push({ id: candidate.id, outcome: result?.outcome ?? "locked" });
  }
  return { promoted: promoted.length, refused: refused.length, processed: results };
};

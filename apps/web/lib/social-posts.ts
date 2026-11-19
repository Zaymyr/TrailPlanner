import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

/**
 * Instagram Reels drafted from finished background renders (video_render_jobs) and published by
 * the admin "Publications" page. Rows are service-role only; this module holds the contracts,
 * the Instagram caption limits, the Europe/Paris scheduling rules and the row access.
 */

export const SOCIAL_POST_STATUSES = ["draft", "scheduled", "publishing", "published", "failed"] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

/** Instagram limits for a caption: 2,200 characters, 5 hashtags (Instagram's limit since late 2025, 30 before), 20 @mentions. */
export const CAPTION_MAX_CHARS = 2_200;
export const CAPTION_MAX_HASHTAGS = 5;
export const CAPTION_MAX_MENTIONS = 20;
export const COVER_TEXT_MAX_CHARS = 200;

/** The render bucket deletes objects 30 days after upload (lifecycle rule). */
export const VIDEO_STORAGE_LIFETIME_DAYS = 30;
/** A post must go out at least this long before its MP4 disappears. */
export const VIDEO_LIFETIME_MARGIN_HOURS = 24;
/** Lifetime of the signed GET URL handed to Meta when the container is created. */
export const META_VIDEO_URL_TTL_SECONDS = 2 * 60 * 60;

export const PARIS_TIME_ZONE = "Europe/Paris";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------------------------
// Caption and hashtags

/** Same normalization as the caption generator: lowercase letters, digits and underscores. */
export const normalizeHashtag = (tag: string) =>
  tag.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^#+/, "").replace(/[^a-z0-9_]/g, "");

export const normalizeHashtags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.map(normalizeHashtag).filter((tag) => tag.length > 1 && !seen.has(tag) && Boolean(seen.add(tag)));
};

/** Splits free text ("#trail, ultratrail running") into hashtags. */
export const parseHashtagInput = (value: string) => normalizeHashtags(value.split(/[\s,;]+/).filter(Boolean));

/** Caption sent to Instagram: the text, a blank line, then the hashtags. */
export const buildFullCaption = (caption: string, hashtags: string[]) => {
  const tags = hashtags.length ? hashtags.map((tag) => `#${tag}`).join(" ") : "";
  return [caption.trim(), tags].filter(Boolean).join("\n\n");
};

const HASHTAG_PATTERN = /(^|[^\p{L}\p{N}_&])#[\p{L}\p{N}_]+/gu;
const MENTION_PATTERN = /(^|[^\p{L}\p{N}_.])@[A-Za-z0-9._]+/gu;

export type CaptionCheck = { length: number; hashtagCount: number; mentionCount: number; problems: string[] };

export const checkCaption = (caption: string, hashtags: string[]): CaptionCheck => {
  const full = buildFullCaption(caption, hashtags);
  // Every occurrence counts, repeated or not: the conservative reading of Instagram's limit.
  const hashtagCount = Array.from(full.matchAll(HASHTAG_PATTERN)).length;
  const mentionCount = Array.from(full.matchAll(MENTION_PATTERN)).length;
  const problems: string[] = [];
  if (full.length > CAPTION_MAX_CHARS) problems.push(`La description dépasse ${CAPTION_MAX_CHARS} caractères (${full.length} avec les hashtags).`);
  if (hashtagCount > CAPTION_MAX_HASHTAGS) problems.push(`Instagram accepte ${CAPTION_MAX_HASHTAGS} hashtags au plus (${hashtagCount}).`);
  if (mentionCount > CAPTION_MAX_MENTIONS) problems.push(`Instagram accepte ${CAPTION_MAX_MENTIONS} mentions au plus (${mentionCount}).`);
  return { length: full.length, hashtagCount, mentionCount, problems };
};

/** Default caption of a new draft: sober, editable, no invented fact. */
export const buildDefaultCaption = (raceTitle: string) =>
  `${raceTitle} : le parcours en 3D.\n\nPrépare ton plan de course et retrouve le livret coureur dans l’appli Pace Yourself (lien en bio).`;

export const DEFAULT_HASHTAGS = ["trail", "trailrunning", "ultratrail", "paceyourself"];

// ---------------------------------------------------------------------------------------------
// Europe/Paris wall time <-> UTC

const parisParts = (ms: number) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
};

const offsetAt = (ms: number) => {
  const p = parisParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000;
};

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * "2026-12-03T18:30" read as Paris wall time, as a UTC Date. A time skipped by the spring DST
 * change returns null; an ambiguous autumn time resolves to its first (summer-time) occurrence.
 */
export const parisLocalToUtc = (local: string): Date | null => {
  const match = LOCAL_PATTERN.exec(local);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [wall - offsetAt(wall - 3 * HOUR_MS), wall - offsetAt(wall + 3 * HOUR_MS)].sort((a, b) => a - b);
  for (const candidate of candidates) {
    const p = parisParts(candidate);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) return new Date(candidate);
  }
  return null;
};

/** UTC instant as the "YYYY-MM-DDTHH:mm" value of a datetime-local input, in Paris time. */
export const utcToParisLocal = (iso: string | Date) => {
  const p = parisParts(typeof iso === "string" ? Date.parse(iso) : iso.getTime());
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

export const formatParisDateTime = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
    : "—";

// ---------------------------------------------------------------------------------------------
// Video lifetime and scheduling

export const getVideoAvailableUntil = (finishedAt: string) =>
  new Date(Date.parse(finishedAt) + VIDEO_STORAGE_LIFETIME_DAYS * DAY_MS);

/** Latest moment a post may go out: the MP4 lifetime minus the safety margin. */
export const getLatestPublishTime = (finishedAt: string) =>
  new Date(getVideoAvailableUntil(finishedAt).getTime() - VIDEO_LIFETIME_MARGIN_HOURS * HOUR_MS);

export type ScheduleCheck = { ok: true; scheduledAt: Date } | { ok: false; message: string };

/** Checks a Paris wall time for "Programmer": in the future and before the MP4 expires. */
export const validateSchedule = ({ local, finishedAt, now = new Date() }: { local: string; finishedAt: string | null; now?: Date }): ScheduleCheck => {
  const scheduledAt = parisLocalToUtc(local);
  if (!scheduledAt) return { ok: false, message: "Date ou heure invalide (heure inexistante au changement d’heure ?)." };
  if (scheduledAt.getTime() < now.getTime() + 60_000) return { ok: false, message: "Choisis une date dans le futur." };
  if (!finishedAt) return { ok: false, message: "La vidéo n’est pas terminée." };
  const latest = getLatestPublishTime(finishedAt);
  if (scheduledAt.getTime() > latest.getTime()) {
    return { ok: false, message: `La vidéo sera supprimée du stockage : programme avant le ${formatParisDateTime(latest.toISOString())}.` };
  }
  return { ok: true, scheduledAt };
};

/** "Publier maintenant" needs the MP4 to still be there for the whole publication. */
export const canPublishNow = (finishedAt: string | null, now = new Date()) =>
  Boolean(finishedAt) && now.getTime() <= getLatestPublishTime(finishedAt as string).getTime();

// ---------------------------------------------------------------------------------------------
// API contracts

const captionField = z.string().max(CAPTION_MAX_CHARS);
const hashtagsField = z.array(z.string().max(100)).max(60).transform(normalizeHashtags);

const withCaptionLimits = <T extends { caption?: string; hashtags?: string[] }>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  schema.superRefine((value, context) => {
    if (value.caption === undefined && value.hashtags === undefined) return;
    const check = checkCaption(value.caption ?? "", value.hashtags ?? []);
    check.problems.forEach((message) => context.addIssue({ code: z.ZodIssueCode.custom, message, path: ["caption"] }));
  });

export const createSocialPostSchema = withCaptionLimits(z.object({
  videoJobId: z.string().uuid(),
  caption: captionField,
  hashtags: hashtagsField,
  coverText: z.string().trim().max(COVER_TEXT_MAX_CHARS).nullable().optional(),
}));

export const updateSocialPostSchema = withCaptionLimits(z.object({
  caption: captionField,
  hashtags: hashtagsField,
  coverText: z.string().trim().max(COVER_TEXT_MAX_CHARS).nullable().optional(),
  /** The admin checked Instagram after a publish request and accepts starting over. */
  confirmRestart: z.boolean().optional(),
}));

export const socialPostActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish_now") }),
  z.object({ action: z.literal("schedule"), scheduledAtLocal: z.string().regex(LOCAL_PATTERN) }),
  z.object({ action: z.literal("unschedule") }),
  z.object({ action: z.literal("retry"), confirmRestart: z.boolean().optional() }),
  z.object({ action: z.literal("advance") }),
]);
export type SocialPostAction = z.infer<typeof socialPostActionSchema>;

/** Shown before an action that would drop a container whose publication was already requested. */
export const PUBLISH_REQUESTED_CONFIRMATION =
  "Une publication a déjà été demandée à Instagram pour ce post. Vérifie sur le compte qu’elle n’a pas été publiée : en confirmant, un nouveau conteneur sera créé et le reel pourrait apparaître deux fois.";

type RestartFields = Pick<SocialPostRow, "status" | "publish_requested_at" | "ig_media_id" | "ig_container_id" | "dry_run">;

/** A live media_publish was called and its outcome is not stored: the reel may already be online. */
export const publishWasRequested = (post: RestartFields) => Boolean(post.publish_requested_at) && !post.ig_media_id && !post.dry_run;

export type RestartPlan = { kind: "needs_confirmation" } | { kind: "proceed"; dropContainer: boolean };

/**
 * « Réessayer » resumes from the stored container; it starts over (drops the container) when the
 * mode changed or the admin asked to. Starting over after a live publish request needs the
 * admin's explicit confirmation, since the first attempt may already be on Instagram.
 */
export const planRetry = (post: RestartFields, dryRun: boolean, confirmRestart = false): RestartPlan => {
  const dropContainer = post.dry_run !== dryRun || confirmRestart;
  if (dropContainer && publishWasRequested(post) && !confirmRestart) return { kind: "needs_confirmation" };
  return { kind: "proceed", dropContainer };
};

/** Editing a failed post drops its container (the caption is inside it): same confirmation rule. */
export const planEdit = (post: RestartFields, confirmRestart = false): RestartPlan => {
  const dropContainer = post.status === "failed";
  if (dropContainer && publishWasRequested(post) && !confirmRestart) return { kind: "needs_confirmation" };
  return { kind: "proceed", dropContainer };
};

// ---------------------------------------------------------------------------------------------
// Rows (service role)

export const socialPostRowSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid().nullable(),
  video_job_id: z.string().uuid().nullable(),
  platform: z.literal("instagram"),
  status: z.enum(SOCIAL_POST_STATUSES),
  caption: z.string(),
  hashtags: z.array(z.string()),
  cover_text: z.string().nullable(),
  video_url: z.string().nullable(),
  scheduled_at: z.string().nullable(),
  published_at: z.string().nullable(),
  ig_container_id: z.string().nullable(),
  ig_container_created_at: z.string().nullable(),
  publish_requested_at: z.string().nullable(),
  ig_media_id: z.string().nullable(),
  ig_permalink: z.string().nullable(),
  error: z.string().nullable(),
  dry_run: z.boolean(),
  attempt_count: z.number().int(),
  locked_until: z.string().nullable(),
  content: z.record(z.string(), z.unknown()).nullable(),
  // Created by the render completion (one-click reel), not by an admin.
  auto_generated: z.boolean().default(false),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SocialPostRow = z.infer<typeof socialPostRowSchema>;

/** Why a scheduled post was not promoted after the publishing mode changed. */
export const modeMismatchMessage = (scheduledInDryRun: boolean) =>
  scheduledInDryRun
    ? "Programmée en simulation — reprogramme-la pour publier sur Instagram."
    : "Programmée pour une publication réelle alors que la simulation est active — reprogramme-la.";

export const SOCIAL_POST_COLUMNS = Object.keys(socialPostRowSchema.shape).join(",");

/** What the admin page receives: no internal lease fields. */
export const toPublicSocialPost = (row: SocialPostRow, extra: { raceTitle?: string | null; videoAvailableUntil?: string | null } = {}) => ({
  id: row.id,
  raceId: row.race_id,
  videoJobId: row.video_job_id,
  raceTitle: extra.raceTitle ?? null,
  status: row.status,
  caption: row.caption,
  hashtags: row.hashtags,
  coverText: row.cover_text,
  scheduledAt: row.scheduled_at,
  publishedAt: row.published_at,
  igMediaId: row.ig_media_id,
  igPermalink: row.ig_permalink,
  hasContainer: Boolean(row.ig_container_id),
  publishRequested: Boolean(row.publish_requested_at) && !row.ig_media_id,
  error: row.error,
  dryRun: row.dry_run,
  autoGenerated: row.auto_generated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  videoAvailableUntil: extra.videoAvailableUntil ?? null,
});

export const publicSocialPostSchema = z.object({
  id: z.string(),
  raceId: z.string().nullable(),
  videoJobId: z.string().nullable(),
  raceTitle: z.string().nullable(),
  status: z.enum(SOCIAL_POST_STATUSES),
  caption: z.string(),
  hashtags: z.array(z.string()),
  coverText: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  igMediaId: z.string().nullable(),
  igPermalink: z.string().nullable(),
  hasContainer: z.boolean(),
  publishRequested: z.boolean(),
  error: z.string().nullable(),
  dryRun: z.boolean(),
  autoGenerated: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  videoAvailableUntil: z.string().nullable(),
});
export type PublicSocialPost = z.infer<typeof publicSocialPostSchema>;

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const rows = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`Unable to ${action} social post (${response.status}).`);
  return z.array(socialPostRowSchema).parse(await response.json());
};

export type SocialPostRepository = {
  get: (id: string) => Promise<SocialPostRow | null>;
  /** The automatic draft of a render (at most one: partial unique index), or null. */
  findAutoDraft: (videoJobId: string) => Promise<SocialPostRow | null>;
  list: (limit?: number) => Promise<SocialPostRow[]>;
  insert: (row: Record<string, unknown>) => Promise<SocialPostRow>;
  /** Guarded update: applied only when the row matches `filter` (PostgREST query string). */
  update: (id: string, patch: Record<string, unknown>, filter?: string) => Promise<SocialPostRow | null>;
  remove: (id: string, filter: string) => Promise<boolean>;
  /**
   * Scheduled posts whose time has come become `publishing` (atomic, guarded by status) only when
   * they were scheduled in the current mode; the others fail and must be rescheduled.
   */
  promoteDue: (now: Date, dryRun: boolean) => Promise<{ promoted: SocialPostRow[]; refused: SocialPostRow[] }>;
  /** Publishing posts whose lease is free. */
  listRunnable: (now: Date, limit: number) => Promise<SocialPostRow[]>;
  /** Takes the lease of one publishing post; null when another worker holds it. */
  claim: (id: string, now: Date, until: Date) => Promise<SocialPostRow | null>;
};

/** Render jobs behind posts (read-only use of video_render_jobs), keyed by id. */
const videoJobSummarySchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid(),
  race_title: z.string(),
  status: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  finished_at: z.string().nullable(),
  // Reel text written with the video (parsed by reel-content, which depends on this module).
  content: z.unknown().optional(),
});
export type VideoJobSummary = z.infer<typeof videoJobSummarySchema>;

export const listVideoJobsForPublishing = async (
  supabase: SupabaseServiceConfig,
  { ids, finishedSince }: { ids?: string[]; finishedSince?: Date },
  fetcher: typeof fetch = fetch,
) => {
  const filters = ids
    ? `id=in.(${ids.join(",")})`
    : `status=eq.done&finished_at=gte.${encodeURIComponent((finishedSince ?? new Date(0)).toISOString())}&order=finished_at.desc&limit=30`;
  if (ids && ids.length === 0) return new Map<string, VideoJobSummary>();
  const response = await fetcher(`${supabase.supabaseUrl}/rest/v1/video_render_jobs?${filters}&select=id,race_id,race_title,status,width,height,finished_at,content`, {
    headers: headers(supabase),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to list render jobs (${response.status}).`);
  return new Map(z.array(videoJobSummarySchema).parse(await response.json()).map((job) => [job.id, job]));
};

const leaseFree = (now: Date) => `or=(locked_until.is.null,locked_until.lt.${encodeURIComponent(now.toISOString())})`;

export const createSocialPostRepository = (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch): SocialPostRepository => {
  const base = `${supabase.supabaseUrl}/rest/v1/social_posts`;
  const patch = async (query: string, body: Record<string, unknown>) =>
    rows(await fetcher(`${base}?${query}&select=${SOCIAL_POST_COLUMNS}`, {
      method: "PATCH",
      headers: headers(supabase, { Prefer: "return=representation" }),
      body: JSON.stringify(body),
      cache: "no-store",
    }), "update");

  return {
    get: async (id) => (await rows(await fetcher(`${base}?id=eq.${id}&select=${SOCIAL_POST_COLUMNS}&limit=1`, {
      headers: headers(supabase), cache: "no-store",
    }), "read"))[0] ?? null,
    findAutoDraft: async (videoJobId) => (await rows(await fetcher(`${base}?video_job_id=eq.${videoJobId}&auto_generated=eq.true&select=${SOCIAL_POST_COLUMNS}&limit=1`, {
      headers: headers(supabase), cache: "no-store",
    }), "read"))[0] ?? null,
    list: async (limit = 50) => rows(await fetcher(`${base}?select=${SOCIAL_POST_COLUMNS}&order=created_at.desc&limit=${limit}`, {
      headers: headers(supabase), cache: "no-store",
    }), "list"),
    insert: async (row) => (await rows(await fetcher(`${base}?select=${SOCIAL_POST_COLUMNS}`, {
      method: "POST",
      headers: headers(supabase, { Prefer: "return=representation" }),
      body: JSON.stringify(row),
      cache: "no-store",
    }), "create"))[0],
    update: async (id, body, filter) => (await patch(`id=eq.${id}${filter ? `&${filter}` : ""}`, body))[0] ?? null,
    remove: async (id, filter) => {
      const response = await fetcher(`${base}?id=eq.${id}&${filter}&select=id`, {
        method: "DELETE",
        headers: headers(supabase, { Prefer: "return=representation" }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to delete social post (${response.status}).`);
      return z.array(z.object({ id: z.string() })).parse(await response.json()).length > 0;
    },
    promoteDue: async (now, dryRun) => {
      const due = `status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(now.toISOString())}`;
      // dry_run is never rewritten here: a post scheduled in simulation can never go live.
      const promoted = await patch(`${due}&dry_run=eq.${dryRun}`, {
        status: "publishing",
        attempt_count: 0,
        error: null,
        locked_until: null,
      });
      const refused = await patch(`${due}&dry_run=eq.${!dryRun}`, {
        status: "failed",
        error: modeMismatchMessage(!dryRun),
        locked_until: null,
      });
      return { promoted, refused };
    },
    listRunnable: async (now, limit) => rows(await fetcher(
      `${base}?status=eq.publishing&${leaseFree(now)}&select=${SOCIAL_POST_COLUMNS}&order=scheduled_at.asc.nullsfirst&limit=${limit}`,
      { headers: headers(supabase), cache: "no-store" },
    ), "list"),
    claim: async (id, now, until) => (await patch(`id=eq.${id}&status=eq.publishing&${leaseFree(now)}`, {
      locked_until: until.toISOString(),
    }))[0] ?? null,
  };
};

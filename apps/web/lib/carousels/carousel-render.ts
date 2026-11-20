import { z } from "zod";

import { isInstagramPublishDryRun } from "../instagram/config";
import { normalizeHashtags, type SocialPostRepository, type SocialPostRow, createSocialPostRepository } from "../social-posts";
import type { SupabaseServiceConfig } from "../supabase";
import {
  buildRenderUrl,
  createRenderToken,
  getGoogleAccessToken,
  runRenderJob,
  type VideoRenderConfig,
} from "../video-render";
import {
  CAROUSEL_SERIES,
  CAROUSEL_SLIDE_HEIGHT,
  CAROUSEL_SLIDE_WIDTH,
  getSlideCount,
  type CarouselSeries,
  type CarouselSnapshot,
} from "./carousel-snapshot";

/**
 * Carousel slide renders (`carousel_render_jobs`): the snapshot lives in the row, the Cloud Run
 * renderer opens /render/carousel/<id> with a carousel-scoped token, the page rasterises each
 * 1080 × 1350 slide to JPEG and PUTs it to Cloud Storage (`carousels/<id>/slide-<n>.jpg`).
 */

export const CAROUSEL_RENDER_STATUSES = ["queued", "running", "done", "failed"] as const;

/** Caption written for the carousel, copied into its automatic draft. */
export const carouselContentSchema = z.object({
  caption: z.string().max(2_200),
  hashtags: z.array(z.string()).max(10),
  warnings: z.array(z.string()).default([]),
});
export type CarouselContent = z.infer<typeof carouselContentSchema>;

export const carouselRenderJobRowSchema = z.object({
  id: z.string().uuid(),
  series: z.enum(CAROUSEL_SERIES),
  race_id: z.string().uuid().nullable(),
  title: z.string(),
  status: z.enum(CAROUSEL_RENDER_STATUSES),
  snapshot: z.record(z.string(), z.unknown()),
  content: carouselContentSchema.nullable().catch(null),
  slide_count: z.number().int(),
  image_paths: z.array(z.string()),
  message: z.string().nullable(),
  auto_draft: z.boolean(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type CarouselRenderJobRow = z.infer<typeof carouselRenderJobRowSchema>;

export const CAROUSEL_RENDER_JOB_COLUMNS = Object.keys(carouselRenderJobRowSchema.shape).join(",");

/** A rasterisation takes seconds: a job silent this long is lost (the worker itself stops at 55 min). */
export const CAROUSEL_RENDER_STALE_MS = 70 * 60 * 1_000;

export const isCarouselRenderStale = (job: Pick<CarouselRenderJobRow, "status" | "created_at">, nowMs: number) =>
  (job.status === "queued" || job.status === "running") && nowMs - Date.parse(job.created_at) > CAROUSEL_RENDER_STALE_MS;

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const parseRows = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`Unable to ${action} carousel render job (${response.status}).`);
  return z.array(carouselRenderJobRowSchema).parse(await response.json());
};

export const getCarouselRenderJob = async (supabase: SupabaseServiceConfig, id: string) =>
  (await parseRows(await fetch(`${supabase.supabaseUrl}/rest/v1/carousel_render_jobs?id=eq.${id}&select=${CAROUSEL_RENDER_JOB_COLUMNS}&limit=1`, {
    headers: headers(supabase), cache: "no-store",
  }), "read"))[0] ?? null;

export const listCarouselRenderJobs = async (supabase: SupabaseServiceConfig, ids: string[]) => {
  if (!ids.length) return new Map<string, CarouselRenderJobRow>();
  const rows = await parseRows(await fetch(`${supabase.supabaseUrl}/rest/v1/carousel_render_jobs?id=in.(${ids.join(",")})&select=${CAROUSEL_RENDER_JOB_COLUMNS}`, {
    headers: headers(supabase), cache: "no-store",
  }), "list");
  return new Map(rows.map((row) => [row.id, row]));
};

/** Guarded update: `onlyFrom` keeps a finished job from being reopened. */
export const updateCarouselRenderJob = async (
  supabase: SupabaseServiceConfig,
  id: string,
  patch: Record<string, unknown>,
  onlyFrom?: readonly (typeof CAROUSEL_RENDER_STATUSES)[number][],
) => (await parseRows(await fetch(
  `${supabase.supabaseUrl}/rest/v1/carousel_render_jobs?id=eq.${id}${onlyFrom ? `&status=in.(${onlyFrom.join(",")})` : ""}&select=${CAROUSEL_RENDER_JOB_COLUMNS}`,
  { method: "PATCH", headers: headers(supabase, { Prefer: "return=representation" }), body: JSON.stringify(patch), cache: "no-store" },
), "update"))[0] ?? null;

/**
 * Inserts the job and starts the Cloud Run execution. A failed launch marks the job failed, so it
 * never stays active.
 */
export const launchCarouselRender = async ({ supabase, config, request, series, raceId, title, snapshot, content, createdBy, autoDraft }: {
  supabase: SupabaseServiceConfig;
  config: VideoRenderConfig;
  request: Request;
  series: CarouselSeries;
  raceId: string | null;
  title: string;
  snapshot: CarouselSnapshot;
  content: CarouselContent | null;
  createdBy: string | null;
  autoDraft: boolean;
}) => {
  const [job] = await parseRows(await fetch(`${supabase.supabaseUrl}/rest/v1/carousel_render_jobs?select=${CAROUSEL_RENDER_JOB_COLUMNS}`, {
    method: "POST",
    headers: headers(supabase, { Prefer: "return=representation" }),
    body: JSON.stringify({
      series,
      race_id: raceId,
      title: title.slice(0, 200),
      status: "queued",
      snapshot,
      content,
      slide_count: getSlideCount(snapshot),
      auto_draft: autoDraft,
      created_by: createdBy,
    }),
    cache: "no-store",
  }), "create");
  try {
    const accessToken = await getGoogleAccessToken(config, request);
    const url = buildRenderUrl(
      new URL(request.url).origin,
      { id: job.id, width: CAROUSEL_SLIDE_WIDTH, height: CAROUSEL_SLIDE_HEIGHT },
      createRenderToken(config.tokenSecret, job.id, Date.now(), "carousel-render"),
      "carousel",
    );
    const execution = await runRenderJob(config, accessToken, url);
    await updateCarouselRenderJob(supabase, job.id, { cloud_run_execution: execution }, ["queued"]);
    return job;
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Le rendu n’a pas pu démarrer.").slice(0, 500);
    await updateCarouselRenderJob(supabase, job.id, { status: "failed", message, finished_at: new Date().toISOString() }, ["queued"]).catch(() => null);
    throw error;
  }
};

/** Insert payload of a carousel draft made from a finished render. */
export const buildCarouselDraftRow = (job: Pick<CarouselRenderJobRow, "id" | "series" | "race_id" | "image_paths" | "content" | "created_by">, autoGenerated: boolean) => ({
  race_id: job.race_id,
  media_type: "carousel",
  carousel_series: job.series,
  carousel_job_id: job.id,
  image_paths: job.image_paths,
  platform: "instagram",
  status: "draft",
  caption: job.content?.caption ?? "",
  hashtags: normalizeHashtags(job.content?.hashtags ?? []).slice(0, 5),
  ...(job.content ? { content: job.content } : {}),
  dry_run: isInstagramPublishDryRun(),
  created_by: job.created_by,
  ...(autoGenerated ? { auto_generated: true } : {}),
});

/**
 * The draft of a finished carousel render launched with `auto_draft`: always a `draft`, idempotent
 * (existing automatic draft first, partial unique index behind it), like the one-click reel.
 */
export const createAutoDraftForCarouselJob = async (
  supabase: SupabaseServiceConfig,
  job: CarouselRenderJobRow,
  repository: SocialPostRepository = createSocialPostRepository(supabase),
): Promise<{ post: SocialPostRow; created: boolean } | null> => {
  if (!job.auto_draft || job.status !== "done" || job.image_paths.length < 2) return null;
  const existing = await repository.findCarouselAutoDraft(job.id);
  if (existing) return { post: existing, created: false };
  try {
    return { post: await repository.insert(buildCarouselDraftRow(job, true)), created: true };
  } catch (error) {
    const winner = await repository.findCarouselAutoDraft(job.id).catch(() => null);
    if (winner) return { post: winner, created: false };
    throw error;
  }
};

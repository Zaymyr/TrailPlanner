import { z } from "zod";

import {
  buildRenderEntries,
  buildRendersPage,
  carouselItemLinkSchema,
  carouselRenderRowSchema,
  CAROUSEL_RENDER_ROW_COLUMNS,
  flyoverLinkSchema,
  postLinkSchema,
  reelItemLinkSchema,
  videoRenderRowSchema,
  VIDEO_RENDER_ROW_COLUMNS,
  type AdminRenderEntry,
  type AdminRendersResponse,
  type CarouselRenderRow,
  type RendersQuery,
  type VideoRenderRow,
} from "./admin-renders";
import { getServiceJson, settleSource } from "./admin-service-rest";
import { isCarouselRenderStale, updateCarouselRenderJob } from "./carousels/carousel-render";
import { RENDER_LOST_MESSAGE } from "./render-activity";
import type { SupabaseServiceConfig } from "./supabase";
import {
  getGoogleAccessToken,
  getReelFileName,
  getRenderOutputObject,
  getVideoRenderConfig,
  isRenderJobStale,
  signStorageUrl,
  updateRenderJob,
} from "./video-render";

/**
 * Loader of `GET /api/admin/renders` (service role): the renders of the period from `video_render_jobs`
 * (manual reels, automatic reels, flyovers) and `carousel_render_jobs`, the plan items, posts and flyover
 * orders that link to them, then `lib/admin-renders.ts` types, filters and pages them. A render that
 * stopped reporting is marked failed here, like `GET /api/admin/render-activity`. The MP4 of a finished
 * reel of the page is signed for 1 hour, like `GET /api/admin/video-generator/render-jobs`; without Google
 * Cloud configuration the list still loads, without download links.
 */

const ROW_LIMIT = 300;
const LINK_LIMIT = 1_000;
const ACTIVE_VIDEO = "status.in.(uploading,queued,running)";
const ACTIVE_CAROUSEL = "status.in.(queued,running)";
const PERIOD_MS = { "24h": 24 * 3_600_000, "7j": 7 * 24 * 3_600_000, "30j": 30 * 24 * 3_600_000 } as const;

const readRows = async <T>(supabase: SupabaseServiceConfig, path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  z.array(schema).parse(await getServiceJson(supabase, path));

const periodFilter = (query: Pick<RendersQuery, "period">, activeFilter: string, nowMs: number) =>
  query.period === "tout" ? "" : `&or=(created_at.gte.${encodeURIComponent(new Date(nowMs - PERIOD_MS[query.period]).toISOString())},${activeFilter})`;

const failLostVideos = (supabase: SupabaseServiceConfig, rows: VideoRenderRow[], nowMs: number) =>
  Promise.all(rows.map(async (row) => {
    if (!isRenderJobStale(row, nowMs)) return row;
    const finishedAt = new Date(nowMs).toISOString();
    const updated = await settleSource(
      updateRenderJob(supabase, row.id, { status: "failed", message: RENDER_LOST_MESSAGE, finished_at: finishedAt }, ["uploading", "queued", "running"]),
      "Lost render marking",
    );
    return updated ? { ...row, status: "failed" as const, message: RENDER_LOST_MESSAGE, finished_at: finishedAt } : row;
  }));

const failLostCarousels = (supabase: SupabaseServiceConfig, rows: CarouselRenderRow[], nowMs: number) =>
  Promise.all(rows.map(async (row) => {
    if (!isCarouselRenderStale(row, nowMs)) return row;
    const finishedAt = new Date(nowMs).toISOString();
    const updated = await settleSource(
      updateCarouselRenderJob(supabase, row.id, { status: "failed", message: RENDER_LOST_MESSAGE, finished_at: finishedAt }, ["queued", "running"]),
      "Lost carousel render marking",
    );
    return updated ? { ...row, status: "failed" as const, message: RENDER_LOST_MESSAGE, finished_at: finishedAt } : row;
  }));

export const loadAdminRenders = async ({ supabase, request, query, nowMs = Date.now() }: {
  supabase: SupabaseServiceConfig;
  request: Request;
  query: RendersQuery;
  nowMs?: number;
}): Promise<AdminRendersResponse> => {
  const [videoRows, carouselRows] = await Promise.all([
    readRows(supabase, `video_render_jobs?select=${VIDEO_RENDER_ROW_COLUMNS}&order=created_at.desc&limit=${ROW_LIMIT}${periodFilter(query, ACTIVE_VIDEO, nowMs)}`, videoRenderRowSchema),
    readRows(supabase, `carousel_render_jobs?select=${CAROUSEL_RENDER_ROW_COLUMNS}&order=created_at.desc&limit=${ROW_LIMIT}${periodFilter(query, ACTIVE_CAROUSEL, nowMs)}`, carouselRenderRowSchema),
  ]);

  // The asked render, when the period left it out (shared link to an old render).
  const focusId = query.focusId;
  if (focusId && !videoRows.some((row) => row.id === focusId) && !carouselRows.some((row) => row.id === focusId)) {
    const [extraVideo, extraCarousel] = await Promise.all([
      settleSource(readRows(supabase, `video_render_jobs?id=eq.${encodeURIComponent(focusId)}&select=${VIDEO_RENDER_ROW_COLUMNS}&limit=1`, videoRenderRowSchema), "Focused render"),
      settleSource(readRows(supabase, `carousel_render_jobs?id=eq.${encodeURIComponent(focusId)}&select=${CAROUSEL_RENDER_ROW_COLUMNS}&limit=1`, carouselRenderRowSchema), "Focused carousel render"),
    ]);
    videoRows.push(...(extraVideo ?? []));
    carouselRows.push(...(extraCarousel ?? []));
  }

  const [videos, carousels, reelItems, carouselItems, posts, flyovers] = await Promise.all([
    failLostVideos(supabase, videoRows, nowMs),
    failLostCarousels(supabase, carouselRows, nowMs),
    settleSource(readRows(supabase, `reel_automation_items?render_job_id=not.is.null&select=id,render_job_id,social_post_id,planned_publish_date&order=created_at.desc&limit=${LINK_LIMIT}`, reelItemLinkSchema), "Render plan items"),
    settleSource(readRows(supabase, `carousel_automation_items?carousel_job_id=not.is.null&select=id,carousel_job_id,social_post_id,planned_publish_date&order=created_at.desc&limit=${LINK_LIMIT}`, carouselItemLinkSchema), "Render carousel plan items"),
    settleSource(readRows(supabase, `social_posts?or=(video_job_id.not.is.null,carousel_job_id.not.is.null)&select=id,video_job_id,carousel_job_id,status,media_type,created_at&order=created_at.desc&limit=${LINK_LIMIT}`, postLinkSchema), "Render posts"),
    settleSource(readRows(supabase, `flyover_video_orders?select=id,race_name,status&order=created_at.desc&limit=${ROW_LIMIT}`, flyoverLinkSchema), "Render flyover orders"),
  ]);

  const entries = buildRenderEntries({
    videos,
    carousels,
    reelItems: reelItems ?? [],
    carouselItems: carouselItems ?? [],
    posts: posts ?? [],
    flyovers: flyovers ?? [],
  });
  const { page, counts, activeCount, focus } = buildRendersPage(entries, query, nowMs);

  // MP4 links of the finished reels shown (page and open panel) only.
  const config = getVideoRenderConfig();
  const shown = new Map<string, AdminRenderEntry>();
  [...page.items, ...(focus ? [focus] : [])].forEach((entry) => shown.set(entry.id, entry));
  const toSign = new Set([...shown.values()].filter((entry) => entry.source === "video" && entry.status === "termine").map((entry) => entry.id));
  const accessToken = config && toSign.size ? await getGoogleAccessToken(config, request).catch(() => null) : null;
  const downloadsAvailable = Boolean(config) && (toSign.size === 0 || accessToken !== null);
  const withDownload = async (entry: AdminRenderEntry): Promise<AdminRenderEntry> => {
    if (!config || !accessToken || !toSign.has(entry.id)) return entry;
    const downloadUrl = await signStorageUrl({
      config,
      accessToken,
      method: "GET",
      objectName: getRenderOutputObject(entry.id),
      expiresSeconds: 60 * 60,
      responseDisposition: `attachment; filename="${getReelFileName(entry.title)}"`,
    }).catch(() => null);
    return { ...entry, downloadUrl };
  };
  const signedById = new Map((await Promise.all([...shown.values()].map(withDownload))).map((entry) => [entry.id, entry]));

  return {
    entries: page.items.map((entry) => signedById.get(entry.id) ?? entry),
    total: page.total,
    page: page.page,
    pageCount: page.pageCount,
    pageSize: page.pageSize,
    counts,
    activeCount,
    focus: focus ? signedById.get(focus.id) ?? focus : null,
    downloadsAvailable,
  };
};

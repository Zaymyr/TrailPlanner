import { z } from "zod";

import {
  carouselRenderActivityRowSchema,
  reelRenderActivityRowSchema,
  toCarouselRenderActivity,
  toReelRenderActivity,
  type RenderActivity,
} from "./render-activity";

/**
 * « Rendus » of the admin console (`GET /api/admin/renders`, page `/admin/content/renders`): one list of
 * every render, whatever launched it. Pure part: row schemas of the sources (`video_render_jobs`,
 * `carousel_render_jobs`, the plan items and posts that link to them, the flyover orders), the
 * deduction of the type (manuel / auto / survol / carrousel), the normalised status, the origin links,
 * the URL query (`?periode`, `?type`, `?statut`, `?page`, `?rendu`), filtering, counts and paging.
 * The loader (`admin-renders-server.ts`) reads the rows and signs the downloads.
 */

export const RENDER_TYPES = ["manuel", "auto", "survol", "carrousel"] as const;
export type RenderType = (typeof RENDER_TYPES)[number];

export const RENDER_TYPE_LABEL: Record<RenderType, string> = {
  manuel: "Reel manuel",
  auto: "Reel automatique",
  survol: "Survol",
  carrousel: "Carrousel",
};

/** Normalised status: the three statuses of a video job that precede `running` collapse into « en attente ». */
export const RENDER_STATUSES = ["en_attente", "en_cours", "termine", "echec"] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

export const RENDER_STATUS_LABEL: Record<RenderStatus, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  echec: "Échec",
};

/** Filter chips: « En cours » covers waiting and running renders. */
export const RENDER_FILTER_STATUSES = ["actif", "termine", "echec"] as const;
export type RenderFilterStatus = (typeof RENDER_FILTER_STATUSES)[number];
export const RENDER_FILTER_STATUS_LABEL: Record<RenderFilterStatus, string> = { actif: "En cours", termine: "Terminés", echec: "Échecs" };

export const RENDER_PERIODS = ["24h", "7j", "30j", "tout"] as const;
export type RenderPeriod = (typeof RENDER_PERIODS)[number];
export const RENDER_PERIOD_LABEL: Record<RenderPeriod, string> = { "24h": "24 h", "7j": "7 jours", "30j": "30 jours", tout: "Tout" };
const PERIOD_MS: Record<Exclude<RenderPeriod, "tout">, number> = { "24h": 24 * 3_600_000, "7j": 7 * 24 * 3_600_000, "30j": 30 * 24 * 3_600_000 };

export const RENDERS_PAGE_SIZE = 25;

/** Refresh rhythm of the page: 5 s while a render is active, once a minute otherwise. */
export const ACTIVE_RENDERS_POLL_MS = 5_000;
export const IDLE_RENDERS_POLL_MS = 60_000;
export const rendersPollInterval = (hasActive: boolean) => (hasActive ? ACTIVE_RENDERS_POLL_MS : IDLE_RENDERS_POLL_MS);

// ---------------------------------------------------------------------------------------------
// Source rows (light columns: no snapshot, no reel content)

const nullableId = z.string().nullable().optional().transform((value) => value ?? null);

export const videoRenderRowSchema = reelRenderActivityRowSchema.extend({
  race_id: nullableId,
  flyover_order_id: nullableId,
  width: z.number().int(),
  height: z.number().int(),
  output_size_bytes: z.number().nullable().optional().transform((value) => value ?? null),
  auto_draft: z.boolean().nullable().optional().transform((value) => value ?? false),
});
export type VideoRenderRow = z.infer<typeof videoRenderRowSchema>;
export const VIDEO_RENDER_ROW_COLUMNS = Object.keys(videoRenderRowSchema.shape).join(",");

export const carouselRenderRowSchema = carouselRenderActivityRowSchema.extend({
  race_id: nullableId,
  auto_draft: z.boolean().nullable().optional().transform((value) => value ?? false),
  created_by: nullableId,
});
export type CarouselRenderRow = z.infer<typeof carouselRenderRowSchema>;
export const CAROUSEL_RENDER_ROW_COLUMNS = Object.keys(carouselRenderRowSchema.shape).join(",");

/** `reel_automation_items.render_job_id` and `carousel_automation_items.carousel_job_id`. */
export const reelItemLinkSchema = z.object({ id: z.string(), render_job_id: z.string(), social_post_id: nullableId, planned_publish_date: z.string() });
export const carouselItemLinkSchema = z.object({ id: z.string(), carousel_job_id: z.string(), social_post_id: nullableId, planned_publish_date: z.string() });
export const postLinkSchema = z.object({
  id: z.string(),
  video_job_id: nullableId,
  carousel_job_id: nullableId,
  status: z.string(),
  media_type: z.string().nullable().optional().transform((value) => value ?? "reel"),
  created_at: z.string().optional(),
});
export const flyoverLinkSchema = z.object({ id: z.string(), race_name: z.string(), status: z.string() });
export type ReelItemLink = z.infer<typeof reelItemLinkSchema>;
export type CarouselItemLink = z.infer<typeof carouselItemLinkSchema>;
export type PostLink = z.infer<typeof postLinkSchema>;
export type FlyoverLink = z.infer<typeof flyoverLinkSchema>;

// ---------------------------------------------------------------------------------------------
// Entry

export type RenderLink = { label: string; href: string };

export const adminRenderEntrySchema = z.object({
  id: z.string(),
  /** Source table: `video_render_jobs` (MP4, deletable) or `carousel_render_jobs` (JPEG slides). */
  source: z.enum(["video", "carousel"]),
  type: z.enum(RENDER_TYPES),
  title: z.string(),
  status: z.enum(RENDER_STATUSES),
  /** French line of the stage (« Rendu vidéo · 42 % », « Échec : … »), shared with the Publications screens. */
  stage: z.string(),
  progress: z.number().nullable(),
  message: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sizeBytes: z.number().nullable(),
  slideCount: z.number().nullable(),
  autoDraft: z.boolean(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  origin: z.object({ label: z.string(), href: z.string() }).nullable(),
  post: z.object({ label: z.string(), href: z.string(), status: z.string() }).nullable(),
  downloadUrl: z.string().nullable(),
  canDelete: z.boolean(),
});
export type AdminRenderEntry = z.infer<typeof adminRenderEntrySchema>;

const countsSchema = z.object({
  total: z.number(),
  byType: z.object({ manuel: z.number(), auto: z.number(), survol: z.number(), carrousel: z.number() }),
  byStatus: z.object({ actif: z.number(), termine: z.number(), echec: z.number() }),
});
export type RenderCounts = z.infer<typeof countsSchema>;

export const adminRendersResponseSchema = z.object({
  entries: z.array(adminRenderEntrySchema),
  total: z.number(),
  page: z.number(),
  pageCount: z.number(),
  pageSize: z.number(),
  /** Counts of the period (before the type and status filters), for the chips. */
  counts: countsSchema,
  /** Renders waiting or running, whatever the filters: drives the 5-s refresh. */
  activeCount: z.number(),
  /** The render asked by `?rendu=`, even when the filters or the page hide it. */
  focus: adminRenderEntrySchema.nullable(),
  /** False when Google Cloud is not configured: MP4 links are missing, not the renders. */
  downloadsAvailable: z.boolean(),
});
export type AdminRendersResponse = z.infer<typeof adminRendersResponseSchema>;

export const filterStatusOf = (status: RenderStatus): RenderFilterStatus =>
  status === "en_attente" || status === "en_cours" ? "actif" : status === "termine" ? "termine" : "echec";

export const isActiveRender = (entry: Pick<AdminRenderEntry, "status">) => filterStatusOf(entry.status) === "actif";

/** Console URL of a post (`?post=`): published posts open the « Publiées » tab, carousels their tab. */
export const renderPostHref = (post: { id: string; status: string; media_type: string }) => {
  const params = new URLSearchParams();
  if (post.status === "published") params.set("onglet", "published");
  else if (post.media_type === "carousel") params.set("onglet", "carousels");
  params.set("post", post.id);
  return `/admin/content/posts?${params.toString()}`;
};

const POST_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Programmé",
  publishing: "Publication en cours",
  published: "Publié",
  failed: "Échec de publication",
};

/** Type of a reel render from its columns: a flyover order, a plan item of the automation, else a manual reel. */
export const classifyVideoRender = ({ flyoverOrderId, planItem }: { flyoverOrderId: string | null; planItem: boolean }): RenderType =>
  flyoverOrderId ? "survol" : planItem ? "auto" : "manuel";

const normalizeVideoStatus = (status: VideoRenderRow["status"]): RenderStatus =>
  status === "running" ? "en_cours" : status === "done" ? "termine" : status === "failed" ? "echec" : "en_attente";

const normalizeCarouselStatus = (status: CarouselRenderRow["status"]): RenderStatus =>
  status === "running" ? "en_cours" : status === "done" ? "termine" : status === "failed" ? "echec" : "en_attente";

const pickLatestPost = (posts: PostLink[] | undefined) =>
  posts && posts.length ? [...posts].sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""))[0] : null;

const toPostRef = (post: PostLink | null) =>
  post ? { label: `${post.media_type === "carousel" ? "Carrousel" : "Reel"} · ${POST_STATUS_LABEL[post.status]?.toLowerCase() ?? post.status}`, href: renderPostHref(post), status: post.status } : null;

const groupBy = <T,>(items: T[], key: (item: T) => string | null) => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    if (id) map.set(id, [...(map.get(id) ?? []), item]);
  }
  return map;
};

export type RenderSources = {
  videos: VideoRenderRow[];
  carousels: CarouselRenderRow[];
  reelItems: ReelItemLink[];
  carouselItems: CarouselItemLink[];
  posts: PostLink[];
  flyovers: FlyoverLink[];
};

const itemDayLabel = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** Every render of the sources as one entry (download links and delete rights are added by the loader). */
export const buildRenderEntries = ({ videos, carousels, reelItems, carouselItems, posts, flyovers }: RenderSources): AdminRenderEntry[] => {
  const itemsByJob = groupBy(reelItems, (item) => item.render_job_id);
  const carouselItemsByJob = groupBy(carouselItems, (item) => item.carousel_job_id);
  const postsByVideo = groupBy(posts, (post) => post.video_job_id);
  const postsByCarousel = groupBy(posts, (post) => post.carousel_job_id);
  const flyoverById = new Map(flyovers.map((flyover) => [flyover.id, flyover]));

  const base = (activity: RenderActivity) => ({
    id: activity.id,
    title: activity.title,
    stage: activity.stage,
    progress: activity.progress,
    createdAt: activity.createdAt,
    startedAt: activity.startedAt,
    finishedAt: activity.finishedAt,
    downloadUrl: null,
  });

  const videoEntries = videos.map((row): AdminRenderEntry => {
    const planItem = itemsByJob.get(row.id)?.[0] ?? null;
    const flyover = row.flyover_order_id ? flyoverById.get(row.flyover_order_id) ?? null : null;
    const type = classifyVideoRender({ flyoverOrderId: row.flyover_order_id, planItem: planItem !== null });
    const post = pickLatestPost(postsByVideo.get(row.id)) ?? (planItem?.social_post_id ? posts.find((candidate) => candidate.id === planItem.social_post_id) ?? null : null);
    const origin: AdminRenderEntry["origin"] = type === "survol"
      ? { label: `Commande de survol${flyover ? ` · ${flyover.race_name}` : ""}`, href: `/admin/content/flyovers?commande=${row.flyover_order_id}` }
      : type === "auto" && planItem
        ? { label: `Élément du plan · ${itemDayLabel(planItem.planned_publish_date)}`, href: `/admin/content/posts?element=${planItem.id}` }
        : row.race_id
          ? { label: "Fiche de la course", href: `/admin/catalog/races?course=${row.race_id}` }
          : null;
    const status = normalizeVideoStatus(row.status);
    return {
      ...base(toReelRenderActivity(row)),
      source: "video",
      type,
      status,
      message: row.status === "failed" ? row.message : null,
      width: row.width,
      height: row.height,
      sizeBytes: row.output_size_bytes,
      slideCount: null,
      autoDraft: row.auto_draft,
      origin,
      post: toPostRef(post),
      canDelete: row.status === "done" || row.status === "failed",
    };
  });

  const carouselEntries = carousels.map((row): AdminRenderEntry => {
    const planItem = carouselItemsByJob.get(row.id)?.[0] ?? null;
    const post = pickLatestPost(postsByCarousel.get(row.id)) ?? (planItem?.social_post_id ? posts.find((candidate) => candidate.id === planItem.social_post_id) ?? null : null);
    return {
      ...base(toCarouselRenderActivity(row)),
      source: "carousel",
      type: "carrousel",
      status: normalizeCarouselStatus(row.status),
      message: row.status === "failed" ? row.message : null,
      width: null,
      height: null,
      sizeBytes: null,
      slideCount: row.slide_count,
      autoDraft: row.auto_draft,
      origin: planItem ? { label: `Élément du plan · ${itemDayLabel(planItem.planned_publish_date)}`, href: `/admin/content/posts?onglet=carousels&element=${planItem.id}` } : null,
      post: toPostRef(post),
      canDelete: false,
    };
  });

  return [...videoEntries, ...carouselEntries];
};

// ---------------------------------------------------------------------------------------------
// Query, filters, paging

export type RendersQuery = {
  period: RenderPeriod;
  types: RenderType[];
  statuses: RenderFilterStatus[];
  page: number;
  /** `?rendu=`: the render whose side panel is open. */
  focusId: string | null;
};

export const DEFAULT_RENDERS_QUERY: RendersQuery = { period: "7j", types: [], statuses: [], page: 1, focusId: null };

const readList = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
  Array.from(new Set((value ?? "").split(",").map((part) => part.trim()).filter((part): part is T => (allowed as readonly string[]).includes(part))));

export const readRendersQuery = (params: URLSearchParams): RendersQuery => {
  const period = params.get("periode");
  const page = Number(params.get("page"));
  const focusId = params.get("rendu")?.trim() ?? "";
  return {
    period: (RENDER_PERIODS as readonly string[]).includes(period ?? "") ? (period as RenderPeriod) : DEFAULT_RENDERS_QUERY.period,
    types: readList(params.get("type"), RENDER_TYPES),
    statuses: readList(params.get("statut"), RENDER_FILTER_STATUSES),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    focusId: /^[0-9a-fA-F-]{8,40}$/.test(focusId) ? focusId : null,
  };
};

/** Query string of a query: defaults are left out so a shared URL stays short. */
export const writeRendersQuery = (query: RendersQuery): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.period !== DEFAULT_RENDERS_QUERY.period) params.set("periode", query.period);
  if (query.types.length) params.set("type", query.types.join(","));
  if (query.statuses.length) params.set("statut", query.statuses.join(","));
  if (query.page > 1) params.set("page", String(query.page));
  if (query.focusId) params.set("rendu", query.focusId);
  return params;
};

const inPeriod = (entry: AdminRenderEntry, period: RenderPeriod, nowMs: number) =>
  period === "tout" || isActiveRender(entry) || nowMs - Date.parse(entry.createdAt) <= PERIOD_MS[period];

/** Waiting and running renders first, then the most recent. */
export const sortRenderEntries = (entries: AdminRenderEntry[]) =>
  [...entries].sort((left, right) => Number(isActiveRender(right)) - Number(isActiveRender(left)) || right.createdAt.localeCompare(left.createdAt));

export const countRenders = (entries: AdminRenderEntry[]): RenderCounts => {
  const byType = Object.fromEntries(RENDER_TYPES.map((type) => [type, 0])) as RenderCounts["byType"];
  const byStatus = Object.fromEntries(RENDER_FILTER_STATUSES.map((status) => [status, 0])) as RenderCounts["byStatus"];
  entries.forEach((entry) => {
    byType[entry.type] += 1;
    byStatus[filterStatusOf(entry.status)] += 1;
  });
  return { total: entries.length, byType, byStatus };
};

/** Filters of the query (period, types, statuses), sorted: every render of the list, before paging. */
export const filterRenderEntries = (entries: AdminRenderEntry[], query: Pick<RendersQuery, "period" | "types" | "statuses">, nowMs: number) =>
  sortRenderEntries(entries.filter((entry) =>
    inPeriod(entry, query.period, nowMs)
    && (query.types.length === 0 || query.types.includes(entry.type))
    && (query.statuses.length === 0 || query.statuses.includes(filterStatusOf(entry.status)))));

export const paginateRenders = <T,>(items: T[], page: number, pageSize = RENDERS_PAGE_SIZE) => {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, pageSize, total: items.length };
};

/** Entries of the period (before type and status), for the chip counts. */
export const periodEntries = (entries: AdminRenderEntry[], period: RenderPeriod, nowMs: number) =>
  entries.filter((entry) => inPeriod(entry, period, nowMs));

// ---------------------------------------------------------------------------------------------
// Display helpers

/** "6 min 12 s" between two timestamps, or null when one is missing. */
export const formatRenderDuration = (from: string | null | undefined, to: string | null | undefined) => {
  const ms = from && to ? Date.parse(to) - Date.parse(from) : Number.NaN;
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.round(ms / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  return minutes ? `${minutes} min ${String(seconds % 60).padStart(2, "0")} s` : `${seconds % 60} s`;
};

/** Duration shown in the list: computing time of a finished render, time so far for an active one. */
export const describeRenderDuration = (entry: Pick<AdminRenderEntry, "status" | "createdAt" | "startedAt" | "finishedAt">, nowMs: number) => {
  if (entry.finishedAt) return formatRenderDuration(entry.startedAt ?? entry.createdAt, entry.finishedAt);
  if (isActiveRender(entry)) return formatRenderDuration(entry.startedAt ?? entry.createdAt, new Date(nowMs).toISOString());
  return null;
};

export const formatRenderSize = (bytes: number | null) => (bytes ? `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} Mo` : null);

export const renderStatusTone = (status: RenderStatus) =>
  status === "echec" ? "danger" as const : status === "termine" ? "success" as const : status === "en_cours" ? "info" as const : "neutral" as const;

/** Console URL of the render queue opened on one render. */
export const renderQueueHref = (renderId?: string) => (renderId ? `/admin/content/renders?rendu=${encodeURIComponent(renderId)}` : "/admin/content/renders");

/** Page of the list, chip counts, active count and the focused render, from every entry loaded. */
export const buildRendersPage = (entries: AdminRenderEntry[], query: RendersQuery, nowMs: number) => ({
  page: paginateRenders(filterRenderEntries(entries, query, nowMs), query.page),
  counts: countRenders(periodEntries(entries, query.period, nowMs)),
  activeCount: entries.filter(isActiveRender).length,
  focus: query.focusId ? entries.find((entry) => entry.id === query.focusId) ?? null : null,
});

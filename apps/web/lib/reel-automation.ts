import { z } from "zod";

import {
  addDays,
  DEFAULT_REEL_LEAD_DAYS,
  DEFAULT_REEL_MAX_PER_DAY,
  DEFAULT_REEL_MAX_PER_WEEK,
  DEFAULT_REEL_PUBLISH_TIME,
  hasPriorReel,
  parisToday,
  planReels,
  type PlannerFormat,
  type PlannerLockedItem,
  type PlannerPriorReel,
  type ReelPlan,
} from "./reel-planner";
import { carouselWeekdays } from "./carousels/carousel-planner";
import { PARIS_TIME_ZONE } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Automatic reel pipeline: settings, items, plan refresh and the executor tick driven by
 * /api/cron/reel-automation. Rules: docs/05-integrations/reel-automation.md.
 */

export const REEL_AUTOMATION_STATUSES = ["planned", "generating", "rendering", "drafted", "scheduled", "skipped", "failed"] as const;
export type ReelAutomationStatus = (typeof REEL_AUTOMATION_STATUSES)[number];
export const REEL_AUTOMATION_STEPS = ["content", "voice", "render"] as const;
export type ReelAutomationStep = (typeof REEL_AUTOMATION_STEPS)[number];
export const REEL_AUTOMATION_REASONS = ["too_late", "duplicate", "excluded", "ineligible"] as const;
export type ReelAutomationReason = (typeof REEL_AUTOMATION_REASONS)[number];

/** Attempts of one step before the item fails (one per tick, hourly). */
export const REEL_AUTOMATION_MAX_ATTEMPTS = 3;
/** A step runs under a lease longer than the function limit, so two ticks never run the same item. */
export const REEL_AUTOMATION_LEASE_MS = 10 * 60 * 1_000;

export const reelAutomationSettingsSchema = z.object({
  generation_enabled: z.boolean(),
  auto_publish_enabled: z.boolean(),
  max_per_week: z.number().int(),
  max_per_day: z.number().int(),
  lead_days: z.number().int(),
  publish_time: z.string(),
  updated_by: z.string().uuid().nullable(),
  updated_at: z.string(),
  // One switch per carousel series (docs/05-integrations/instagram-carousels.md), off by default.
  plan_carousel_enabled: z.boolean().optional().default(false),
  brief_carousel_enabled: z.boolean().optional().default(false),
  week_carousel_enabled: z.boolean().optional().default(false),
});
export type ReelAutomationSettings = z.infer<typeof reelAutomationSettingsSchema>;

export const DEFAULT_REEL_AUTOMATION_SETTINGS: ReelAutomationSettings = {
  generation_enabled: false,
  auto_publish_enabled: false,
  max_per_week: DEFAULT_REEL_MAX_PER_WEEK,
  max_per_day: DEFAULT_REEL_MAX_PER_DAY,
  lead_days: DEFAULT_REEL_LEAD_DAYS,
  publish_time: `${DEFAULT_REEL_PUBLISH_TIME}:00`,
  updated_by: null,
  updated_at: new Date(0).toISOString(),
  plan_carousel_enabled: false,
  brief_carousel_enabled: false,
  week_carousel_enabled: false,
};

/** Carousel series whose switch is on. */
export const enabledCarouselSeries = (settings: Pick<ReelAutomationSettings, "plan_carousel_enabled" | "brief_carousel_enabled" | "week_carousel_enabled">) => [
  ...(settings.plan_carousel_enabled ? ["plan" as const] : []),
  ...(settings.brief_carousel_enabled ? ["brief" as const] : []),
  ...(settings.week_carousel_enabled ? ["week" as const] : []),
];

export const reelAutomationItemSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid(),
  edition_key: z.string(),
  mode: z.enum(["full", "highlights"]),
  planned_publish_date: z.string(),
  status: z.enum(REEL_AUTOMATION_STATUSES),
  step: z.enum(REEL_AUTOMATION_STEPS).nullable(),
  attempts: z.number().int(),
  error: z.string().nullable(),
  reason: z.enum(REEL_AUTOMATION_REASONS).nullable(),
  work: z.record(z.string(), z.unknown()).nullable(),
  render_job_id: z.string().uuid().nullable(),
  social_post_id: z.string().uuid().nullable(),
  locked_until: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  races: z.object({ name: z.string() }).nullable().optional(),
});
export type ReelAutomationItem = z.infer<typeof reelAutomationItemSchema>;

const ITEM_COLUMNS = "id,race_id,edition_key,mode,planned_publish_date,status,step,attempts,error,reason,work,render_job_id,social_post_id,locked_until,created_at,updated_at,races(name)";
const SETTINGS_COLUMNS = "generation_enabled,auto_publish_enabled,max_per_week,max_per_day,lead_days,publish_time,updated_by,updated_at,plan_carousel_enabled,brief_carousel_enabled,week_carousel_enabled";

/** "18:00:00" → "18:00". */
export const formatPublishTime = (value: string) => value.slice(0, 5);

/** Planned items and the automatic skips are recomputed at every tick; the rest is locked. */
export const isRecomputable = (item: Pick<ReelAutomationItem, "status" | "reason">) =>
  item.status === "planned" || (item.status === "skipped" && (item.reason === "too_late" || item.reason === "duplicate"));

/** Settings and items as the Publications page shows them (no step data). */
export type PublicReelAutomation = ReturnType<typeof toPublicAutomation>;
export type PublicReelAutomationItem = PublicReelAutomation["items"][number];

export const toPublicAutomation = (settings: ReelAutomationSettings, items: ReelAutomationItem[]) => ({
  settings: {
    generationEnabled: settings.generation_enabled,
    autoPublishEnabled: settings.auto_publish_enabled,
    maxPerWeek: settings.max_per_week,
    maxPerDay: settings.max_per_day,
    leadDays: settings.lead_days,
    publishTime: formatPublishTime(settings.publish_time),
    updatedAt: settings.updated_at,
    carousels: {
      plan: settings.plan_carousel_enabled,
      brief: settings.brief_carousel_enabled,
      week: settings.week_carousel_enabled,
    },
  },
  items: items.map((item) => ({
    id: item.id,
    raceId: item.race_id,
    raceName: item.races?.name ?? null,
    mode: item.mode,
    plannedPublishDate: item.planned_publish_date,
    generateOn: getGenerateOn(item, settings),
    status: item.status,
    step: item.step,
    attempts: item.attempts,
    error: item.error,
    reason: item.reason,
    renderJobId: item.render_job_id,
    socialPostId: item.social_post_id,
  })),
});

// -- Repositories ------------------------------------------------------------------------------

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

export type ReelAutomationRepository = {
  getSettings: () => Promise<ReelAutomationSettings>;
  updateSettings: (patch: Partial<ReelAutomationSettings>) => Promise<ReelAutomationSettings>;
  listItems: () => Promise<ReelAutomationItem[]>;
  getItem: (id: string) => Promise<ReelAutomationItem | null>;
  /** Inserts new items; an existing (race, edition) is left untouched (unique constraint). */
  insertItems: (rows: Record<string, unknown>[]) => Promise<void>;
  /** Guarded update: applied only when the row matches `filter` (PostgREST query string). */
  updateItem: (id: string, patch: Record<string, unknown>, filter?: string) => Promise<ReelAutomationItem | null>;
  deleteItems: (ids: string[], filter: string) => Promise<void>;
  /** Takes the lease of a due item (planned or generating, lease free); null when another tick holds it. */
  claimItem: (id: string, now: Date, until: Date) => Promise<ReelAutomationItem | null>;
};

const parseItems = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`Unable to ${action} reel automation items (${response.status}).`);
  return z.array(reelAutomationItemSchema).parse(await response.json());
};

export const createReelAutomationRepository = (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch): ReelAutomationRepository => {
  const settingsUrl = `${supabase.supabaseUrl}/rest/v1/reel_automation_settings`;
  const itemsUrl = `${supabase.supabaseUrl}/rest/v1/reel_automation_items`;
  const patchItems = async (query: string, body: Record<string, unknown>) =>
    parseItems(await fetcher(`${itemsUrl}?${query}&select=${ITEM_COLUMNS}`, {
      method: "PATCH",
      headers: headers(supabase, { Prefer: "return=representation" }),
      body: JSON.stringify(body),
      cache: "no-store",
    }), "update");
  return {
    getSettings: async () => {
      const response = await fetcher(`${settingsUrl}?id=eq.true&select=${SETTINGS_COLUMNS}&limit=1`, { headers: headers(supabase), cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to read reel automation settings (${response.status}).`);
      return z.array(reelAutomationSettingsSchema).parse(await response.json())[0] ?? DEFAULT_REEL_AUTOMATION_SETTINGS;
    },
    updateSettings: async (patch) => {
      const response = await fetcher(`${settingsUrl}?on_conflict=id&select=${SETTINGS_COLUMNS}`, {
        method: "POST",
        headers: headers(supabase, { Prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify({ id: true, ...patch }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to save reel automation settings (${response.status}).`);
      return z.array(reelAutomationSettingsSchema).parse(await response.json())[0];
    },
    listItems: async () => parseItems(await fetcher(`${itemsUrl}?select=${ITEM_COLUMNS}&order=planned_publish_date.asc,race_id.asc&limit=1000`, {
      headers: headers(supabase), cache: "no-store",
    }), "list"),
    getItem: async (id) => (await parseItems(await fetcher(`${itemsUrl}?id=eq.${id}&select=${ITEM_COLUMNS}&limit=1`, {
      headers: headers(supabase), cache: "no-store",
    }), "read"))[0] ?? null,
    insertItems: async (rows) => {
      if (!rows.length) return;
      const response = await fetcher(`${itemsUrl}?on_conflict=race_id,edition_key`, {
        method: "POST",
        headers: headers(supabase, { Prefer: "resolution=ignore-duplicates,return=minimal" }),
        body: JSON.stringify(rows),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to insert reel automation items (${response.status}).`);
    },
    updateItem: async (id, body, filter) => (await patchItems(`id=eq.${id}${filter ? `&${filter}` : ""}`, body))[0] ?? null,
    deleteItems: async (ids, filter) => {
      if (!ids.length) return;
      const response = await fetcher(`${itemsUrl}?id=in.(${ids.join(",")})&${filter}`, {
        method: "DELETE",
        headers: headers(supabase, { Prefer: "return=minimal" }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to delete reel automation items (${response.status}).`);
    },
    claimItem: async (id, now, until) => (await patchItems(
      `id=eq.${id}&status=in.(planned,generating)&or=(locked_until.is.null,locked_until.lt.${encodeURIComponent(now.toISOString())})`,
      { status: "generating", locked_until: until.toISOString() },
    ))[0] ?? null,
  };
};

// -- Catalog read for the planner --------------------------------------------------------------

const catalogRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.coerce.number(),
  is_live: z.boolean().nullable(),
  gpx_storage_path: z.string().nullable(),
  race_date: z.string().nullable(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable(),
  race_events: z.object({ name: z.string().nullable(), race_date: z.string().nullable() }).nullable().optional(),
  edition: z.object({ start_date: z.string().nullable() }).nullable().optional(),
});

const reelRowSchema = z.object({ race_id: z.string().uuid().nullable(), created_at: z.string() });
const scheduledPostSchema = z.object({ id: z.string().uuid(), scheduled_at: z.string().nullable() });

export type PlannerCatalog = {
  formats: PlannerFormat[];
  priorReels: PlannerPriorReel[];
  scheduledPosts: Array<{ id: string; scheduledAt: string }>;
  /** Days of the automatic carousels still waiting for their slot (they take the day). */
  carouselDates?: string[];
};

/** Paris calendar day of an instant. */
export const toParisDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: PARIS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/**
 * The live formats that can qualify (GPX, 30 km or more: filtered here to keep the read small, and
 * checked again by the planner), their aid station counts, the non-failed renders and posts of
 * those races, and the scheduled posts (they take a day in the caps).
 */
export const loadPlannerCatalog = async (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch): Promise<PlannerCatalog> => {
  const get = async (path: string) => {
    const response = await fetcher(`${supabase.supabaseUrl}/rest/v1/${path}`, { headers: headers(supabase), cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to read the reel catalog (${response.status}).`);
    return response.json();
  };
  const races = z.array(catalogRaceSchema).parse(await get(
    "races?is_live=eq.true&gpx_storage_path=not.is.null&distance_km=gte.30"
    + "&select=id,name,distance_km,is_live,gpx_storage_path,race_date,event_id,edition_id,race_events(name,race_date),edition:race_event_editions!races_edition_id_fkey(start_date)&limit=2000",
  ));
  const ids = races.map((race) => race.id);
  const inIds = `race_id=in.(${ids.join(",")})`;
  const [jobs, posts, scheduled] = ids.length
    ? await Promise.all([
      get(`video_render_jobs?${inIds}&status=neq.failed&select=race_id,created_at&limit=5000`),
      // A carousel of the race is not a reel: it never blocks its reel.
      get(`social_posts?${inIds}&status=neq.failed&media_type=eq.reel&select=race_id,created_at&limit=5000`),
      get("social_posts?status=in.(scheduled,publishing)&scheduled_at=not.is.null&select=id,scheduled_at&limit=1000"),
    ])
    : [[], [], await get("social_posts?status=in.(scheduled,publishing)&scheduled_at=not.is.null&select=id,scheduled_at&limit=1000")];
  const carouselSlots = z.array(z.object({ planned_publish_date: z.string() }))
    .parse(await get("carousel_automation_items?status=in.(planned,generating,rendering,drafted)&select=planned_publish_date&limit=1000"));
  const priorReels = [...z.array(reelRowSchema).parse(jobs), ...z.array(reelRowSchema).parse(posts)]
    .flatMap((row) => (row.race_id ? [{ raceId: row.race_id, createdAt: row.created_at }] : []));
  return {
    formats: races.map((race) => ({
      raceId: race.id,
      name: race.name,
      distanceKm: race.distance_km,
      isLive: Boolean(race.is_live),
      hasGpx: Boolean(race.gpx_storage_path),
      raceDate: race.race_date,
      editionStartDate: race.edition?.start_date ?? null,
      eventDate: race.race_events?.race_date ?? null,
      eventId: race.event_id,
      editionId: race.edition_id,
      eventName: race.race_events?.name ?? null,
    })),
    priorReels,
    scheduledPosts: z.array(scheduledPostSchema).parse(scheduled).flatMap((row) => (row.scheduled_at ? [{ id: row.id, scheduledAt: row.scheduled_at }] : [])),
    carouselDates: carouselSlots.map((row) => row.planned_publish_date.slice(0, 10)),
  };
};

/** Non-failed renders and posts of one race, except the item's own (the duplicate guard before a step). */
export const loadRaceReels = async (
  supabase: SupabaseServiceConfig,
  raceId: string,
  own: { renderJobId: string | null; socialPostId: string | null },
  fetcher: typeof fetch = fetch,
): Promise<PlannerPriorReel[]> => {
  const read = async (table: string, ownId: string | null) => {
    const response = await fetcher(
      `${supabase.supabaseUrl}/rest/v1/${table}?race_id=eq.${raceId}&status=neq.failed${table === "social_posts" ? "&media_type=eq.reel" : ""}${ownId ? `&id=neq.${ownId}` : ""}&select=race_id,created_at&limit=100`,
      { headers: headers(supabase), cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Unable to read the reels of a race (${response.status}).`);
    return z.array(reelRowSchema).parse(await response.json());
  };
  const [jobs, posts] = await Promise.all([read("video_render_jobs", own.renderJobId), read("social_posts", own.socialPostId)]);
  return [...jobs, ...posts].map((row) => ({ raceId, createdAt: row.created_at }));
};

// -- Plan refresh (pure diff) --------------------------------------------------------------------

export type PlanChanges = {
  inserts: Array<Record<string, unknown>>;
  updates: Array<{ id: string; patch: Record<string, unknown> }>;
  deletes: string[];
};

/** Items the planner keeps as they are (in flight, done, excluded, failed). */
export const toLockedItems = (items: ReelAutomationItem[]): PlannerLockedItem[] =>
  items.filter((item) => !isRecomputable(item)).map((item) => ({
    raceId: item.race_id,
    editionKey: item.edition_key,
    plannedPublishDate: item.planned_publish_date,
    status: item.status as PlannerLockedItem["status"],
  }));

/**
 * What to write so the stored items match the plan: new rows inserted, recomputable rows updated
 * when their day, mode or skip reason changed, and recomputable rows no longer in the plan deleted
 * (the format became ineligible). Locked rows are never touched.
 */
export const diffPlan = (items: ReelAutomationItem[], plan: ReelPlan): PlanChanges => {
  const byKey = new Map(items.map((item) => [`${item.race_id}|${item.edition_key}`, item]));
  const wanted = [
    ...plan.planned.map((entry) => ({ key: `${entry.raceId}|${entry.editionKey}`, row: { race_id: entry.raceId, edition_key: entry.editionKey, mode: entry.mode, planned_publish_date: entry.plannedPublishDate, status: "planned", reason: null } })),
    ...plan.skipped.map((entry) => ({ key: `${entry.raceId}|${entry.editionKey}`, row: { race_id: entry.raceId, edition_key: entry.editionKey, mode: entry.mode, planned_publish_date: entry.targetDate, status: "skipped", reason: entry.reason } })),
  ];
  const changes: PlanChanges = { inserts: [], updates: [], deletes: [] };
  const seen = new Set<string>();
  for (const { key, row } of wanted) {
    seen.add(key);
    const existing = byKey.get(key);
    if (!existing) {
      changes.inserts.push(row);
      continue;
    }
    if (!isRecomputable(existing)) continue;
    if (existing.status !== row.status || existing.reason !== row.reason || existing.mode !== row.mode || existing.planned_publish_date !== row.planned_publish_date) {
      changes.updates.push({ id: existing.id, patch: { status: row.status, reason: row.reason, mode: row.mode, planned_publish_date: row.planned_publish_date, error: null } });
    }
  }
  items.forEach((item) => {
    if (isRecomputable(item) && !seen.has(`${item.race_id}|${item.edition_key}`)) changes.deletes.push(item.id);
  });
  return changes;
};

/** Planner caps and lead time from the settings; reels avoid the weekdays of the enabled carousel series. */
export const plannerOptionsFrom = (settings: ReelAutomationSettings, today: string, occupiedDates: string[]) => ({
  today,
  leadDays: settings.lead_days,
  maxPerWeek: settings.max_per_week,
  maxPerDay: settings.max_per_day,
  occupiedDates,
  blockedWeekdays: carouselWeekdays(enabledCarouselSeries(settings)),
});

/** The plan for today: catalog, prior reels, locked items and the days other scheduled posts take. */
export const computePlan = (catalog: PlannerCatalog, items: ReelAutomationItem[], settings: ReelAutomationSettings, today: string) => {
  const automationPosts = new Set(items.flatMap((item) => (item.social_post_id ? [item.social_post_id] : [])));
  const occupiedDates = [
    ...catalog.scheduledPosts.filter((post) => !automationPosts.has(post.id)).map((post) => toParisDay(post.scheduledAt)),
    ...(catalog.carouselDates ?? []),
  ];
  return planReels(catalog.formats, catalog.priorReels, toLockedItems(items), plannerOptionsFrom(settings, today, occupiedDates));
};

// -- Executor --------------------------------------------------------------------------------------

/** Thrown by a step when the race can never be generated automatically (marked skipped, not failed). */
export class ReelAutomationSkip extends Error {}

export type ReelWork = Record<string, unknown>;

export type ReelRenderJobState = { id: string; status: string; message: string | null; created_at: string; updated_at: string; finished_at: string | null };

export type ReelAutomationDeps = {
  now: () => Date;
  repository: ReelAutomationRepository;
  loadCatalog: () => Promise<PlannerCatalog>;
  /** Non-failed renders and posts of the race other than the item's own. */
  loadRaceReels: (item: ReelAutomationItem) => Promise<PlannerPriorReel[]>;
  steps: {
    content: (item: ReelAutomationItem, settings: ReelAutomationSettings) => Promise<ReelWork>;
    voice: (item: ReelAutomationItem, work: ReelWork, settings: ReelAutomationSettings) => Promise<ReelWork>;
    render: (item: ReelAutomationItem, work: ReelWork, settings: ReelAutomationSettings) => Promise<string>;
  };
  getRenderJobs: (ids: string[]) => Promise<Map<string, ReelRenderJobState>>;
  isRenderJobStale: (job: ReelRenderJobState, nowMs: number) => boolean;
  /** The render's automatic draft (created by the completion route; created here if it is missing). */
  ensureAutoDraft: (renderJobId: string) => Promise<{ id: string } | null>;
  /** Schedules a draft at a Paris wall time (`YYYY-MM-DDTHH:mm`) through the publications rule. */
  schedulePost: (postId: string, localDateTime: string) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export type ReelAutomationTickResult = {
  generationEnabled: boolean;
  plan: { planned: number; skipped: number; inserted: number; updated: number; deleted: number };
  tracked: Array<{ id: string; outcome: string }>;
  advanced: { id: string; step: string; outcome: string } | null;
};

const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : "Erreur inconnue.").slice(0, 1_000);

/** Recomputes the plan and writes the differences. Runs whatever the switches. */
export const refreshReelPlan = async (deps: ReelAutomationDeps, settings: ReelAutomationSettings, today: string) => {
  const [catalog, items] = await Promise.all([deps.loadCatalog(), deps.repository.listItems()]);
  const plan = computePlan(catalog, items, settings, today);
  const changes = diffPlan(items, plan);
  await deps.repository.insertItems(changes.inserts);
  for (const update of changes.updates) {
    // Guarded: an item claimed meanwhile is no longer recomputable and keeps its state.
    await deps.repository.updateItem(update.id, update.patch, "or=(status.eq.planned,and(status.eq.skipped,reason.in.(too_late,duplicate)))");
  }
  await deps.repository.deleteItems(changes.deletes, "or=(status.eq.planned,and(status.eq.skipped,reason.in.(too_late,duplicate)))");
  return {
    planned: plan.planned.length,
    skipped: plan.skipped.length,
    inserted: changes.inserts.length,
    updated: changes.updates.length,
    deleted: changes.deletes.length,
  };
};

/** Paris wall time of the planned publication: the planned day at the publish time. */
export const getPlannedPublishLocal = (item: Pick<ReelAutomationItem, "planned_publish_date">, settings: Pick<ReelAutomationSettings, "publish_time">) =>
  `${item.planned_publish_date}T${formatPublishTime(settings.publish_time)}`;

/**
 * Renders in flight: a finished one links its automatic draft (the item becomes `drafted`), a
 * failed, deleted or silent one fails the item. With automatic publication on, a linked draft is
 * then scheduled at its planned slot. In-flight renders are followed even when generation is off.
 */
export const trackReelRenders = async (deps: ReelAutomationDeps, settings: ReelAutomationSettings, items: ReelAutomationItem[]) => {
  const outcomes: Array<{ id: string; outcome: string }> = [];
  const rendering = items.filter((item) => item.status === "rendering" && item.render_job_id);
  const jobs = rendering.length ? await deps.getRenderJobs(rendering.map((item) => item.render_job_id as string)) : new Map<string, ReelRenderJobState>();
  const nowMs = deps.now().getTime();
  const drafted: ReelAutomationItem[] = items.filter((item) => item.status === "drafted" && item.social_post_id);

  for (const item of rendering) {
    const job = jobs.get(item.render_job_id as string);
    const guard = "status=eq.rendering";
    if (!job) {
      await deps.repository.updateItem(item.id, { status: "failed", error: "Le rendu a été supprimé." }, guard);
      outcomes.push({ id: item.id, outcome: "failed" });
    } else if (job.status === "failed") {
      await deps.repository.updateItem(item.id, { status: "failed", error: `Rendu en échec : ${job.message ?? "raison inconnue"}`.slice(0, 1_000) }, guard);
      outcomes.push({ id: item.id, outcome: "failed" });
    } else if (job.status === "done") {
      const draft = await deps.ensureAutoDraft(job.id).catch(() => null);
      if (!draft) {
        outcomes.push({ id: item.id, outcome: "waiting_draft" });
        continue;
      }
      const updated = await deps.repository.updateItem(item.id, { status: "drafted", social_post_id: draft.id, error: null }, guard);
      if (updated) drafted.push(updated);
      outcomes.push({ id: item.id, outcome: "drafted" });
    } else if (deps.isRenderJobStale(job, nowMs)) {
      await deps.repository.updateItem(item.id, { status: "failed", error: "Le rendu ne donne plus de nouvelles." }, guard);
      outcomes.push({ id: item.id, outcome: "failed" });
    }
  }

  if (settings.generation_enabled && settings.auto_publish_enabled) {
    for (const item of drafted) {
      const result = await deps.schedulePost(item.social_post_id as string, getPlannedPublishLocal(item, settings))
        .catch((error: unknown) => ({ ok: false as const, message: errorText(error) }));
      if (result.ok) {
        await deps.repository.updateItem(item.id, { status: "scheduled", error: null }, "status=eq.drafted");
        outcomes.push({ id: item.id, outcome: "scheduled" });
      } else if (item.error !== `Programmation automatique impossible : ${result.message}`) {
        // Left as a draft to review by hand; the message is written once.
        await deps.repository.updateItem(item.id, { error: `Programmation automatique impossible : ${result.message}`.slice(0, 1_000) }, "status=eq.drafted");
        outcomes.push({ id: item.id, outcome: "schedule_failed" });
      }
    }
  }
  return outcomes;
};

/** Generation starts `lead_days` before the planned publication day. */
export const getGenerateOn = (item: Pick<ReelAutomationItem, "planned_publish_date">, settings: Pick<ReelAutomationSettings, "lead_days">) =>
  addDays(item.planned_publish_date, -settings.lead_days);

/** Due items (planned or mid-generation, lease free), the earliest publication first. */
export const pickDueItem = (items: ReelAutomationItem[], settings: ReelAutomationSettings, today: string, now: Date) =>
  items
    .filter((item) => (item.status === "planned" || item.status === "generating")
      && getGenerateOn(item, settings) <= today
      && (!item.locked_until || Date.parse(item.locked_until) < now.getTime()))
    .sort((left, right) => left.planned_publish_date.localeCompare(right.planned_publish_date) || left.race_id.localeCompare(right.race_id))[0] ?? null;

/** Rule 6 again right before generating: the window starts 180 days before the planned day. */
const hasOtherReel = async (deps: ReelAutomationDeps, item: ReelAutomationItem) =>
  hasPriorReel(item.race_id, item.planned_publish_date, await deps.loadRaceReels(item));

/**
 * One step of one due item: content (AI text), then voice + saved narration, then snapshot +
 * render launch. Each step is idempotent from its stored state, runs under a lease and is retried
 * at the next tick on failure, up to REEL_AUTOMATION_MAX_ATTEMPTS.
 */
export const advanceReelItem = async (deps: ReelAutomationDeps, settings: ReelAutomationSettings, items: ReelAutomationItem[], today: string) => {
  const now = deps.now();
  const due = pickDueItem(items, settings, today, now);
  if (!due) return null;
  const claimed = await deps.repository.claimItem(due.id, now, new Date(now.getTime() + REEL_AUTOMATION_LEASE_MS));
  if (!claimed) return { id: due.id, step: due.step ?? "content", outcome: "busy" };
  const step: ReelAutomationStep = claimed.step ?? "content";
  const guard = "status=eq.generating";
  const work: ReelWork = claimed.work ?? {};

  try {
    if ((step === "content" || step === "render") && await hasOtherReel(deps, claimed)) {
      await deps.repository.updateItem(claimed.id, { status: "skipped", reason: "duplicate", step: null, locked_until: null, error: "Un reel existe déjà pour cette course." }, guard);
      return { id: claimed.id, step, outcome: "duplicate" };
    }
    if (step === "content") {
      const next = await deps.steps.content(claimed, settings);
      await deps.repository.updateItem(claimed.id, { work: next, step: "voice", attempts: 0, error: null, locked_until: null }, guard);
      return { id: claimed.id, step, outcome: "done" };
    }
    if (step === "voice") {
      const next = await deps.steps.voice(claimed, work, settings);
      await deps.repository.updateItem(claimed.id, { work: next, step: "render", attempts: 0, error: null, locked_until: null }, guard);
      return { id: claimed.id, step, outcome: "done" };
    }
    const jobId = await deps.steps.render(claimed, work, settings);
    await deps.repository.updateItem(claimed.id, { status: "rendering", render_job_id: jobId, step: null, attempts: 0, error: null, locked_until: null }, guard);
    return { id: claimed.id, step, outcome: "done" };
  } catch (error) {
    if (error instanceof ReelAutomationSkip) {
      await deps.repository.updateItem(claimed.id, { status: "skipped", reason: "ineligible", step: null, locked_until: null, error: errorText(error) }, guard);
      return { id: claimed.id, step, outcome: "skipped" };
    }
    const attempts = claimed.attempts + 1;
    const failed = attempts >= REEL_AUTOMATION_MAX_ATTEMPTS;
    console.error("Reel automation step failed", step, errorText(error));
    await deps.repository.updateItem(claimed.id, {
      step,
      attempts,
      error: errorText(error),
      locked_until: null,
      ...(failed ? { status: "failed" } : {}),
    }, guard);
    return { id: claimed.id, step, outcome: failed ? "failed" : "retry" };
  }
};

/**
 * One cron tick: recompute the plan (always), follow the renders in flight, then, only when
 * generation is on, advance one step of at most one due item.
 */
export const runReelAutomationTick = async (deps: ReelAutomationDeps): Promise<ReelAutomationTickResult> => {
  const settings = await deps.repository.getSettings();
  const today = parisToday(deps.now());
  const plan = await refreshReelPlan(deps, settings, today);
  const tracked = await trackReelRenders(deps, settings, await deps.repository.listItems());
  if (!settings.generation_enabled) return { generationEnabled: false, plan, tracked, advanced: null };
  const advanced = await advanceReelItem(deps, settings, await deps.repository.listItems(), today);
  return { generationEnabled: true, plan, tracked, advanced };
};

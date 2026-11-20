import { z } from "zod";

import { enabledCarouselSeries, formatPublishTime, type ReelAutomationSettings } from "../reel-automation";
import { addDays, parisToday } from "../reel-planner";
import type { SupabaseServiceConfig } from "../supabase";
import type { CarouselCatalog } from "./carousel-data";
import {
  CAROUSEL_HORIZON_DAYS,
  CAROUSEL_SERIES_WEEKDAY,
  planCarousels,
  slotDays,
  type CarouselLockedSlot,
  type CarouselSlot,
} from "./carousel-planner";
import { CAROUSEL_SERIES, type CarouselSeries } from "./carousel-snapshot";

/**
 * Automatic carousels: weekly slots (`carousel_automation_items`), refreshed and advanced by
 * /api/cron/carousel-automation with the reel automation's switches plus one switch per series.
 * Rules: docs/05-integrations/instagram-carousels.md (« Planning », « Executor »).
 */

export const CAROUSEL_ITEM_STATUSES = ["planned", "generating", "rendering", "drafted", "scheduled", "skipped", "failed"] as const;
export const CAROUSEL_ITEM_STEPS = ["content", "render"] as const;
export const CAROUSEL_ITEM_REASONS = ["too_late", "no_candidate", "occupied", "duplicate", "excluded", "ineligible"] as const;
export const CAROUSEL_MAX_ATTEMPTS = 3;
export const CAROUSEL_LEASE_MS = 10 * 60 * 1_000;

const RECOMPUTED_REASONS = new Set(["too_late", "no_candidate", "occupied"]);

export const carouselItemSchema = z.object({
  id: z.string().uuid(),
  series: z.enum(CAROUSEL_SERIES),
  planned_publish_date: z.string(),
  race_id: z.string().uuid().nullable(),
  edition_key: z.string().nullable(),
  week_start: z.string().nullable(),
  status: z.enum(CAROUSEL_ITEM_STATUSES),
  step: z.enum(CAROUSEL_ITEM_STEPS).nullable(),
  attempts: z.number().int(),
  error: z.string().nullable(),
  reason: z.enum(CAROUSEL_ITEM_REASONS).nullable(),
  work: z.record(z.string(), z.unknown()).nullable(),
  carousel_job_id: z.string().uuid().nullable(),
  social_post_id: z.string().uuid().nullable(),
  locked_until: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  races: z.object({ name: z.string() }).nullable().optional(),
});
export type CarouselItem = z.infer<typeof carouselItemSchema>;

const ITEM_COLUMNS = "id,series,planned_publish_date,race_id,edition_key,week_start,status,step,attempts,error,reason,work,carousel_job_id,social_post_id,locked_until,created_at,updated_at,races(name)";
const RECOMPUTABLE_FILTER = "or=(status.eq.planned,and(status.eq.skipped,reason.in.(too_late,no_candidate,occupied)))";

/** Planned slots and automatic skips are recomputed; everything else is kept. */
export const isRecomputableCarousel = (item: Pick<CarouselItem, "status" | "reason">) =>
  item.status === "planned" || (item.status === "skipped" && item.reason !== null && RECOMPUTED_REASONS.has(item.reason));

export const toPublicCarouselItems = (items: CarouselItem[], settings: Pick<ReelAutomationSettings, "lead_days">) => items.map((item) => ({
  id: item.id,
  series: item.series,
  plannedPublishDate: item.planned_publish_date,
  generateOn: addDays(item.planned_publish_date, -settings.lead_days),
  raceId: item.race_id,
  raceName: item.races?.name ?? null,
  weekStart: item.week_start,
  status: item.status,
  step: item.step,
  attempts: item.attempts,
  error: item.error,
  reason: item.reason,
  carouselJobId: item.carousel_job_id,
  socialPostId: item.social_post_id,
}));
export type PublicCarouselItem = ReturnType<typeof toPublicCarouselItems>[number];

// -- Repository ---------------------------------------------------------------------------------

export type CarouselItemRepository = {
  list: () => Promise<CarouselItem[]>;
  get: (id: string) => Promise<CarouselItem | null>;
  insert: (rows: Record<string, unknown>[]) => Promise<void>;
  update: (id: string, patch: Record<string, unknown>, filter?: string) => Promise<CarouselItem | null>;
  remove: (ids: string[], filter: string) => Promise<void>;
  claim: (id: string, now: Date, until: Date) => Promise<CarouselItem | null>;
};

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const parseItems = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`Unable to ${action} carousel automation items (${response.status}).`);
  return z.array(carouselItemSchema).parse(await response.json());
};

export const createCarouselItemRepository = (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch): CarouselItemRepository => {
  const base = `${supabase.supabaseUrl}/rest/v1/carousel_automation_items`;
  const patch = async (query: string, body: Record<string, unknown>) => parseItems(await fetcher(`${base}?${query}&select=${ITEM_COLUMNS}`, {
    method: "PATCH", headers: headers(supabase, { Prefer: "return=representation" }), body: JSON.stringify(body), cache: "no-store",
  }), "update");
  return {
    list: async () => parseItems(await fetcher(`${base}?select=${ITEM_COLUMNS}&order=planned_publish_date.asc,series.asc&limit=1000`, { headers: headers(supabase), cache: "no-store" }), "list"),
    get: async (id) => (await parseItems(await fetcher(`${base}?id=eq.${id}&select=${ITEM_COLUMNS}&limit=1`, { headers: headers(supabase), cache: "no-store" }), "read"))[0] ?? null,
    insert: async (rows) => {
      if (!rows.length) return;
      const response = await fetcher(`${base}?on_conflict=series,planned_publish_date`, {
        method: "POST", headers: headers(supabase, { Prefer: "resolution=ignore-duplicates,return=minimal" }), body: JSON.stringify(rows), cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to insert carousel automation items (${response.status}).`);
    },
    update: async (id, body, filter) => (await patch(`id=eq.${id}${filter ? `&${filter}` : ""}`, body))[0] ?? null,
    remove: async (ids, filter) => {
      if (!ids.length) return;
      const response = await fetcher(`${base}?id=in.(${ids.join(",")})&${filter}`, { method: "DELETE", headers: headers(supabase, { Prefer: "return=minimal" }), cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to delete carousel automation items (${response.status}).`);
    },
    claim: async (id, now, until) => (await patch(
      `id=eq.${id}&status=in.(planned,generating)&or=(locked_until.is.null,locked_until.lt.${encodeURIComponent(now.toISOString())})`,
      { status: "generating", locked_until: until.toISOString() },
    ))[0] ?? null,
  };
};

// -- Plan refresh (pure diff) ---------------------------------------------------------------------

export const toLockedSlots = (items: CarouselItem[]): CarouselLockedSlot[] =>
  items.filter((item) => !isRecomputableCarousel(item)).map((item) => ({
    series: item.series,
    plannedPublishDate: item.planned_publish_date,
    status: item.status as CarouselLockedSlot["status"],
    editionKey: item.edition_key,
  }));

/** Mondays of the weeks the Sunday slots of the horizon cover. */
export const weekMondaysFrom = (today: string) => slotDays("week", today).map((sunday) => addDays(sunday, 1));

export type CarouselPlanChanges = {
  inserts: Array<Record<string, unknown>>;
  updates: Array<{ id: string; patch: Record<string, unknown> }>;
  deletes: string[];
};

/**
 * Writes so the stored slots match the plan. Only slots from today on are recomputed; a past slot
 * still `planned` (never generated) becomes « too late », other past slots stay as history.
 */
export const diffCarouselPlan = (items: CarouselItem[], slots: CarouselSlot[], today: string): CarouselPlanChanges => {
  const byKey = new Map(items.map((item) => [`${item.series}|${item.planned_publish_date}`, item]));
  const changes: CarouselPlanChanges = { inserts: [], updates: [], deletes: [] };
  const seen = new Set<string>();
  for (const slot of slots) {
    const key = `${slot.series}|${slot.plannedPublishDate}`;
    seen.add(key);
    const row = {
      series: slot.series,
      planned_publish_date: slot.plannedPublishDate,
      race_id: slot.raceId,
      edition_key: slot.editionKey,
      week_start: slot.weekStart,
      status: slot.status,
      reason: slot.reason,
    };
    const existing = byKey.get(key);
    if (!existing) {
      changes.inserts.push(row);
      continue;
    }
    if (!isRecomputableCarousel(existing)) continue;
    if (existing.status !== row.status || existing.reason !== row.reason || existing.race_id !== row.race_id || existing.week_start !== row.week_start || existing.edition_key !== row.edition_key) {
      changes.updates.push({ id: existing.id, patch: { ...row, error: null } });
    }
  }
  items.forEach((item) => {
    if (!isRecomputableCarousel(item) || seen.has(`${item.series}|${item.planned_publish_date}`)) return;
    if (item.planned_publish_date >= today) changes.deletes.push(item.id);
    else if (item.status === "planned") changes.updates.push({ id: item.id, patch: { status: "skipped", reason: "too_late", error: null } });
  });
  return changes;
};

// -- Executor -------------------------------------------------------------------------------------

/** Thrown by a step when the slot can never be generated (skipped, not failed). */
export class CarouselAutomationSkip extends Error {}

export type CarouselWork = Record<string, unknown>;
export type CarouselJobState = { id: string; status: string; message: string | null; created_at: string };

export type CarouselAutomationDeps = {
  now: () => Date;
  items: CarouselItemRepository;
  getSettings: () => Promise<ReelAutomationSettings>;
  loadCatalog: (today: string, weekMondays: string[], carouselPostIds: Set<string>) => Promise<CarouselCatalog>;
  /** Another slot of the series on the same edition, or a post of the series on the race. */
  hasDuplicate: (item: CarouselItem) => Promise<boolean>;
  steps: {
    content: (item: CarouselItem, settings: ReelAutomationSettings) => Promise<CarouselWork>;
    render: (item: CarouselItem, work: CarouselWork, settings: ReelAutomationSettings) => Promise<string>;
  };
  getJobs: (ids: string[]) => Promise<Map<string, CarouselJobState>>;
  isJobStale: (job: CarouselJobState, nowMs: number) => boolean;
  ensureAutoDraft: (jobId: string) => Promise<{ id: string } | null>;
  schedulePost: (postId: string, localDateTime: string) => Promise<{ ok: true } | { ok: false; message: string }>;
};

const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : "Erreur inconnue.").slice(0, 1_000);

export const refreshCarouselPlan = async (deps: CarouselAutomationDeps, settings: ReelAutomationSettings, today: string) => {
  const items = await deps.items.list();
  const mondays = weekMondaysFrom(today);
  const carouselPosts = new Set(items.flatMap((item) => (item.social_post_id ? [item.social_post_id] : [])));
  const catalog = await deps.loadCatalog(today, mondays, carouselPosts);
  const slots = planCarousels(catalog.formats, catalog.coverage, toLockedSlots(items), {
    today,
    leadDays: settings.lead_days,
    enabledSeries: enabledCarouselSeries(settings),
    occupiedDates: catalog.occupiedDates,
    weekEventCounts: catalog.weekEventCounts,
  });
  const changes = diffCarouselPlan(items, slots, today);
  await deps.items.insert(changes.inserts);
  for (const update of changes.updates) await deps.items.update(update.id, update.patch, RECOMPUTABLE_FILTER);
  await deps.items.remove(changes.deletes, RECOMPUTABLE_FILTER);
  return { slots: slots.length, inserted: changes.inserts.length, updated: changes.updates.length, deleted: changes.deletes.length };
};

export const getCarouselPublishLocal = (item: Pick<CarouselItem, "planned_publish_date">, settings: Pick<ReelAutomationSettings, "publish_time">) =>
  `${item.planned_publish_date}T${formatPublishTime(settings.publish_time)}`;

/** Renders in flight become drafts (then scheduled with automatic publication) or failures. */
export const trackCarouselRenders = async (deps: CarouselAutomationDeps, settings: ReelAutomationSettings, items: CarouselItem[]) => {
  const outcomes: Array<{ id: string; outcome: string }> = [];
  const rendering = items.filter((item) => item.status === "rendering" && item.carousel_job_id);
  const jobs = rendering.length ? await deps.getJobs(rendering.map((item) => item.carousel_job_id as string)) : new Map<string, CarouselJobState>();
  const drafted = items.filter((item) => item.status === "drafted" && item.social_post_id);
  const nowMs = deps.now().getTime();
  for (const item of rendering) {
    const job = jobs.get(item.carousel_job_id as string);
    const guard = "status=eq.rendering";
    if (!job) {
      await deps.items.update(item.id, { status: "failed", error: "Le rendu a été supprimé." }, guard);
      outcomes.push({ id: item.id, outcome: "failed" });
    } else if (job.status === "failed") {
      await deps.items.update(item.id, { status: "failed", error: `Rendu en échec : ${job.message ?? "raison inconnue"}`.slice(0, 1_000) }, guard);
      outcomes.push({ id: item.id, outcome: "failed" });
    } else if (job.status === "done") {
      const draft = await deps.ensureAutoDraft(job.id).catch(() => null);
      if (!draft) {
        outcomes.push({ id: item.id, outcome: "waiting_draft" });
        continue;
      }
      const updated = await deps.items.update(item.id, { status: "drafted", social_post_id: draft.id, error: null }, guard);
      if (updated) drafted.push(updated);
      outcomes.push({ id: item.id, outcome: "drafted" });
    } else if (deps.isJobStale(job, nowMs)) {
      await deps.items.update(item.id, { status: "failed", error: "Le rendu ne donne plus de nouvelles." }, guard);
      outcomes.push({ id: item.id, outcome: "failed" });
    }
  }
  if (settings.generation_enabled && settings.auto_publish_enabled) {
    for (const item of drafted) {
      const result = await deps.schedulePost(item.social_post_id as string, getCarouselPublishLocal(item, settings))
        .catch((error: unknown) => ({ ok: false as const, message: errorText(error) }));
      if (result.ok) {
        await deps.items.update(item.id, { status: "scheduled", error: null }, "status=eq.drafted");
        outcomes.push({ id: item.id, outcome: "scheduled" });
      } else if (item.error !== `Programmation automatique impossible : ${result.message}`) {
        await deps.items.update(item.id, { error: `Programmation automatique impossible : ${result.message}`.slice(0, 1_000) }, "status=eq.drafted");
        outcomes.push({ id: item.id, outcome: "schedule_failed" });
      }
    }
  }
  return outcomes;
};

/** Due slot of an enabled series (planned or mid-generation, lease free), the earliest first. */
export const pickDueCarousel = (items: CarouselItem[], settings: ReelAutomationSettings, today: string, now: Date) => {
  const enabled = new Set<CarouselSeries>(enabledCarouselSeries(settings));
  return items
    .filter((item) => (item.status === "planned" || item.status === "generating")
      && enabled.has(item.series)
      && addDays(item.planned_publish_date, -settings.lead_days) <= today
      && (!item.locked_until || Date.parse(item.locked_until) < now.getTime()))
    .sort((left, right) => left.planned_publish_date.localeCompare(right.planned_publish_date) || left.series.localeCompare(right.series))[0] ?? null;
};

/** One step of one due slot: content (snapshot + caption), then the render with its automatic draft. */
export const advanceCarouselItem = async (deps: CarouselAutomationDeps, settings: ReelAutomationSettings, items: CarouselItem[], today: string) => {
  const now = deps.now();
  const due = pickDueCarousel(items, settings, today, now);
  if (!due) return null;
  const claimed = await deps.items.claim(due.id, now, new Date(now.getTime() + CAROUSEL_LEASE_MS));
  if (!claimed) return { id: due.id, step: due.step ?? "content", outcome: "busy" };
  const step = claimed.step ?? "content";
  const guard = "status=eq.generating";
  try {
    if (claimed.series !== "week" && await deps.hasDuplicate(claimed)) {
      await deps.items.update(claimed.id, { status: "skipped", reason: "duplicate", step: null, locked_until: null, error: "Un carrousel de cette série existe déjà pour cette course." }, guard);
      return { id: claimed.id, step, outcome: "duplicate" };
    }
    if (step === "content") {
      const work = await deps.steps.content(claimed, settings);
      await deps.items.update(claimed.id, { work, step: "render", attempts: 0, error: null, locked_until: null }, guard);
      return { id: claimed.id, step, outcome: "done" };
    }
    const jobId = await deps.steps.render(claimed, claimed.work ?? {}, settings);
    await deps.items.update(claimed.id, { status: "rendering", carousel_job_id: jobId, step: null, attempts: 0, error: null, locked_until: null }, guard);
    return { id: claimed.id, step, outcome: "done" };
  } catch (error) {
    if (error instanceof CarouselAutomationSkip) {
      await deps.items.update(claimed.id, { status: "skipped", reason: "ineligible", step: null, locked_until: null, error: errorText(error) }, guard);
      return { id: claimed.id, step, outcome: "skipped" };
    }
    const attempts = claimed.attempts + 1;
    const failed = attempts >= CAROUSEL_MAX_ATTEMPTS;
    console.error("Carousel automation step failed", step, errorText(error));
    await deps.items.update(claimed.id, { step, attempts, error: errorText(error), locked_until: null, ...(failed ? { status: "failed" } : {}) }, guard);
    return { id: claimed.id, step, outcome: failed ? "failed" : "retry" };
  }
};

export const runCarouselAutomationTick = async (deps: CarouselAutomationDeps) => {
  const settings = await deps.getSettings();
  const today = parisToday(deps.now());
  const plan = await refreshCarouselPlan(deps, settings, today);
  const tracked = await trackCarouselRenders(deps, settings, await deps.items.list());
  if (!settings.generation_enabled) return { generationEnabled: false, plan, tracked, advanced: null };
  const advanced = await advanceCarouselItem(deps, settings, await deps.items.list(), today);
  return { generationEnabled: true, plan, tracked, advanced };
};

export { CAROUSEL_HORIZON_DAYS, CAROUSEL_SERIES_WEEKDAY };

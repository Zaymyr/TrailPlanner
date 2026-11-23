import { z } from "zod";

import { addDays } from "./reel-planner";

/**
 * « Vue d'ensemble » of the admin console (pure, shared by `GET /api/admin/overview` and the page):
 * the period and its previous period, the response schema (one block per source, each `ok` or
 * `error` on its own), and the builders that turn the existing sources into KPI, revenue, agenda,
 * health and activity feed. Nothing here is a new measure: every value comes from an existing table
 * or function (growth RPC, flyover orders, social posts, renders, automations, Instagram).
 */

// ---------------------------------------------------------------------------------------------
// Period

export const OVERVIEW_RANGE_KEYS = ["today", "7d", "30d", "custom"] as const;
export type OverviewRangeKey = (typeof OVERVIEW_RANGE_KEYS)[number];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const OVERVIEW_MAX_CUSTOM_DAYS = 366;
export const ACTIVITY_DAYS = 30;
export const AGENDA_DAYS = 7;

export const overviewRangeSchema = z.object({
  key: z.enum(OVERVIEW_RANGE_KEYS),
  /** First and last day of the period (inclusive, Paris). */
  start: z.string(),
  end: z.string(),
  days: z.number().int(),
  previousStart: z.string(),
  previousEnd: z.string(),
  today: z.string(),
});
export type OverviewRange = z.infer<typeof overviewRangeSchema>;

const daysBetween = (start: string, end: string) => Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;

/**
 * Today, the last 7 or 30 days (today included), or a custom span (`from`..`to`, inclusive, at most
 * 366 days, not after today); an invalid custom span falls back to 7 days. The previous period is the
 * span of the same length just before.
 */
export const resolveOverviewRange = ({ key, from, to, today }: { key: string | null; from?: string | null; to?: string | null; today: string }): OverviewRange => {
  const parsedKey = OVERVIEW_RANGE_KEYS.find((candidate) => candidate === key) ?? "7d";
  let start = addDays(today, -6);
  let end = today;
  let resolvedKey: OverviewRangeKey = parsedKey;
  if (parsedKey === "today") start = today;
  if (parsedKey === "30d") start = addDays(today, -29);
  if (parsedKey === "custom") {
    const customEnd = to && DAY_PATTERN.test(to) ? (to > today ? today : to) : null;
    const valid = from && DAY_PATTERN.test(from) && customEnd && from <= customEnd && daysBetween(from, customEnd) <= OVERVIEW_MAX_CUSTOM_DAYS;
    if (valid) {
      start = from;
      end = customEnd;
    } else {
      resolvedKey = "7d";
    }
  }
  const days = daysBetween(start, end);
  return { key: resolvedKey, start, end, days, previousStart: addDays(start, -days), previousEnd: addDays(start, -1), today };
};

// ---------------------------------------------------------------------------------------------
// Growth RPC (only the fields the overview reads)

const funnelRowSchema = z.object({ step: z.string(), count: z.number(), conversionFromPrevious: z.number().nullable() });

export const overviewGrowthSchema = z.object({
  overview: z.object({
    newAccounts: z.number(),
    activationEligibleAccounts: z.number(),
    activatedUsers: z.number(),
    activePlanUsers: z.number(),
    newPlans: z.number(),
    activePremiumUsers: z.number(),
  }),
  trend: z.array(z.object({ date: z.string(), newAccounts: z.number(), activePlanUsers: z.number(), newPlans: z.number() })),
  organizers: z.object({
    publishedRacebooks: z.number(),
    commercial: z.object({
      paidTransactions: z.number(),
      grossRevenueMinor: z.number(),
      invalidatedTransactions: z.number(),
      invalidatedRevenueMinor: z.number(),
      netRevenueMinor: z.number(),
      currency: z.string(),
    }),
    funnel: z.array(funnelRowSchema),
  }),
});
export type OverviewGrowth = z.infer<typeof overviewGrowthSchema>;

// ---------------------------------------------------------------------------------------------
// Response

const errorBlock = z.object({ status: z.literal("error"), message: z.string() });
const block = <T extends z.ZodTypeAny>(data: T) => z.union([z.object({ status: z.literal("ok"), data }), errorBlock]);
export type OverviewBlock<T> = { status: "ok"; data: T } | { status: "error"; message: string };

const kpiSchema = z.object({ current: z.number(), previous: z.number().nullable(), series: z.array(z.number()) });
export type OverviewKpi = z.infer<typeof kpiSchema>;

export const overviewKpisSchema = z.object({
  activeRunners: kpiSchema,
  newAccounts: kpiSchema,
  newPlans: kpiSchema,
  /** Tracked revenue (organizer packs + flyovers), minor units; runners are not tracked. */
  netRevenue: kpiSchema.extend({ partial: z.boolean(), currency: z.string() }),
  activePremium: kpiSchema,
  publishedRacebooks: kpiSchema,
});
export type OverviewKpis = z.infer<typeof overviewKpisSchema>;

export const overviewActivitySchema = z.object({
  start: z.string(),
  end: z.string(),
  points: z.array(z.object({ date: z.string(), activePlanUsers: z.number(), newAccounts: z.number(), newPlans: z.number() })),
});

export const overviewFunnelSchema = z.object({ runners: z.array(funnelRowSchema), organizers: z.array(funnelRowSchema) });

export const REVENUE_SOURCES = ["organizers", "runners", "flyovers"] as const;
export const revenueSourceSchema = z.object({
  key: z.enum(REVENUE_SOURCES),
  label: z.string(),
  /** false: no amount is stored for this source (the UI says « non suivi »). */
  tracked: z.boolean(),
  /** Null when not tracked or when the source could not be read (`error`). */
  amountMinor: z.number().nullable(),
  previousAmountMinor: z.number().nullable(),
  count: z.number().nullable(),
  refundedMinor: z.number().nullable(),
  refundedCount: z.number().nullable(),
  error: z.string().nullable(),
});
export type RevenueSource = z.infer<typeof revenueSourceSchema>;
export const overviewRevenueSchema = z.object({
  currency: z.string(),
  totalMinor: z.number(),
  previousTotalMinor: z.number().nullable(),
  sources: z.array(revenueSourceSchema),
});
export type OverviewRevenue = z.infer<typeof overviewRevenueSchema>;

export const AGENDA_KINDS = ["reel", "carousel", "race"] as const;
export const agendaEventSchema = z.object({
  kind: z.enum(AGENDA_KINDS),
  /** true: a post scheduled on Instagram; false: a slot planned by the automation, or a race. */
  scheduled: z.boolean(),
  title: z.string(),
  /** Paris time « 18:00 », or null for a whole-day event (race). */
  time: z.string().nullable(),
  note: z.string().nullable(),
  href: z.string(),
});
export type AgendaEvent = z.infer<typeof agendaEventSchema>;
export const overviewAgendaSchema = z.object({
  days: z.array(z.object({ date: z.string(), events: z.array(agendaEventSchema) })),
  /** Sources that could not be read (their events are missing). */
  errors: z.array(z.string()),
});
export type OverviewAgenda = z.infer<typeof overviewAgendaSchema>;

export const HEALTH_STATUSES = ["ok", "warning", "error", "off", "unknown", "untracked"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];
export const healthSystemSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(HEALTH_STATUSES),
  detail: z.string(),
  /** Latest activity of the system (ISO), shown as « il y a … ». */
  lastAt: z.string().nullable(),
  meter: z.object({ value: z.number(), total: z.number() }).nullable(),
  href: z.string().nullable(),
});
export type HealthSystem = z.infer<typeof healthSystemSchema>;
export const overviewHealthSchema = z.object({
  systems: z.array(healthSystemSchema),
  /** Instagram publishing mode (null when unknown). */
  instagramDryRun: z.boolean().nullable(),
});
export type OverviewHealth = z.infer<typeof overviewHealthSchema>;

export const FEED_KINDS = ["payment", "flyover_order", "render_done", "render_failed", "post_published", "accounts", "admin_action", "admin_action_failed"] as const;
export const feedEventSchema = z.object({
  kind: z.enum(FEED_KINDS),
  title: z.string(),
  detail: z.string(),
  at: z.string(),
  href: z.string().nullable(),
});
export type FeedEvent = z.infer<typeof feedEventSchema>;
export const overviewFeedSchema = z.object({ events: z.array(feedEventSchema), errors: z.array(z.string()) });
export type OverviewFeed = z.infer<typeof overviewFeedSchema>;

export const adminOverviewResponseSchema = z.object({
  generatedAt: z.string(),
  range: overviewRangeSchema,
  kpis: block(overviewKpisSchema),
  activity: block(overviewActivitySchema),
  funnel: block(overviewFunnelSchema),
  revenue: block(overviewRevenueSchema),
  agenda: block(overviewAgendaSchema),
  health: block(overviewHealthSchema),
  feed: block(overviewFeedSchema),
});
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

// ---------------------------------------------------------------------------------------------
// KPI, funnel, revenue

export type FlyoverRevenueRow = { amount_cents: number; status: string; paid_at: string | null };

/** Flyover orders paid in the period: refunded ones apart; unpaid, cancelled or expired ones are not revenue. */
export const sumFlyoverRevenue = (rows: FlyoverRevenueRow[]) => {
  let amountMinor = 0;
  let count = 0;
  let refundedMinor = 0;
  let refundedCount = 0;
  rows.forEach((row) => {
    if (!row.paid_at) return;
    if (row.status === "refunded") {
      refundedMinor += row.amount_cents;
      refundedCount += 1;
      return;
    }
    if (row.status === "pending_payment" || row.status === "cancelled" || row.status === "expired") return;
    amountMinor += row.amount_cents;
    count += 1;
  });
  return { amountMinor, count, refundedMinor, refundedCount };
};
export type FlyoverRevenue = ReturnType<typeof sumFlyoverRevenue>;

const kpi = (current: number, previous: number | null, series: number[] = []): OverviewKpi => ({ current, previous, series });

/** The six tiles: growth of the period vs the previous one; revenue adds the flyovers when they could be read. */
export const buildOverviewKpis = ({ current, previous, flyovers, previousFlyovers }: {
  current: OverviewGrowth;
  previous: OverviewGrowth | null;
  flyovers: FlyoverRevenue | null;
  previousFlyovers: FlyoverRevenue | null;
}): OverviewKpis => {
  const trend = current.trend;
  const revenue = current.organizers.commercial.netRevenueMinor + (flyovers?.amountMinor ?? 0);
  const previousRevenue = previous ? previous.organizers.commercial.netRevenueMinor + (previousFlyovers?.amountMinor ?? 0) : null;
  return {
    activeRunners: kpi(current.overview.activePlanUsers, previous?.overview.activePlanUsers ?? null, trend.map((point) => point.activePlanUsers)),
    newAccounts: kpi(current.overview.newAccounts, previous?.overview.newAccounts ?? null, trend.map((point) => point.newAccounts)),
    newPlans: kpi(current.overview.newPlans, previous?.overview.newPlans ?? null, trend.map((point) => point.newPlans)),
    netRevenue: { ...kpi(revenue, previousRevenue), partial: flyovers === null, currency: current.organizers.commercial.currency },
    activePremium: kpi(current.overview.activePremiumUsers, previous?.overview.activePremiumUsers ?? null),
    publishedRacebooks: kpi(current.organizers.publishedRacebooks, previous?.organizers.publishedRacebooks ?? null),
  };
};

const rate = (count: number, base: number) => (base > 0 ? Math.round((1000 * count) / base) / 10 : null);

/**
 * Runner funnel from the growth RPC: accounts created, accounts whose 24 h window is over (the
 * activation cohort), and those with a first plan within 24 h. The organizer funnel is the RPC's.
 */
export const buildOverviewFunnel = (growth: OverviewGrowth) => ({
  runners: [
    { step: "Comptes créés", count: growth.overview.newAccounts, conversionFromPrevious: null },
    { step: "Fenêtre de 24 h écoulée", count: growth.overview.activationEligibleAccounts, conversionFromPrevious: null },
    { step: "Premier plan en 24 h", count: growth.overview.activatedUsers, conversionFromPrevious: rate(growth.overview.activatedUsers, growth.overview.activationEligibleAccounts) },
  ],
  organizers: growth.organizers.funnel,
});

export const buildOverviewRevenue = ({ current, previous, flyovers, previousFlyovers, growthError, flyoverError }: {
  current: OverviewGrowth | null;
  previous: OverviewGrowth | null;
  flyovers: FlyoverRevenue | null;
  previousFlyovers: FlyoverRevenue | null;
  growthError: string | null;
  flyoverError: string | null;
}): OverviewRevenue => {
  const commercial = current?.organizers.commercial ?? null;
  const sources: RevenueSource[] = [
    {
      key: "organizers",
      label: "Organisateurs · livrets et packs",
      tracked: true,
      amountMinor: commercial?.netRevenueMinor ?? null,
      previousAmountMinor: previous?.organizers.commercial.netRevenueMinor ?? null,
      count: commercial?.paidTransactions ?? null,
      refundedMinor: commercial?.invalidatedRevenueMinor ?? null,
      refundedCount: commercial?.invalidatedTransactions ?? null,
      error: commercial ? null : growthError ?? "Lecture impossible.",
    },
    {
      key: "runners",
      label: "Coureurs · plans et abonnements",
      // Runner purchases (Stripe, Apple, Google) store no amount in the database.
      tracked: false,
      amountMinor: null,
      previousAmountMinor: null,
      count: null,
      refundedMinor: null,
      refundedCount: null,
      error: null,
    },
    {
      key: "flyovers",
      label: "Vidéos de survol",
      tracked: true,
      amountMinor: flyovers?.amountMinor ?? null,
      previousAmountMinor: previousFlyovers?.amountMinor ?? null,
      count: flyovers?.count ?? null,
      refundedMinor: flyovers?.refundedMinor ?? null,
      refundedCount: flyovers?.refundedCount ?? null,
      error: flyovers ? null : flyoverError ?? "Lecture impossible.",
    },
  ];
  const totalMinor = sources.reduce((total, source) => total + (source.amountMinor ?? 0), 0);
  const previousTotalMinor = sources.every((source) => !source.tracked || source.previousAmountMinor !== null)
    ? sources.reduce((total, source) => total + (source.previousAmountMinor ?? 0), 0)
    : null;
  return { currency: commercial?.currency ?? "eur", totalMinor, previousTotalMinor, sources };
};

// ---------------------------------------------------------------------------------------------
// Agenda (next 7 days)

const parisTimeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const parisDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
export const parisDayOf = (iso: string) => parisDayFormat.format(new Date(iso));
export const parisTimeOf = (iso: string) => parisTimeFormat.format(new Date(iso));

export type AgendaPost = { id: string; media_type: "reel" | "carousel"; carousel_series: "plan" | "brief" | "week" | null; scheduled_at: string; dry_run: boolean; races?: { name: string } | null };
export type AgendaPlannedItem = { id: string; kind: "reel" | "carousel"; plannedDate: string; title: string };
export type AgendaRace = { id: string; eventId: string; date: string; name: string };

const SERIES = { plan: "Le plan chiffré", brief: "Le brief", week: "La semaine qui vient" } as const;

/**
 * Scheduled posts, planned automatic reels and carousels (not yet scheduled: the calendar's planned
 * statuses) and races of organizer-managed events, for today and the 6 next days, by day then time.
 */
export const buildAgenda = ({ today, posts, planned, publishTime, races }: {
  today: string;
  posts: AgendaPost[];
  planned: AgendaPlannedItem[];
  publishTime: string | null;
  races: AgendaRace[];
}) => {
  const days = Array.from({ length: AGENDA_DAYS }, (_, index) => addDays(today, index));
  const byDay = new Map(days.map((day) => [day, [] as Array<AgendaEvent & { sort: string }>]));
  posts.forEach((post) => {
    const day = parisDayOf(post.scheduled_at);
    const series = post.carousel_series ? SERIES[post.carousel_series] : null;
    const title = post.media_type === "carousel"
      ? [series ?? "Carrousel", post.races?.name].filter(Boolean).join(" · ")
      : post.races?.name ?? "Reel";
    byDay.get(day)?.push({
      kind: post.media_type,
      scheduled: true,
      title,
      time: parisTimeOf(post.scheduled_at),
      note: `${post.media_type === "carousel" ? "Carrousel" : "Reel"} programmé${post.dry_run ? " · simulation" : ""}`,
      href: `/admin/content/posts?${new URLSearchParams(post.media_type === "carousel" ? { onglet: "carousels", post: post.id } : { post: post.id }).toString()}`,
      sort: parisTimeOf(post.scheduled_at),
    });
  });
  planned.forEach((item) => {
    byDay.get(item.plannedDate)?.push({
      kind: item.kind,
      scheduled: false,
      title: item.title,
      time: publishTime,
      note: "Prévu par l’automatisation",
      href: `/admin/content/posts?${new URLSearchParams(item.kind === "carousel" ? { onglet: "carousels", element: item.id } : { element: item.id }).toString()}`,
      sort: publishTime ?? "99:99",
    });
  });
  races.forEach((race) => {
    byDay.get(race.date)?.push({
      kind: "race",
      scheduled: false,
      title: race.name,
      time: null,
      note: "Course d’un organisateur",
      href: "/admin/organizers",
      sort: "00:00",
    });
  });
  return days
    .map((date) => ({ date, events: (byDay.get(date) ?? []).sort((left, right) => left.sort.localeCompare(right.sort) || left.title.localeCompare(right.title)).map(({ sort: _sort, ...event }) => event) }))
    .filter((day) => day.events.length > 0);
};

// ---------------------------------------------------------------------------------------------
// Health (lot 2; the scheduled tasks, e-mails and payments lines are built in `lib/admin-system-health.ts`)

export type HealthRenderRow = { status: string; created_at: string };

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
const latest = (values: Array<string | null | undefined>) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

/** Renders (reels and carousels) started in the last 24 h: failures over total. */
export const summarizeRenderHealth = (rows: HealthRenderRow[]): HealthSystem => {
  const failed = rows.filter((row) => row.status === "failed").length;
  const active = rows.filter((row) => !["done", "failed"].includes(row.status)).length;
  const total = rows.length;
  const status: HealthStatus = failed === 0 ? "ok" : failed >= 3 && failed === total ? "error" : "warning";
  const parts = [total ? `${failed} échec${failed > 1 ? "s" : ""} sur ${plural(total, "rendu")} en 24 h` : "Aucun rendu en 24 h"];
  if (active) parts.push(`${active} en cours`);
  return { key: "renders", label: "Rendus (reels et carrousels)", status, detail: parts.join(" · "), lastAt: latest(rows.map((row) => row.created_at)), meter: null, href: "/admin/content/renders" };
};

export type HealthInstagramInput = {
  credentialsConfigured: boolean;
  profileError: string | null;
  quota: { usage: number; total: number } | null;
  dryRun: boolean;
  failedPosts: number | null;
  lastPublishedAt: string | null;
};

export const summarizeInstagramHealth = (input: HealthInstagramInput): HealthSystem => {
  const parts: string[] = [];
  if (input.dryRun) parts.push("Mode simulation");
  if (input.quota) parts.push(`quota ${input.quota.usage} / ${input.quota.total} sur 24 h`);
  if (input.failedPosts) parts.push(`${input.failedPosts} publication${input.failedPosts > 1 ? "s" : ""} en échec`);
  let status: HealthStatus = "ok";
  let detail = parts.join(" · ") || "Compte relié";
  if (!input.credentialsConfigured) {
    status = "error";
    detail = "Identifiants Instagram absents : rien ne peut être publié.";
  } else if (input.profileError) {
    status = "error";
    detail = input.profileError;
  } else if (input.failedPosts || input.dryRun || (input.quota && input.quota.total > 0 && input.quota.usage >= input.quota.total * 0.8)) {
    status = "warning";
  }
  return {
    key: "instagram",
    label: "Publication Instagram",
    status,
    detail,
    lastAt: input.lastPublishedAt,
    meter: input.quota && input.quota.total > 0 ? { value: input.quota.usage, total: input.quota.total } : null,
    href: "/admin/system/integrations",
  };
};

export type HealthFlyoverRow = { status: string; paid_at: string | null; updated_at: string };
/** Hours after payment past which an order still in progress is late (delivery promise: 24 h). */
export const FLYOVER_LATE_HOURS = 24;

export const summarizeFlyoverHealth = (rows: HealthFlyoverRow[], nowMs: number): HealthSystem => {
  const inProgress = rows.filter((row) => ["paid", "scripted", "rendering"].includes(row.status));
  const failed = rows.filter((row) => row.status === "failed").length;
  const late = inProgress.filter((row) => row.paid_at && nowMs - Date.parse(row.paid_at) > FLYOVER_LATE_HOURS * 3_600_000).length;
  const status: HealthStatus = failed ? "error" : late ? "warning" : "ok";
  const parts = [`${inProgress.length} en cours`];
  if (late) parts.push(`${late} au-delà de ${FLYOVER_LATE_HOURS} h`);
  if (failed) parts.push(`${failed} en échec`);
  return { key: "flyovers", label: "Vidéos de survol", status, detail: parts.join(" · "), lastAt: latest(rows.map((row) => row.updated_at)), meter: null, href: "/admin/content/flyovers" };
};

export type HealthAutomationInput = {
  generationEnabled: boolean;
  autoPublishEnabled: boolean;
  carousels: { plan: boolean; brief: boolean; week: boolean };
  publishTime: string;
  nextReel: { date: string; title: string } | null;
  nextCarousel: { date: string; title: string } | null;
  failedItems: number;
  updatedAt: string | null;
};

const longDayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const formatAgendaDay = (day: string) => longDayFormat.format(new Date(`${day}T12:00:00Z`));

export const summarizeAutomationHealth = (input: HealthAutomationInput): HealthSystem => {
  const carouselsOn = Object.values(input.carousels).filter(Boolean).length;
  const switches = [
    `Reels : ${input.generationEnabled ? (input.autoPublishEnabled ? "génération et publication" : "génération, publication après relecture") : "coupés"}`,
    `Carrousels : ${carouselsOn ? `${carouselsOn} série${carouselsOn > 1 ? "s" : ""} sur 3` : "coupés"}`,
  ];
  const next = [
    input.nextReel ? `prochain reel ${formatAgendaDay(input.nextReel.date)} ${input.publishTime}` : null,
    input.nextCarousel ? `prochain carrousel ${formatAgendaDay(input.nextCarousel.date)} ${input.publishTime}` : null,
  ].filter(Boolean);
  const allOff = !input.generationEnabled && carouselsOn === 0;
  const status: HealthStatus = allOff ? "off" : input.failedItems ? "warning" : "ok";
  const detail = [switches.join(" · "), next.join(" · "), input.failedItems ? `${plural(input.failedItems, "élément")} en échec` : null].filter(Boolean).join(" · ");
  return { key: "automation", label: "Reels et carrousels automatiques", status, detail, lastAt: input.updatedAt, meter: null, href: "/admin/system/automation" };
};

export const unknownHealth = (key: string, label: string, href: string | null): HealthSystem => ({ key, label, status: "unknown", detail: "Lecture impossible pour le moment.", lastAt: null, meter: null, href });

/** « 1 avertissement », « 2 systèmes en erreur » for the page summary; untracked ones are left out. */
export const summarizeHealthLine = (systems: HealthSystem[]) => {
  const errors = systems.filter((system) => system.status === "error").length;
  const warnings = systems.filter((system) => system.status === "warning").length;
  const unknown = systems.filter((system) => system.status === "unknown").length;
  if (!errors && !warnings && !unknown) return "tous les systèmes suivis répondent";
  const parts = [errors ? plural(errors, "système") + " en erreur" : null, warnings ? plural(warnings, "avertissement") : null, unknown ? `${unknown} non lu${unknown > 1 ? "s" : ""}` : null];
  return parts.filter(Boolean).join(", ");
};

// ---------------------------------------------------------------------------------------------
// Activity feed (existing timestamps, no new table)

/** « 1 127 € » for whole amounts, « 29,99 € » otherwise. */
export const formatMinor = (minor: number, currency = "eur") => {
  const whole = minor % 100 === 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(minor / 100);
};

export type FeedPayment = { id: string; edition_id?: string | null; paid_at: string; amount_total: number | null; currency: string | null; to_tier: string; payment_channel: string | null; eventName: string | null };
export type FeedFlyoverOrder = { id: string; created_at: string; paid_at: string | null; race_name: string; offer: string; status: string };
export type FeedRender = { id: string; kind: "reel" | "carousel"; title: string; status: "active" | "done" | "failed"; stage: string; finishedAt: string | null };
/** An important admin action of the audit journal (lot 7), already named and linked by `mapAuditRow`. */
export type FeedAdminAction = { id: string; actionLabel: string; summary: string; actorName: string; at: string; status: "ok" | "error" };
export type FeedPublishedPost = { id: string; media_type: "reel" | "carousel"; published_at: string; dry_run: boolean; races?: { name: string } | null };

const TIER_LABELS: Record<string, string> = { racebook: "Livret", pro: "Pro", essential: "Essentiel", complete: "Complet", signature: "Signature", visibility: "Visibilité" };

export const MAX_FEED_ADMIN_ACTIONS = 3;

/** Latest events of the existing tables, newest first: payments, flyover orders, finished renders, published posts, accounts today. */
export const buildActivityFeed = ({ payments, flyoverOrders, renders, posts, accountsToday, adminActions = [], today, limit = 8 }: {
  payments: FeedPayment[];
  flyoverOrders: FeedFlyoverOrder[];
  renders: FeedRender[];
  posts: FeedPublishedPost[];
  accountsToday: { count: number; at: string } | null;
  /** Latest important admin actions; at most `MAX_FEED_ADMIN_ACTIONS` are shown so they never replace the business events. */
  adminActions?: FeedAdminAction[];
  today: string;
  limit?: number;
}): FeedEvent[] => {
  const events: FeedEvent[] = [];
  payments.forEach((payment) => events.push({
    kind: "payment",
    title: `${TIER_LABELS[payment.to_tier] ?? payment.to_tier} payé${payment.payment_channel === "bank_transfer" ? " par virement" : ""}`,
    detail: [payment.eventName, payment.amount_total !== null ? formatMinor(payment.amount_total, payment.currency ?? "eur") : null].filter(Boolean).join(" · "),
    at: payment.paid_at,
    href: payment.edition_id ? `/admin/billing?periode=tout&edition=${payment.edition_id}` : "/admin/billing",
  }));
  flyoverOrders.forEach((order) => {
    if (!order.paid_at) return;
    events.push({ kind: "flyover_order", title: "Commande de survol", detail: `${order.offer === "collab" ? "Collaboration" : "MP4"} · ${order.race_name}`, at: order.paid_at, href: "/admin/content/flyovers" });
  });
  renders.forEach((render) => {
    if (render.status === "active" || !render.finishedAt) return;
    events.push({
      kind: render.status === "failed" ? "render_failed" : "render_done",
      title: render.status === "failed" ? "Rendu échoué" : "Rendu terminé",
      detail: render.title,
      at: render.finishedAt,
      href: `/admin/content/renders?rendu=${encodeURIComponent(render.id)}`,
    });
  });
  posts.forEach((post) => events.push({
    kind: "post_published",
    title: `${post.media_type === "carousel" ? "Carrousel" : "Reel"} publié`,
    detail: [post.races?.name, post.dry_run ? "simulation" : null].filter(Boolean).join(" · ") || "Instagram",
    at: post.published_at,
    href: `/admin/content/posts?onglet=published`,
  }));
  [...adminActions].sort((left, right) => right.at.localeCompare(left.at)).slice(0, MAX_FEED_ADMIN_ACTIONS).forEach((action) => events.push({
    kind: action.status === "error" ? "admin_action_failed" : "admin_action",
    title: action.status === "error" ? `${action.actionLabel} : échec` : action.actionLabel,
    detail: `${action.actorName} · ${action.summary}`,
    at: action.at,
    href: `/admin/system/audit?entree=${encodeURIComponent(action.id)}`,
  }));
  if (accountsToday && accountsToday.count > 0) {
    events.push({ kind: "accounts", title: `${accountsToday.count} nouveau${accountsToday.count > 1 ? "x" : ""} compte${accountsToday.count > 1 ? "s" : ""}`, detail: `aujourd’hui · ${formatAgendaDay(today)}`, at: accountsToday.at, href: "/admin/runners" });
  }
  return events.sort((left, right) => right.at.localeCompare(left.at)).slice(0, limit);
};

/** « il y a 4 min », « il y a 3 h », « hier », « il y a 5 j ». */
export const formatRelativePast = (iso: string, nowMs: number) => {
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
};

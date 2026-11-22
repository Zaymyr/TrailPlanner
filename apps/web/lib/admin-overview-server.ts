import { z } from "zod";

import { INBOX_FILTERS } from "./admin-inbox-server";
import { fetchGrowthMetrics } from "./admin-growth";
import {
  ACTIVITY_DAYS,
  AGENDA_DAYS,
  buildActivityFeed,
  buildAgenda,
  buildOverviewFunnel,
  buildOverviewKpis,
  buildOverviewRevenue,
  overviewGrowthSchema,
  resolveOverviewRange,
  sumFlyoverRevenue,
  summarizeAutomationHealth,
  summarizeFlyoverHealth,
  summarizeInstagramHealth,
  summarizeRenderHealth,
  unknownHealth,
  UNTRACKED_SYSTEMS,
  type AdminOverviewResponse,
  type AgendaPlannedItem,
  type FlyoverRevenue,
  type HealthSystem,
  type OverviewBlock,
  type OverviewGrowth,
} from "./admin-overview";
import { createCarouselItemRepository, type CarouselItem } from "./carousels/carousel-automation";
import { createFlyoverOrderRepository } from "./flyover-orders";
import { getInstagramCredentials, isInstagramPublishDryRun } from "./instagram/config";
import { createInstagramGraphClient, InstagramGraphError } from "./instagram/graph";
import { createReelAutomationRepository, formatPublishTime, type ReelAutomationItem, type ReelAutomationSettings } from "./reel-automation";
import { addDays, parisToday } from "./reel-planner";
import {
  listCarouselRenderActivityRows,
  listReelRenderActivityRows,
  toCarouselRenderActivity,
  toReelRenderActivity,
} from "./render-activity";
import { parisLocalToUtc } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loaders of `GET /api/admin/overview` (service role, read-only). Every block is settled on its own:
 * a failing source turns its block (or its health line) into an error and the rest of the response
 * still loads. Sources are the existing ones: growth RPC (`lib/admin-growth.ts`), flyover orders,
 * social posts, render activity, reel and carousel automations, Instagram config and quota.
 */

const SERIES = { plan: "Le plan chiffré", brief: "Le brief", week: "La semaine qui vient" } as const;
/** Planned slots not yet scheduled, as on the publication calendar (`PLANNED_CALENDAR_STATUSES`). */
const PLANNED_STATUSES = new Set(["planned", "generating", "rendering", "drafted"]);

const get = async (supabase: SupabaseServiceConfig, path: string, extraHeaders: Record<string, string> = {}) => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: supabase.supabaseServiceRoleKey, Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`, ...extraHeaders },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Read failed (${response.status}): ${path.split("?")[0]}`);
  return response;
};
const getJson = async (supabase: SupabaseServiceConfig, path: string) => (await get(supabase, path)).json() as Promise<unknown>;
const countRows = async (supabase: SupabaseServiceConfig, path: string) => {
  const response = await get(supabase, `${path}&select=id&limit=1`, { Prefer: "count=exact" });
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0) || 0;
};

/** Paris midnight of a day, as an ISO instant (PostgREST filter value). */
const parisMidnight = (day: string) => encodeURIComponent((parisLocalToUtc(`${day}T00:00`) ?? new Date(`${day}T00:00:00Z`)).toISOString());

const settle = async <T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
const toBlock = <T>(result: { ok: true; value: T } | { ok: false; error: string }, message: string): OverviewBlock<T> => {
  if (result.ok) return { status: "ok", data: result.value };
  console.error(`Admin overview: ${message}`, result.error);
  return { status: "error", message };
};

const loadGrowth = async (supabase: SupabaseServiceConfig, start: string, endInclusive: string): Promise<OverviewGrowth> =>
  overviewGrowthSchema.parse(await fetchGrowthMetrics(supabase, { start, end: addDays(endInclusive, 1) }));

const flyoverRevenueRows = z.array(z.object({ amount_cents: z.number(), status: z.string(), paid_at: z.string().nullable() }));
const loadFlyoverRevenue = async (supabase: SupabaseServiceConfig, start: string, endInclusive: string): Promise<FlyoverRevenue> =>
  sumFlyoverRevenue(flyoverRevenueRows.parse(await getJson(
    supabase,
    `flyover_video_orders?paid_at=gte.${parisMidnight(start)}&paid_at=lt.${parisMidnight(addDays(endInclusive, 1))}&select=amount_cents,status,paid_at&limit=5000`,
  )));

const scheduledPostRows = z.array(z.object({
  id: z.string(),
  media_type: z.enum(["reel", "carousel"]).default("reel"),
  carousel_series: z.enum(["plan", "brief", "week"]).nullable().default(null),
  scheduled_at: z.string(),
  dry_run: z.boolean(),
  races: z.object({ name: z.string() }).nullable().optional(),
}));
const publishedPostRows = z.array(z.object({
  id: z.string(),
  media_type: z.enum(["reel", "carousel"]).default("reel"),
  published_at: z.string(),
  dry_run: z.boolean(),
  races: z.object({ name: z.string() }).nullable().optional(),
}));
const renderHealthRows = z.array(z.object({ status: z.string(), created_at: z.string() }));
const paymentRows = z.array(z.object({
  id: z.string(),
  edition_id: z.string(),
  paid_at: z.string(),
  amount_total: z.number().nullable(),
  currency: z.string().nullable(),
  to_tier: z.string(),
  payment_channel: z.string().nullable().optional(),
}));
const editionNameRows = z.array(z.object({ id: z.string(), event_id: z.string().optional(), start_date: z.string().optional(), race_events: z.object({ name: z.string() }).nullable().optional() }));

const carouselTitle = (item: CarouselItem) => [SERIES[item.series], item.races?.name ?? (item.week_start ? `semaine du ${item.week_start}` : null)].filter(Boolean).join(" · ");

/** Races of organizer-managed events (an active `race_event_organizers` membership) starting in the window. */
const loadOrganizerRaces = async (supabase: SupabaseServiceConfig, today: string) => {
  const memberships = z.array(z.object({ event_id: z.string() })).parse(await getJson(supabase, "race_event_organizers?revoked_at=is.null&select=event_id&limit=2000"));
  const eventIds = Array.from(new Set(memberships.map((row) => row.event_id)));
  if (!eventIds.length) return [];
  const editions = editionNameRows.parse(await getJson(
    supabase,
    `race_event_editions?event_id=in.(${eventIds.join(",")})&start_date=gte.${today}&start_date=lte.${addDays(today, AGENDA_DAYS - 1)}&select=id,event_id,start_date,race_events(name)&limit=200`,
  ));
  return editions.map((edition) => ({ id: edition.id, eventId: edition.event_id ?? "", date: (edition.start_date ?? "").slice(0, 10), name: edition.race_events?.name ?? "Course" }));
};

const describeInstagramError = (error: unknown) =>
  error instanceof InstagramGraphError ? (error.kind === "auth" ? "Jeton Instagram refusé : renouvelle-le." : error.message) : "Instagram injoignable.";

const loadInstagramHealth = async (supabase: SupabaseServiceConfig, lastPublishedAt: string | null): Promise<HealthSystem> => {
  const credentials = getInstagramCredentials();
  const [failedPosts, quota] = await Promise.all([
    countRows(supabase, INBOX_FILTERS.failedPosts).catch(() => null),
    credentials
      ? createInstagramGraphClient().getPublishingLimit(credentials.igUserId, credentials.accessToken).then(
        (limit) => ({ limit, error: null as string | null }),
        (error: unknown) => ({ limit: null, error: describeInstagramError(error) }),
      )
      : Promise.resolve({ limit: null, error: null as string | null }),
  ]);
  return summarizeInstagramHealth({
    credentialsConfigured: credentials !== null,
    profileError: quota.error,
    quota: quota.limit ? { usage: quota.limit.usage, total: quota.limit.total } : null,
    dryRun: isInstagramPublishDryRun(),
    failedPosts,
    lastPublishedAt,
  });
};

export const loadAdminOverview = async (
  supabase: SupabaseServiceConfig,
  query: { range: string | null; from?: string | null; to?: string | null },
  now = new Date(),
): Promise<AdminOverviewResponse> => {
  const nowMs = now.getTime();
  const today = parisToday(now);
  const range = resolveOverviewRange({ key: query.range, from: query.from, to: query.to, today });
  const activityStart = addDays(today, -(ACTIVITY_DAYS - 1));
  const sameAsActivity = range.start === activityStart && range.end === today;
  const reelRepository = createReelAutomationRepository(supabase);
  const flyoverRepository = createFlyoverOrderRepository(supabase);
  const dayAgo = encodeURIComponent(new Date(nowMs - 24 * 3_600_000).toISOString());

  const currentGrowthPromise = loadGrowth(supabase, range.start, range.end);
  const [
    currentGrowth,
    previousGrowth,
    activityGrowth,
    flyovers,
    previousFlyovers,
    settings,
    reelItems,
    carouselItems,
    scheduledPosts,
    organizerRaces,
    publishedPosts,
    renderRows,
    flyoverQueue,
    payments,
    recentFlyovers,
    recentRenders,
  ] = await Promise.all([
    settle(currentGrowthPromise),
    settle(loadGrowth(supabase, range.previousStart, range.previousEnd)),
    settle(sameAsActivity ? currentGrowthPromise : loadGrowth(supabase, activityStart, today)),
    settle(loadFlyoverRevenue(supabase, range.start, range.end)),
    settle(loadFlyoverRevenue(supabase, range.previousStart, range.previousEnd)),
    settle<ReelAutomationSettings>(reelRepository.getSettings()),
    settle<ReelAutomationItem[]>(reelRepository.listItems()),
    settle<CarouselItem[]>(createCarouselItemRepository(supabase).list()),
    settle((async () => scheduledPostRows.parse(await getJson(
      supabase,
      `social_posts?status=eq.scheduled&scheduled_at=gte.${parisMidnight(today)}&scheduled_at=lt.${parisMidnight(addDays(today, AGENDA_DAYS))}&select=id,media_type,carousel_series,scheduled_at,dry_run,races(name)&order=scheduled_at.asc&limit=200`,
    )))()),
    settle(loadOrganizerRaces(supabase, today)),
    settle((async () => publishedPostRows.parse(await getJson(
      supabase,
      "social_posts?status=eq.published&published_at=not.is.null&select=id,media_type,published_at,dry_run,races(name)&order=published_at.desc&limit=5",
    )))()),
    settle((async () => {
      const [reels, carousels] = await Promise.all([
        getJson(supabase, `video_render_jobs?created_at=gte.${dayAgo}&select=status,created_at&limit=1000`),
        getJson(supabase, `carousel_render_jobs?created_at=gte.${dayAgo}&select=status,created_at&limit=1000`),
      ]);
      return [...renderHealthRows.parse(reels), ...renderHealthRows.parse(carousels)];
    })()),
    settle(flyoverRepository.listByStatus(["paid", "scripted", "rendering", "failed"], 200)),
    settle((async () => {
      const rows = paymentRows.parse(await getJson(
        supabase,
        "organizer_edition_payments?paid_at=not.is.null&status=eq.paid&select=id,edition_id,paid_at,amount_total,currency,to_tier,payment_channel&order=paid_at.desc&limit=5",
      ));
      const editionIds = Array.from(new Set(rows.map((row) => row.edition_id)));
      const names = editionIds.length
        ? new Map(editionNameRows.parse(await getJson(supabase, `race_event_editions?id=in.(${editionIds.join(",")})&select=id,race_events(name)`)).map((edition) => [edition.id, edition.race_events?.name ?? null]))
        : new Map<string, string | null>();
      return rows.map((row) => ({ ...row, payment_channel: row.payment_channel ?? null, eventName: names.get(row.edition_id) ?? null }));
    })()),
    settle(flyoverRepository.listRecent(5)),
    settle((async () => {
      const [reels, carousels] = await Promise.all([listReelRenderActivityRows(supabase), listCarouselRenderActivityRows(supabase)]);
      return [...reels.map(toReelRenderActivity), ...carousels.map(toCarouselRenderActivity)];
    })()),
  ]);

  const growthError = currentGrowth.ok ? null : "La fonction de croissance n’a pas répondu.";
  const flyoverError = flyovers.ok ? null : "Les commandes de survol n’ont pas pu être lues.";

  const kpis = toBlock(
    currentGrowth.ok
      ? { ok: true as const, value: buildOverviewKpis({ current: currentGrowth.value, previous: previousGrowth.ok ? previousGrowth.value : null, flyovers: flyovers.ok ? flyovers.value : null, previousFlyovers: previousFlyovers.ok ? previousFlyovers.value : null }) }
      : currentGrowth,
    "Les indicateurs n’ont pas pu être calculés.",
  );
  const activity = toBlock(
    activityGrowth.ok ? { ok: true as const, value: { start: activityStart, end: today, points: activityGrowth.value.trend.map(({ date, activePlanUsers, newAccounts, newPlans }) => ({ date, activePlanUsers, newAccounts, newPlans })) } } : activityGrowth,
    "La courbe d’activité n’a pas pu être chargée.",
  );
  const funnel = toBlock(currentGrowth.ok ? { ok: true as const, value: buildOverviewFunnel(currentGrowth.value) } : currentGrowth, "Le funnel n’a pas pu être calculé.");
  const revenue: OverviewBlock<ReturnType<typeof buildOverviewRevenue>> = !currentGrowth.ok && !flyovers.ok
    ? toBlock(currentGrowth, "Les revenus n’ont pas pu être lus.")
    : {
      status: "ok",
      data: buildOverviewRevenue({
        current: currentGrowth.ok ? currentGrowth.value : null,
        previous: previousGrowth.ok ? previousGrowth.value : null,
        flyovers: flyovers.ok ? flyovers.value : null,
        previousFlyovers: previousFlyovers.ok ? previousFlyovers.value : null,
        growthError,
        flyoverError,
      }),
    };

  // Agenda: each source on its own; a failing one is named in `errors`.
  const agendaErrors: string[] = [];
  const windowEnd = addDays(today, AGENDA_DAYS - 1);
  const inWindow = (day: string) => day >= today && day <= windowEnd;
  const planned: AgendaPlannedItem[] = [];
  if (reelItems.ok) {
    reelItems.value.filter((item) => PLANNED_STATUSES.has(item.status) && inWindow(item.planned_publish_date))
      .forEach((item) => planned.push({ id: item.id, kind: "reel", plannedDate: item.planned_publish_date, title: item.races?.name ?? "Reel" }));
  } else agendaErrors.push("reels automatiques");
  if (carouselItems.ok) {
    carouselItems.value.filter((item) => PLANNED_STATUSES.has(item.status) && inWindow(item.planned_publish_date))
      .forEach((item) => planned.push({ id: item.id, kind: "carousel", plannedDate: item.planned_publish_date, title: carouselTitle(item) }));
  } else agendaErrors.push("carrousels automatiques");
  if (!scheduledPosts.ok) agendaErrors.push("publications programmées");
  if (!organizerRaces.ok) agendaErrors.push("courses des organisateurs");
  const publishTime = settings.ok ? formatPublishTime(settings.value.publish_time) : null;
  const agenda: AdminOverviewResponse["agenda"] = agendaErrors.length === 4
    ? { status: "error", message: "Les 7 prochains jours n’ont pas pu être lus." }
    : {
      status: "ok",
      data: {
        days: buildAgenda({ today, posts: scheduledPosts.ok ? scheduledPosts.value : [], planned, publishTime, races: organizerRaces.ok ? organizerRaces.value : [] }),
        errors: agendaErrors,
      },
    };

  // Health: one line per system, `unknown` when its source cannot be read.
  const lastPublishedAt = publishedPosts.ok ? publishedPosts.value[0]?.published_at ?? null : null;
  const nextOf = <T extends { status: string; planned_publish_date: string }>(items: T[]) =>
    items.filter((item) => PLANNED_STATUSES.has(item.status) && item.planned_publish_date >= today).sort((left, right) => left.planned_publish_date.localeCompare(right.planned_publish_date))[0] ?? null;
  const automation = settings.ok && reelItems.ok && carouselItems.ok
    ? (() => {
      const nextReel = nextOf(reelItems.value);
      const nextCarousel = nextOf(carouselItems.value);
      return summarizeAutomationHealth({
        generationEnabled: settings.value.generation_enabled,
        autoPublishEnabled: settings.value.auto_publish_enabled,
        carousels: { plan: settings.value.plan_carousel_enabled, brief: settings.value.brief_carousel_enabled, week: settings.value.week_carousel_enabled },
        publishTime: formatPublishTime(settings.value.publish_time),
        nextReel: nextReel ? { date: nextReel.planned_publish_date, title: nextReel.races?.name ?? "Reel" } : null,
        nextCarousel: nextCarousel ? { date: nextCarousel.planned_publish_date, title: carouselTitle(nextCarousel) } : null,
        failedItems: [...reelItems.value, ...carouselItems.value].filter((item) => item.status === "failed" && item.planned_publish_date >= today).length,
        updatedAt: settings.value.updated_at,
      });
    })()
    : unknownHealth("automation", "Reels et carrousels automatiques", "/admin/system/automation");
  const instagram = await settle(loadInstagramHealth(supabase, lastPublishedAt));
  const systems: HealthSystem[] = [
    instagram.ok ? instagram.value : unknownHealth("instagram", "Publication Instagram", "/admin/system/integrations"),
    automation,
    renderRows.ok ? summarizeRenderHealth(renderRows.value) : unknownHealth("renders", "Rendus (reels et carrousels)", "/admin/content/renders"),
    flyoverQueue.ok ? summarizeFlyoverHealth(flyoverQueue.value, nowMs) : unknownHealth("flyovers", "Vidéos de survol", "/admin/content/flyovers"),
    ...UNTRACKED_SYSTEMS,
  ];

  // Feed: latest timestamps of the existing tables.
  const feedErrors = [
    payments.ok ? null : "paiements organisateurs",
    recentFlyovers.ok ? null : "commandes de survol",
    recentRenders.ok ? null : "rendus",
    publishedPosts.ok ? null : "publications",
  ].filter((value): value is string => value !== null);
  const todayPoint = activityGrowth.ok ? activityGrowth.value.trend.find((point) => point.date === today) ?? null : null;
  const feed: AdminOverviewResponse["feed"] = feedErrors.length === 4
    ? { status: "error", message: "L’activité récente n’a pas pu être lue." }
    : {
      status: "ok",
      data: {
        events: buildActivityFeed({
          payments: payments.ok ? payments.value : [],
          flyoverOrders: recentFlyovers.ok ? recentFlyovers.value : [],
          renders: recentRenders.ok ? recentRenders.value : [],
          posts: publishedPosts.ok ? publishedPosts.value : [],
          accountsToday: todayPoint ? { count: todayPoint.newAccounts, at: now.toISOString() } : null,
          today,
        }),
        errors: feedErrors,
      },
    };

  return {
    generatedAt: now.toISOString(),
    range,
    kpis,
    activity,
    funnel,
    revenue,
    agenda,
    health: { status: "ok", data: { systems, instagramDryRun: isInstagramPublishDryRun() } },
    feed,
  };
};

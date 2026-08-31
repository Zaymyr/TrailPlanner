import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { queryPostHog, type PostHogQueryStatus } from "../../../../lib/posthog-query";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";
import { adminGrowthResponseSchema, growthRangeSchema } from "./schema";

const userRowSchema = z.object({ user_id: z.string().uuid(), email: z.string().nullable().optional(), created_at: z.string() });
const planRowSchema = z.object({ user_id: z.string().uuid(), created_at: z.string(), updated_at: z.string() });
const subscriptionRowSchema = z.object({
  user_id: z.string().uuid(), status: z.string().nullable(), current_period_end: z.string().nullable(), updated_at: z.string(),
});
const membershipRowSchema = z.object({
  event_id: z.string().uuid(), user_id: z.string().uuid(), role: z.string(), created_at: z.string(), revoked_at: z.string().nullable(),
});
const eventRowSchema = z.object({ id: z.string().uuid(), name: z.string() });
const editionRowSchema = z.object({ id: z.string().uuid(), event_id: z.string().uuid(), created_at: z.string(), updated_at: z.string() });
const raceRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  data_status: z.string().nullable().optional(),
  missing_required_fields: z.array(z.string()).nullable().optional(),
  racebook_is_live: z.boolean().nullable().optional(),
  racebook_publication_approved_at: z.string().nullable().optional(),
});

type MetricMap = Map<string, number>;

const authorizeAdmin = async (request: NextRequest) => {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();
  if (!supabaseAnon || !supabaseService) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })) };
  }
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user || !isAdminUser(user)) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Admin access required." }, { status: 403 })) };
  }
  return { supabaseService };
};

const toIso = (date: Date) => date.toISOString();
const dayStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const parseRange = (request: NextRequest) => {
  const key = growthRangeSchema.catch("last7").parse(request.nextUrl.searchParams.get("range") ?? "last7");
  const today = dayStart(new Date());
  let start = today;
  let end = new Date(today.getTime() + 24 * 3600 * 1000);
  if (key === "yesterday") { start = new Date(today.getTime() - 24 * 3600 * 1000); end = today; }
  if (key === "last7") start = new Date(today.getTime() - 6 * 24 * 3600 * 1000);
  if (key === "last30") start = new Date(today.getTime() - 29 * 24 * 3600 * 1000);
  if (key === "custom") {
    const customStart = request.nextUrl.searchParams.get("start");
    const customEnd = request.nextUrl.searchParams.get("end");
    if (customStart && customEnd) {
      const parsedStart = dayStart(new Date(customStart));
      const parsedEnd = dayStart(new Date(customEnd));
      if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime()) && parsedStart <= parsedEnd) {
        start = parsedStart;
        end = new Date(parsedEnd.getTime() + 24 * 3600 * 1000);
      }
    }
  }
  return { key, start: toIso(start), end: toIso(end) };
};

const between = (iso: string | null | undefined, start: string, end: string) => Boolean(iso && iso >= start && iso < end);
const pct = (numerator: number | null, denominator: number | null) =>
  numerator !== null && denominator !== null && denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : null;

async function getRows<T>(url: string, key: string, path: string): Promise<T[]> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error(`Failed ${path.split("?")[0]}`);
  return payload as T[];
}

function rowsToMetricMap(rows: unknown[][]): MetricMap {
  return new Map(rows.flatMap((row) => {
    const key = typeof row[0] === "string" ? row[0] : null;
    const value = typeof row[1] === "number" ? row[1] : Number(row[1]);
    return key && Number.isFinite(value) ? [[key, value] as const] : [];
  }));
}

const metric = (status: PostHogQueryStatus, metrics: MetricMap, key: string) =>
  status === "available" ? metrics.get(key) ?? 0 : null;

async function loadPostHogMetrics(start: string, end: string) {
  const web = "(properties.surface = 'web' OR properties['$lib'] = 'web')";
  const app = "(properties.surface = 'app' OR properties['$lib'] = 'posthog-react-native')";
  const bounds = `timestamp >= toDateTime('${start}') AND timestamp < toDateTime('${end}')`;
  const result = await queryPostHog(`
    SELECT 'web_visitors', uniqExactIf(distinct_id, event = '$pageview' AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'web_onboarding_started', uniqExactIf(distinct_id, event = 'onboarding_action' AND properties.action = 'start_plan_clicked' AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'web_plans_generated', uniqExactIf(distinct_id, event = 'onboarding_action' AND properties.action = 'loading_complete' AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'web_signups_completed', uniqExactIf(distinct_id, event = 'onboarding_action' AND properties.action = 'signup_email_success' AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'web_app_downloads', uniqExactIf(distinct_id, (event = 'mobile_app_prompt_download' OR (event = 'onboarding_action' AND properties.action = 'download_app_clicked')) AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'app_active_users', uniqExactIf(distinct_id, event = '$screen' AND ${app}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'app_onboarding_completed', uniqExactIf(distinct_id, event = 'onboarding completed' AND ${app}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'app_plan_created', uniqExactIf(distinct_id, event = 'plan created' AND ${app}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'app_plan_saved', uniqExactIf(distinct_id, event = 'plan saved' AND ${app}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'app_plan_shared', uniqExactIf(distinct_id, event = 'plan recap link shared' AND ${app}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'organizer_landing_visitors', uniqExactIf(distinct_id, event = '$pageview' AND properties['$current_url'] LIKE '%/organisateurs' AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'organizer_cta_visitors', uniqExactIf(distinct_id, event = 'organizer_landing_cta_clicked' AND ${web}) FROM events WHERE ${bounds}
    UNION ALL SELECT 'organizer_dashboard_visitors', uniqExactIf(distinct_id, event = '$pageview' AND properties['$current_url'] LIKE '%/organizer%' AND properties['$current_url'] NOT LIKE '%/organizers%' AND ${web}) FROM events WHERE ${bounds}
  `);
  const metrics = rowsToMetricMap(result.rows);

  if (result.status === "available") {
    const retentionResult = await queryPostHog(`
      WITH first_seen AS (
        SELECT distinct_id, min(timestamp) AS first_at
        FROM events
        WHERE event = '$screen' AND ${app}
        GROUP BY distinct_id
        HAVING first_at >= toDateTime('${start}') AND first_at < toDateTime('${end}')
      ), returns AS (
        SELECT first_seen.distinct_id, first_seen.first_at,
          max(if(events.timestamp >= first_seen.first_at + INTERVAL 1 DAY AND events.timestamp < first_seen.first_at + INTERVAL 2 DAY, 1, 0)) AS j1,
          max(if(events.timestamp >= first_seen.first_at + INTERVAL 7 DAY AND events.timestamp < first_seen.first_at + INTERVAL 8 DAY, 1, 0)) AS j7,
          max(if(events.timestamp >= first_seen.first_at + INTERVAL 30 DAY AND events.timestamp < first_seen.first_at + INTERVAL 31 DAY, 1, 0)) AS j30
        FROM first_seen
        LEFT JOIN events ON events.distinct_id = first_seen.distinct_id AND events.event = '$screen' AND ${app}
        GROUP BY first_seen.distinct_id, first_seen.first_at
      )
      SELECT 'app_new_users', count() FROM returns
      UNION ALL SELECT 'app_j1_eligible', countIf(first_at < now() - INTERVAL 2 DAY) FROM returns
      UNION ALL SELECT 'app_j1_returned', countIf(first_at < now() - INTERVAL 2 DAY AND j1 = 1) FROM returns
      UNION ALL SELECT 'app_j7_eligible', countIf(first_at < now() - INTERVAL 8 DAY) FROM returns
      UNION ALL SELECT 'app_j7_returned', countIf(first_at < now() - INTERVAL 8 DAY AND j7 = 1) FROM returns
      UNION ALL SELECT 'app_j30_eligible', countIf(first_at < now() - INTERVAL 31 DAY) FROM returns
      UNION ALL SELECT 'app_j30_returned', countIf(first_at < now() - INTERVAL 31 DAY AND j30 = 1) FROM returns
    `);
    if (retentionResult.status === "available") {
      for (const [key, value] of rowsToMetricMap(retentionResult.rows)) metrics.set(key, value);
    } else {
      return { status: retentionResult.status, metrics };
    }
  }
  return { status: result.status, metrics };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;
    const range = parseRange(request);
    const [usersRaw, plansRaw, subscriptionsRaw, membershipsRaw, eventsRaw, editionsRaw, racesRaw, posthog] = await Promise.all([
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "rpc/get_admin_user_rows"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_plans?select=user_id,created_at,updated_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "subscriptions?select=user_id,status,current_period_end,updated_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_event_organizers?select=event_id,user_id,role,created_at,revoked_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_events?select=id,name"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_event_editions?select=id,event_id,created_at,updated_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "races?event_id=not.is.null&select=id,event_id,created_at,updated_at,data_status,missing_required_fields,racebook_is_live,racebook_publication_approved_at"),
      loadPostHogMetrics(range.start, range.end),
    ]);

    const users = z.array(userRowSchema).parse(usersRaw);
    const plans = z.array(planRowSchema).parse(plansRaw);
    const subscriptions = z.array(subscriptionRowSchema).parse(subscriptionsRaw);
    const memberships = z.array(membershipRowSchema).parse(membershipsRaw);
    const events = z.array(eventRowSchema).parse(eventsRaw);
    const editions = z.array(editionRowSchema).parse(editionsRaw);
    const races = z.array(raceRowSchema).parse(racesRaw);
    const now = new Date();

    const newAccounts = users.filter((user) => user.email && between(user.created_at, range.start, range.end));
    const activatedUsers = new Set(newAccounts.flatMap((user) => {
      const accountCreatedAt = new Date(user.created_at).getTime();
      return plans.some((plan) => {
        const planCreatedAt = new Date(plan.created_at).getTime();
        return plan.user_id === user.user_id && planCreatedAt >= accountCreatedAt && planCreatedAt <= accountCreatedAt + 24 * 3600 * 1000;
      }) ? [user.user_id] : [];
    })).size;
    const activePlanUsers = new Set(plans.filter((plan) => between(plan.updated_at, range.start, range.end)).map((plan) => plan.user_id)).size;
    const activePremiumUsers = subscriptions.filter((subscription) =>
      ["active", "trialing"].includes(subscription.status ?? "") && (!subscription.current_period_end || subscription.current_period_end > now.toISOString())
    ).length;

    const activeMemberships = memberships.filter((membership) => !membership.revoked_at);
    const ownerMemberships = activeMemberships.filter((membership) => membership.role === "owner");
    const eventById = new Map(events.map((event) => [event.id, event]));
    const userById = new Map(users.map((user) => [user.user_id, user]));
    const racesByEvent = new Map<string, typeof races>();
    for (const race of races) if (race.event_id) racesByEvent.set(race.event_id, [...(racesByEvent.get(race.event_id) ?? []), race]);

    const eventLatestActivity = new Map<string, string>();
    for (const membership of activeMemberships) eventLatestActivity.set(membership.event_id, membership.created_at);
    for (const edition of editions) if ((eventLatestActivity.get(edition.event_id) ?? "") < edition.updated_at) eventLatestActivity.set(edition.event_id, edition.updated_at);
    for (const race of races) if (race.event_id && (eventLatestActivity.get(race.event_id) ?? "") < race.updated_at) eventLatestActivity.set(race.event_id, race.updated_at);

    const changedEventIds = new Set([
      ...editions.filter((edition) => between(edition.updated_at, range.start, range.end)).map((edition) => edition.event_id),
      ...races.filter((race) => between(race.updated_at, range.start, range.end)).flatMap((race) => race.event_id ? [race.event_id] : []),
    ]);
    const organizersWithContentChanges = new Set(activeMemberships.filter((membership) => changedEventIds.has(membership.event_id)).map((membership) => membership.user_id)).size;
    const returningOrganizers = new Set(activeMemberships.flatMap((membership) => {
      const lastActivity = eventLatestActivity.get(membership.event_id);
      return lastActivity && between(lastActivity, range.start, range.end) && new Date(lastActivity).getTime() >= new Date(membership.created_at).getTime() + 7 * 24 * 3600 * 1000
        ? [membership.user_id] : [];
    })).size;

    const followUps = ownerMemberships.flatMap((membership) => {
      const event = eventById.get(membership.event_id);
      if (!event) return [];
      const eventRaces = racesByEvent.get(event.id) ?? [];
      const hasCompleteFormat = eventRaces.some((race) =>
        race.data_status === "complete" ||
        (race.data_status !== "draft" && (race.missing_required_fields?.length ?? 0) === 0)
      );
      const hasPublishedRacebook = eventRaces.some((race) => race.racebook_is_live);
      const status = hasPublishedRacebook ? "published" as const : eventRaces.length === 0 ? "no_format" as const : !hasCompleteFormat ? "incomplete" as const : "ready_to_publish" as const;
      const lastActivityAt = eventLatestActivity.get(event.id) ?? membership.created_at;
      const daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / (24 * 3600 * 1000)));
      if (status === "published" || daysInactive < 3) return [];
      return [{ eventId: event.id, eventName: event.name, organizerEmail: userById.get(membership.user_id)?.email ?? membership.user_id, lastActivityAt, status, daysInactive }];
    }).sort((left, right) => right.daysInactive - left.daysInactive).slice(0, 20);

    const ph = (key: string) => metric(posthog.status, posthog.metrics, key);
    const j1Eligible = ph("app_j1_eligible"); const j1Returned = ph("app_j1_returned");
    const j7Eligible = ph("app_j7_eligible"); const j7Returned = ph("app_j7_returned");
    const j30Eligible = ph("app_j30_eligible"); const j30Returned = ph("app_j30_returned");
    const landingVisitors = ph("organizer_landing_visitors"); const ctaVisitors = ph("organizer_cta_visitors");
    const eventsCreated = ownerMemberships.filter((membership) => between(membership.created_at, range.start, range.end)).length;
    const formatsCreated = races.filter((race) => between(race.created_at, range.start, range.end)).length;
    const publishedRacebooks = races.filter((race) => between(race.racebook_publication_approved_at, range.start, range.end)).length;

    const actions: Array<{ id: string; audience: "web" | "app" | "organizers"; severity: "info" | "warning" | "critical"; title: string; detail: string }> = [];
    if (posthog.status !== "available") actions.push({
      id: "configure-posthog-query", audience: "web", severity: "info", title: "Connecter les statistiques de parcours",
      detail: "Configurer POSTHOG_PERSONAL_API_KEY et POSTHOG_PROJECT_ID pour afficher les visites, funnels et rétentions Web/App.",
    });
    if (followUps.length > 0) actions.push({
      id: "organizer-follow-ups", audience: "organizers", severity: followUps.some((item) => item.daysInactive >= 14) ? "critical" : "warning",
      title: `${followUps.length} événement(s) organisateur à relancer`, detail: "Ces événements sont incomplets ou prêts à publier, mais leur contenu n'a pas été modifié récemment.",
    });
    if (j7Eligible !== null && j7Eligible >= 10 && (pct(j7Returned, j7Eligible) ?? 100) < 20) actions.push({
      id: "app-retention-j7", audience: "app", severity: "warning", title: "Rétention App J+7 faible",
      detail: "Comparer les utilisateurs revenus avec leur première course et leur premier plan pour identifier le point d'abandon.",
    });
    if (newAccounts.length >= 5 && activatedUsers / newAccounts.length < 0.3) actions.push({
      id: "activation-24h", audience: "app", severity: "warning", title: "Peu de nouveaux comptes atteignent leur premier plan",
      detail: "Moins de 30 % des nouveaux comptes ont créé un plan dans les 24 heures.",
    });

    const webVisitors = ph("web_visitors"); const webOnboarding = ph("web_onboarding_started");
    const webPlans = ph("web_plans_generated"); const webSignups = ph("web_signups_completed");
    const response = {
      range,
      overview: { newAccounts: newAccounts.length, activatedUsers, activePlanUsers, newPlans: plans.filter((plan) => between(plan.created_at, range.start, range.end)).length, activePremiumUsers },
      web: {
        status: posthog.status, uniqueVisitors: webVisitors, onboardingStarted: webOnboarding, plansGenerated: webPlans, signupsCompleted: webSignups, appDownloadClicks: ph("web_app_downloads"),
        funnel: [
          { step: "Visiteurs Web", count: webVisitors, conversionFromPrevious: null },
          { step: "Onboarding commencé", count: webOnboarding, conversionFromPrevious: pct(webOnboarding, webVisitors) },
          { step: "Plan généré", count: webPlans, conversionFromPrevious: pct(webPlans, webOnboarding) },
          { step: "Inscription email réussie", count: webSignups, conversionFromPrevious: pct(webSignups, webPlans) },
        ],
      },
      app: {
        status: posthog.status, newUsers: ph("app_new_users"), activeUsers: ph("app_active_users"), onboardingCompleted: ph("app_onboarding_completed"),
        planCreatedUsers: ph("app_plan_created"), planSavedUsers: ph("app_plan_saved"), planSharedUsers: ph("app_plan_shared"),
        retention: {
          j1: { eligible: j1Eligible, returned: j1Returned, rate: pct(j1Returned, j1Eligible) },
          j7: { eligible: j7Eligible, returned: j7Returned, rate: pct(j7Returned, j7Eligible) },
          j30: { eligible: j30Eligible, returned: j30Returned, rate: pct(j30Returned, j30Eligible) },
        },
      },
      organizers: {
        analyticsStatus: posthog.status, landingVisitors, ctaVisitors, dashboardVisitors: ph("organizer_dashboard_visitors"),
        newOrganizers: new Set(activeMemberships.filter((membership) => between(membership.created_at, range.start, range.end)).map((membership) => membership.user_id)).size,
        organizersWithContentChanges, returningOrganizers, eventsCreated,
        editionsCreated: editions.filter((edition) => between(edition.created_at, range.start, range.end)).length,
        formatsCreated, publishedRacebooks,
        funnel: [
          { step: "Visiteurs landing", count: landingVisitors, conversionFromPrevious: null },
          { step: "Clic CTA", count: ctaVisitors, conversionFromPrevious: pct(ctaVisitors, landingVisitors) },
          { step: "Événements créés", count: eventsCreated, conversionFromPrevious: pct(eventsCreated, ctaVisitors) },
          { step: "Formats ajoutés", count: formatsCreated, conversionFromPrevious: pct(formatsCreated, eventsCreated) },
          { step: "RaceBooks publiés", count: publishedRacebooks, conversionFromPrevious: pct(publishedRacebooks, formatsCreated) },
        ],
        followUps,
      },
      actions,
    };

    return withSecurityHeaders(NextResponse.json(adminGrowthResponseSchema.parse(response)));
  } catch (error) {
    console.error("Unexpected error while loading growth analytics", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
  }
}

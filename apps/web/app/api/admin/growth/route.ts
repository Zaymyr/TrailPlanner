import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";
import { adminGrowthResponseSchema, growthRangeSchema } from "./schema";

const userRowSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable().optional(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable().optional(),
  app_metadata: z.record(z.unknown()).nullable().optional(),
});
const planRowSchema = z.object({ user_id: z.string().uuid(), created_at: z.string(), updated_at: z.string() });
const subscriptionRowSchema = z.object({
  user_id: z.string().uuid(), status: z.string().nullable(), current_period_end: z.string().nullable(), updated_at: z.string(),
});
const membershipRowSchema = z.object({
  event_id: z.string().uuid(), user_id: z.string().uuid(), role: z.string(), created_at: z.string(), revoked_at: z.string().nullable(), created_by: z.string().uuid().nullable().optional(),
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
const entitlementRowSchema = z.object({
  edition_id: z.string().uuid(),
  tier: z.enum(["visibility", "racebook", "pro"]),
  source: z.enum(["system", "stripe", "admin", "legacy_admin"]),
  status: z.enum(["active", "revoked"]),
});

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

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function isAdminAppMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return false;
  const roles = Array.isArray(metadata.roles) ? metadata.roles : [];
  return metadata.role === "admin" || roles.includes("admin");
}

function buildTrend(
  start: string,
  end: string,
  users: z.infer<typeof userRowSchema>[],
  plans: z.infer<typeof planRowSchema>[],
  activatedUserIds: Set<string>,
) {
  const points = [];
  for (let cursor = dayStart(new Date(start)); cursor < new Date(end); cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)) {
    const date = dateKey(cursor.toISOString());
    points.push({
      date,
      newAccounts: users.filter((user) => user.email && dateKey(user.created_at) === date).length,
      activatedUsers: users.filter((user) => activatedUserIds.has(user.user_id) && dateKey(user.created_at) === date).length,
      activePlanUsers: new Set(plans.filter((plan) => dateKey(plan.updated_at) === date).map((plan) => plan.user_id)).size,
      newPlans: plans.filter((plan) => dateKey(plan.created_at) === date).length,
    });
  }
  return points;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;
    const range = parseRange(request);
    const [usersRaw, plansRaw, subscriptionsRaw, membershipsRaw, eventsRaw, editionsRaw, racesRaw, entitlementsRaw] = await Promise.all([
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "rpc/get_admin_user_rows"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_plans?select=user_id,created_at,updated_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "subscriptions?select=user_id,status,current_period_end,updated_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_event_organizers?select=event_id,user_id,role,created_at,revoked_at,created_by"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_events?select=id,name"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_event_editions?select=id,event_id,created_at,updated_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "races?event_id=not.is.null&select=id,event_id,created_at,updated_at,data_status,missing_required_fields,racebook_is_live,racebook_publication_approved_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "organizer_edition_entitlements?select=edition_id,tier,source,status"),
    ]);

    const users = z.array(userRowSchema).parse(usersRaw);
    const plans = z.array(planRowSchema).parse(plansRaw);
    const subscriptions = z.array(subscriptionRowSchema).parse(subscriptionsRaw);
    const memberships = z.array(membershipRowSchema).parse(membershipsRaw);
    const events = z.array(eventRowSchema).parse(eventsRaw);
    const editions = z.array(editionRowSchema).parse(editionsRaw);
    const races = z.array(raceRowSchema).parse(racesRaw);
    const entitlements = z.array(entitlementRowSchema).parse(entitlementsRaw);
    const now = new Date();

    const adminUserIds = new Set(users.filter((user) => isAdminAppMetadata(user.app_metadata)).map((user) => user.user_id));
    const nonAdminUsers = users.filter((user) => !adminUserIds.has(user.user_id));
    const nonAdminUserIds = new Set(nonAdminUsers.map((user) => user.user_id));
    const nonAdminPlans = plans.filter((plan) => nonAdminUserIds.has(plan.user_id));
    const nonAdminSubscriptions = subscriptions.filter((subscription) => nonAdminUserIds.has(subscription.user_id));

    const newAccounts = nonAdminUsers.filter((user) => user.email && between(user.created_at, range.start, range.end));
    const activatedUserIds = new Set(newAccounts.flatMap((user) => {
      const accountCreatedAt = new Date(user.created_at).getTime();
      return nonAdminPlans.some((plan) => {
        const planCreatedAt = new Date(plan.created_at).getTime();
        return plan.user_id === user.user_id && planCreatedAt >= accountCreatedAt && planCreatedAt <= accountCreatedAt + 24 * 3600 * 1000;
      }) ? [user.user_id] : [];
    }));
    const activatedUsers = activatedUserIds.size;
    const activePlanUsers = new Set(nonAdminPlans.filter((plan) => between(plan.updated_at, range.start, range.end)).map((plan) => plan.user_id)).size;
    const activePremiumUsers = nonAdminSubscriptions.filter((subscription) =>
      ["active", "trialing"].includes(subscription.status ?? "") && (!subscription.current_period_end || subscription.current_period_end > now.toISOString())
    ).length;

    const activeMemberships = memberships.filter((membership) => !membership.revoked_at && nonAdminUserIds.has(membership.user_id));
    const ownerMemberships = activeMemberships.filter((membership) => membership.role === "owner");
    const eventById = new Map(events.map((event) => [event.id, event]));
    const userById = new Map(users.map((user) => [user.user_id, user]));
    const racesByEvent = new Map<string, typeof races>();
    for (const race of races) if (race.event_id) racesByEvent.set(race.event_id, [...(racesByEvent.get(race.event_id) ?? []), race]);

    const activeOrganizers = new Set(activeMemberships.filter((membership) => {
      const lastSignInAt = userById.get(membership.user_id)?.last_sign_in_at;
      return between(lastSignInAt, range.start, range.end);
    }).map((membership) => membership.user_id)).size;
    const returningOrganizers = new Set(activeMemberships.flatMap((membership) => {
      const lastActivity = userById.get(membership.user_id)?.last_sign_in_at;
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
      const lastActivityAt = userById.get(membership.user_id)?.last_sign_in_at ?? membership.created_at;
      const daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / (24 * 3600 * 1000)));
      if (status === "published" || daysInactive < 3) return [];
      return [{ eventId: event.id, eventName: event.name, organizerEmail: userById.get(membership.user_id)?.email ?? membership.user_id, lastActivityAt, status, daysInactive }];
    }).sort((left, right) => right.daysInactive - left.daysInactive).slice(0, 20);

    const selfCreatedMemberships = activeMemberships.filter((membership) => membership.created_by === membership.user_id);
    const newOrganizers = new Set(selfCreatedMemberships
      .filter((membership) => between(membership.created_at, range.start, range.end))
      .map((membership) => membership.user_id)).size;
    const eligibleEventIds = new Set(activeMemberships.map((membership) => membership.event_id));
    const eligibleEditionIds = new Set(editions.filter((edition) => eligibleEventIds.has(edition.event_id)).map((edition) => edition.id));
    const activeRacebookEntitlements = entitlements.filter((entitlement) =>
      eligibleEditionIds.has(entitlement.edition_id) && entitlement.status === "active" && ["racebook", "pro"].includes(entitlement.tier)
    );
    const activatedRacebooks = activeRacebookEntitlements.length;
    const giftedRacebooks = activeRacebookEntitlements.filter((entitlement) => ["admin", "legacy_admin"].includes(entitlement.source)).length;
    const paidRacebooks = activeRacebookEntitlements.filter((entitlement) => entitlement.source === "stripe").length;
    const eventsCreated = selfCreatedMemberships.filter((membership) => membership.role === "owner" && between(membership.created_at, range.start, range.end)).length;
    const eligibleRaces = races.filter((race) => Boolean(race.event_id && eligibleEventIds.has(race.event_id)));
    const formatsCreated = eligibleRaces.filter((race) => between(race.created_at, range.start, range.end)).length;
    const publishedRacebooks = eligibleRaces.filter((race) => between(race.racebook_publication_approved_at, range.start, range.end)).length;

    const actions: Array<{ id: string; audience: "web" | "app" | "organizers"; severity: "info" | "warning" | "critical"; title: string; detail: string }> = [];
    if (followUps.length > 0) actions.push({
      id: "organizer-follow-ups", audience: "organizers", severity: followUps.some((item) => item.daysInactive >= 14) ? "critical" : "warning",
      title: `${followUps.length} événement(s) organisateur à relancer`, detail: "Ces événements sont incomplets ou prêts à publier, mais leur contenu n'a pas été modifié récemment.",
    });
    if (newAccounts.length >= 5 && activatedUsers / newAccounts.length < 0.3) actions.push({
      id: "activation-24h", audience: "app", severity: "warning", title: "Peu de nouveaux comptes atteignent leur premier plan",
      detail: "Moins de 30 % des nouveaux comptes ont créé un plan dans les 24 heures.",
    });

    const response = {
      range,
      overview: { newAccounts: newAccounts.length, activatedUsers, activePlanUsers, newPlans: nonAdminPlans.filter((plan) => between(plan.created_at, range.start, range.end)).length, activePremiumUsers },
      trend: buildTrend(range.start, range.end, nonAdminUsers, nonAdminPlans, activatedUserIds),
      organizers: {
        newOrganizers,
        activeOrganizers, returningOrganizers, eventsCreated,
        editionsCreated: editions.filter((edition) => eligibleEventIds.has(edition.event_id) && between(edition.created_at, range.start, range.end)).length,
        formatsCreated, publishedRacebooks,
        activatedRacebooks, giftedRacebooks, paidRacebooks,
        funnel: [
          { step: "Nouveaux organisateurs", count: newOrganizers, conversionFromPrevious: null },
          { step: "Événements créés", count: eventsCreated, conversionFromPrevious: pct(eventsCreated, newOrganizers) },
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

import { z } from "zod";

import { runnerSubscriptionRowSchema, runnerSupportRowSchema, runnerUnlockRowSchema, raceIdOfPlanKey } from "./admin-billing";
import { ADMIN_MESSAGE_COLUMNS, adminMessageRowSchema } from "./admin-messages";
import {
  authUserRowSchema,
  buildRunnerProfile,
  feedbackRowSchema,
  grantRowSchema,
  planRowSchema,
  profileRowSchema,
  raceRequestRowSchema,
  RECENT_PLAN_LIMIT,
  subscriptionRowSchema,
  type RunnerProfile,
} from "./admin-runner-profile";
import { getServiceJson, getServiceResponse, serviceRestHeaders, settleSource } from "./admin-service-rest";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loader of `GET /api/admin/users/[id]` (service role, read-only). The Auth user is required (404
 * otherwise); every other source is settled on its own and listed in `unavailable` when it fails, so
 * the drawer still opens. Logs carry the source name only, never the runner's e-mail.
 */

const LIST_LIMIT = 50;

export const RUNNER_PROFILE_SOURCES = {
  profile: "profil",
  subscriptions: "abonnement",
  grants: "attributions Premium",
  plans: "plans",
  purchases: "achats",
  messages: "messages",
  feedback: "retours",
  raceRequests: "demandes de course",
} as const;

export type RunnerProfileResult = { profile: RunnerProfile; unavailable: string[] };

const loadAuthUser = async (supabase: SupabaseServiceConfig, userId: string) => {
  const response = await fetch(`${supabase.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: serviceRestHeaders(supabase), cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Auth user read failed (${response.status}).`);
  return authUserRowSchema.parse(await response.json());
};

const countPlans = async (supabase: SupabaseServiceConfig, userId: string) => {
  const response = await getServiceResponse(supabase, `race_plans?user_id=eq.${userId}&select=id&limit=1`, { Prefer: "count=exact" });
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0) || 0;
};

const loadRaceNames = async (supabase: SupabaseServiceConfig, raceIds: string[]) => {
  const ids = [...new Set(raceIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length) return new Map<string, string>();
  const rows = z.array(z.object({ id: z.string(), name: z.string() })).parse(await getServiceJson(supabase, `races?id=in.(${ids.join(",")})&select=id,name`));
  return new Map(rows.map((row) => [row.id, row.name]));
};

export const loadRunnerProfile = async (supabase: SupabaseServiceConfig, userId: string, now = new Date()): Promise<RunnerProfileResult | null> => {
  const user = await loadAuthUser(supabase, userId);
  if (!user) return null;
  const read = <T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>) => async () => schema.parse(await getServiceJson(supabase, path));
  const id = encodeURIComponent(userId);

  const [profile, subscriptions, grants, plans, planCount, purchases, messages, feedback, raceRequests] = await Promise.all([
    settleSource(read(`user_profiles?user_id=eq.${id}&select=user_id,full_name,sign_in_count,first_sign_in_at,last_sign_in_at,trial_ends_at,onboarding_completed_at,age,water_bag_liters,utmb_index,comfortable_flat_pace_min_per_km&limit=1`, z.array(profileRowSchema))(), "Runner profile: profile"),
    settleSource(read(`subscriptions?user_id=eq.${id}&select=user_id,status,provider,current_period_end,updated_at`, z.array(subscriptionRowSchema))(), "Runner profile: subscriptions"),
    settleSource(read(`premium_grants?user_id=eq.${id}&select=id,user_id,starts_at,initial_duration_days,reason,ends_at,created_at&order=starts_at.desc&limit=${LIST_LIMIT}`, z.array(grantRowSchema))(), "Runner profile: grants"),
    settleSource(read(`race_plans?user_id=eq.${id}&select=id,name,created_at,updated_at&order=updated_at.desc&limit=${RECENT_PLAN_LIMIT}`, z.array(planRowSchema))(), "Runner profile: plans"),
    settleSource(countPlans(supabase, id), "Runner profile: plan count"),
    settleSource((async () => {
      const [unlocks, subscriptionAccounts, support] = await Promise.all([
        read(`runner_plan_unlocks?user_id=eq.${id}&select=id,user_id,plan_key,provider,provider_transaction_id,status,purchased_at&order=purchased_at.desc&limit=${LIST_LIMIT}`, z.array(runnerUnlockRowSchema))(),
        read(`runner_subscription_accounts?user_id=eq.${id}&select=id,user_id,provider,provider_subscription_id,status,current_period_end,created_at&order=created_at.desc&limit=${LIST_LIMIT}`, z.array(runnerSubscriptionRowSchema))(),
        read(`runner_support_purchases?user_id=eq.${id}&select=id,user_id,provider,status,purchased_at&order=purchased_at.desc&limit=${LIST_LIMIT}`, z.array(runnerSupportRowSchema))(),
      ]);
      const raceNames = await loadRaceNames(supabase, unlocks.map((row) => raceIdOfPlanKey(row.plan_key)).filter((value): value is string => Boolean(value))).catch(() => new Map<string, string>());
      return { unlocks, subscriptionAccounts, support, raceNames };
    })(), "Runner profile: purchases"),
    settleSource(read(`user_notifications?user_id=eq.${id}&select=${ADMIN_MESSAGE_COLUMNS}&order=created_at.desc&limit=${LIST_LIMIT}`, z.array(adminMessageRowSchema))(), "Runner profile: messages"),
    settleSource(read(`app_feedback?user_id=eq.${id}&select=id,created_at,kind,subject,status,source&order=created_at.desc&limit=${LIST_LIMIT}`, z.array(feedbackRowSchema))(), "Runner profile: feedback"),
    settleSource(read(`race_requests?user_id=eq.${id}&select=id,created_at,race_name,location,requested_date,status&order=created_at.desc&limit=${LIST_LIMIT}`, z.array(raceRequestRowSchema))(), "Runner profile: race requests"),
  ]);

  const unavailable = ([
    profile === null ? RUNNER_PROFILE_SOURCES.profile : null,
    subscriptions === null ? RUNNER_PROFILE_SOURCES.subscriptions : null,
    grants === null ? RUNNER_PROFILE_SOURCES.grants : null,
    plans === null ? RUNNER_PROFILE_SOURCES.plans : null,
    purchases === null ? RUNNER_PROFILE_SOURCES.purchases : null,
    messages === null ? RUNNER_PROFILE_SOURCES.messages : null,
    feedback === null ? RUNNER_PROFILE_SOURCES.feedback : null,
    raceRequests === null ? RUNNER_PROFILE_SOURCES.raceRequests : null,
  ] as Array<string | null>).filter((value): value is string => value !== null);

  return {
    profile: buildRunnerProfile({
      user,
      profile: profile?.[0] ?? null,
      subscriptions: subscriptions ?? [],
      grants: grants ?? [],
      plans: plans ?? [],
      planCount: planCount ?? plans?.length ?? 0,
      unlocks: purchases?.unlocks ?? [],
      subscriptionAccounts: purchases?.subscriptionAccounts ?? [],
      support: purchases?.support ?? [],
      raceNames: purchases?.raceNames,
      messages: messages ?? [],
      feedback: feedback ?? [],
      raceRequests: raceRequests ?? [],
    }, now),
    unavailable,
  };
};

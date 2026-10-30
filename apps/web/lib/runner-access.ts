import { getSupabaseServiceConfig, isAdminUser, type SupabaseUser } from "./supabase";
import { getUserEntitlements } from "./entitlements";

export type RunnerAccessMode = "real" | "free" | "premium";
export type RunnerPlanAccess = {
  enabled: boolean; isPremium: boolean; hasPlanUnlock: boolean; canEdit: boolean; canViewDetails: boolean;
  mode?: RunnerAccessMode;
  source: "admin" | "subscription" | "plan_unlock" | "historical_subscription" | "free";
};

export async function runnerRest<T>(path: string): Promise<T | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: config.supabaseServiceRoleKey, Authorization: `Bearer ${config.supabaseServiceRoleKey}` }, cache: "no-store",
  });
  // Old deployments do not yet have the new tables. Every other failure is an outage, not free access.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Runner access service unavailable");
  return response.json() as Promise<T>;
}

export async function getRunnerMonetizationEnabled() {
  const rows = await runnerRest<Array<{ monetization_enabled: boolean }>>("runner_monetization_config?id=eq.true&select=monetization_enabled&limit=1");
  return rows?.[0]?.monetization_enabled === true;
}

export function getRunnerSessionId(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.session_id === "string" && /^[0-9a-f-]{36}$/i.test(payload.session_id) ? payload.session_id : null;
  } catch { return null; }
}

// The caller must validate the token with Auth before passing the normalized user here.
export async function getRunnerAdminMode(user: SupabaseUser, token: string): Promise<RunnerAccessMode> {
  if (!isAdminUser(user)) return "real";
  const sid = getRunnerSessionId(token);
  if (!sid) return "real";
  const rows = await runnerRest<Array<{ mode: RunnerAccessMode }>>(`runner_admin_access_modes?session_id=eq.${sid}&user_id=eq.${encodeURIComponent(user.id)}&select=mode&limit=1`);
  return rows?.[0]?.mode ?? "real";
}

export async function getOwnedRunnerPlan(userId: string, planId: string) {
  const rows = await runnerRest<Array<{ id: string; race_id: string | null; races?: { edition_id?: string | null } | null }>>(
    `race_plans?id=eq.${encodeURIComponent(planId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,race_id,races(edition_id)&limit=1`,
  );
  const plan = rows?.[0];
  if (!plan) return null;
  return { ...plan, planKey: plan.race_id ? `race:${plan.race_id}:edition:${plan.races?.edition_id ?? "legacy"}` : `plan:${plan.id}` };
}

export const getRunnerPlanAccess = async (
  userId: string, planId: string,
  options?: { adminMode?: RunnerAccessMode; subscriptionActive?: boolean; hasHistoricalDetail?: boolean; planKey?: string },
): Promise<RunnerPlanAccess> => {
  const enabled = await getRunnerMonetizationEnabled();
  const base: RunnerPlanAccess = { enabled, isPremium: false, hasPlanUnlock: false, canEdit: false, canViewDetails: false, source: "free", mode: options?.adminMode ?? "real" };
  if (!enabled) return { ...base, canEdit: true, canViewDetails: true };
  if (options?.adminMode === "premium") return { ...base, isPremium: true, canEdit: true, canViewDetails: true, source: "admin" };
  if (options?.adminMode === "free") return base;
  const entitlement = options?.subscriptionActive === undefined ? await getUserEntitlements(userId) : null;
  const subscriptions = await runnerRest<Array<{ current_period_end: string | null }>>(`runner_subscription_accounts?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing)&select=current_period_end`);
  const paid = options?.subscriptionActive || entitlement?.isPremium || subscriptions?.some((row) => row.current_period_end !== null && Date.parse(row.current_period_end) > Date.now());
  if (paid) return { ...base, isPremium: true, canEdit: true, canViewDetails: true, source: "subscription" };
  const planKey = options?.planKey ?? (await getOwnedRunnerPlan(userId, planId))?.planKey ?? `plan:${planId}`;
  const rows = await runnerRest<Array<{ status: string }>>(`runner_plan_unlocks?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&or=(plan_key.eq.${encodeURIComponent(planKey)},plan_id.eq.${encodeURIComponent(planId)})&select=status&limit=1`);
  if (rows?.length) return { ...base, hasPlanUnlock: true, canEdit: true, canViewDetails: true, source: "plan_unlock" };
  const history = await runnerRest<Array<{ detailed_access_granted: boolean }>>(`runner_plan_history?plan_id=eq.${encodeURIComponent(planId)}&user_id=eq.${encodeURIComponent(userId)}&detailed_access_granted=eq.true&select=detailed_access_granted&limit=1`);
  if (options?.hasHistoricalDetail || history?.length) return { ...base, canViewDetails: true, source: "historical_subscription" };
  return base;
};

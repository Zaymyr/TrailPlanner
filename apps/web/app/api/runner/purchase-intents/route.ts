import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { getOwnedRunnerPlan, getRunnerAdminMode, getRunnerMonetizationEnabled, getRunnerPlanAccess } from "../../../../lib/runner-access";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig, isAnonymousUser } from "../../../../lib/supabase";

const schema = z.object({ planId: z.string().uuid(), provider: z.enum(["google", "apple"]) });
const cancelSchema = z.object({ intentId: z.string().uuid() });
const startSchema = z.object({ intentId: z.string().uuid() });
const json = (body: unknown, status = 200) => withSecurityHeaders(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));

export async function POST(request: Request) {
  const anon = getSupabaseAnonConfig();
  const service = getSupabaseServiceConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!anon || !service) return json({ message: "Server configuration is missing." }, 500);
  if (!token) return json({ message: "Authentication required." }, 401);
  const user = await fetchSupabaseUser(token, anon);
  if (!user?.id || isAnonymousUser(user)) return json({ message: "Authenticated account required." }, 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ message: "Invalid request." }, 400);
  const rateLimit = await checkRateLimitAsync(`runner:purchase-intent:${user.id}`, 8, 60_000);
  if (!rateLimit.allowed) return json({ message: "Too many purchase attempts." }, 429);

  const [enabled, adminMode, plan] = await Promise.all([
    getRunnerMonetizationEnabled(),
    getRunnerAdminMode(user, token),
    getOwnedRunnerPlan(user.id, body.data.planId),
  ]);
  if (!enabled) return json({ message: "Purchases are not enabled." }, 409);
  if (adminMode !== "real") return json({ message: "Purchases are disabled in admin simulation mode." }, 409);
  if (!plan) return json({ message: "Plan not found." }, 404);
  const access = await getRunnerPlanAccess(user.id, plan.id, { adminMode, planKey: plan.planKey });
  if (access.canEdit) return json({ message: "This plan is already unlocked.", access }, 409);

  const productId = process.env.REVENUECAT_COURSE_PRODUCT_ID?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_COURSE_PRODUCT_ID?.trim();
  if (!productId) return json({ message: "Course product is not configured." }, 503);
  const headers = { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json" };
  const pendingResponse = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.${body.data.provider}&status=eq.pending&select=id,plan_id,plan_key,product_id,expires_at,store_started_at&limit=1`, { headers, cache: "no-store" });
  if (!pendingResponse.ok) return json({ message: "Unable to recover purchase intent." }, 503);
  const pending = ((await pendingResponse.json()) as Array<{ id: string; plan_id: string; plan_key: string; product_id: string | null; expires_at: string; store_started_at: string | null }>)[0];
  if (pending && Date.parse(pending.expires_at) > Date.now()) {
    if (pending.plan_id !== plan.id || pending.product_id !== productId) return json({ message: "Another store purchase is still pending.", pendingPlanId: pending.plan_id }, 409);
    return json({ intentId: pending.id, productId, recovered: true, storeStarted: Boolean(pending.store_started_at), expiresAt: pending.expires_at });
  }
  if (pending) {
    const expire = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?id=eq.${pending.id}&status=eq.pending`, { method: "PATCH", headers, body: JSON.stringify({ status: "expired", failure_reason: "intent_expired" }) });
    if (!expire.ok) return json({ message: "Unable to expire stale purchase intent." }, 503);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents`, {
    method: "POST", headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ user_id: user.id, plan_id: plan.id, plan_key: plan.planKey, provider: body.data.provider, product_id: productId, expires_at: expiresAt }),
  });
  if (!response.ok) return json({ message: "Unable to create purchase intent." }, response.status === 409 ? 409 : 503);
  const row = ((await response.json()) as Array<{ id: string }>)[0];
  if (!row?.id) return json({ message: "Unable to create purchase intent." }, 503);
  return json({ intentId: row.id, productId, recovered: false, storeStarted: false, expiresAt });
}

export async function PATCH(request: Request) {
  const anon = getSupabaseAnonConfig();
  const service = getSupabaseServiceConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!anon || !service) return json({ message: "Server configuration is missing." }, 500);
  if (!token) return json({ message: "Authentication required." }, 401);
  const user = await fetchSupabaseUser(token, anon);
  if (!user?.id || isAnonymousUser(user)) return json({ message: "Authenticated account required." }, 403);
  const body = startSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ message: "Invalid request." }, 400);
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?id=eq.${body.data.intentId}&user_id=eq.${user.id}&status=eq.pending&store_started_at=is.null`, {
    method: "PATCH",
    headers: { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ store_started_at: new Date().toISOString() }),
  });
  if (!response.ok) return json({ message: "Unable to start purchase." }, 503);
  const rows = await response.json() as Array<{ id: string }>;
  if (!rows.length) return json({ message: "Purchase is already in progress." }, 409);
  return json({ started: true });
}

export async function DELETE(request: Request) {
  const anon = getSupabaseAnonConfig();
  const service = getSupabaseServiceConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!anon || !service) return json({ message: "Server configuration is missing." }, 500);
  if (!token) return json({ message: "Authentication required." }, 401);
  const user = await fetchSupabaseUser(token, anon);
  if (!user?.id || isAnonymousUser(user)) return json({ message: "Authenticated account required." }, 403);
  const body = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ message: "Invalid request." }, 400);
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?id=eq.${body.data.intentId}&user_id=eq.${user.id}&status=eq.pending&transaction_id=is.null`, {
    method: "PATCH",
    headers: {
      apikey: service.supabaseServiceRoleKey,
      Authorization: `Bearer ${service.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "cancelled", failure_reason: "user_cancelled" }),
  });
  if (!response.ok) return json({ message: "Unable to cancel purchase intent." }, 503);
  const rows = await response.json() as Array<{ id: string }>;
  return json({ cancelled: rows.length > 0 });
}

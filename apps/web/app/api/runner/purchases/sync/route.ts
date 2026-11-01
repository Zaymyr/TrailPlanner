import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { getRunnerAdminMode, getRunnerMonetizationEnabled } from "../../../../../lib/runner-access";
import { findVerifiedCoursePurchase, getRevenueCatTransactionId } from "../../../../../lib/runner-payments";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig, isAnonymousUser } from "../../../../../lib/supabase";

const schema = z.object({ intentId: z.string().uuid(), transactionId: z.string().trim().min(1).max(300).optional() });
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
  const [enabled, adminMode] = await Promise.all([getRunnerMonetizationEnabled(), getRunnerAdminMode(user, token)]);
  if (!enabled || adminMode !== "real") return json({ message: "Real purchases are disabled." }, 409);

  const headers = { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json" };
  const intentResponse = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?id=eq.${body.data.intentId}&user_id=eq.${user.id}&select=id,plan_id,plan_key,provider,product_id,status,transaction_id,created_at,expires_at&limit=1`, { headers, cache: "no-store" });
  if (!intentResponse.ok) return json({ message: "Unable to load purchase intent." }, 503);
  const intent = ((await intentResponse.json()) as Array<{ id: string; plan_id: string | null; plan_key: string; provider: "google" | "apple"; product_id: string; status: string; transaction_id: string | null; created_at: string; expires_at: string }>)[0];
  if (!intent) return json({ message: "Purchase intent not found." }, 404);
  if (intent.status === "fulfilled") return json({ granted: true, status: "fulfilled", planId: intent.plan_id, transactionId: intent.transaction_id });
  if (intent.status !== "pending") return json({ granted: false, status: intent.status, planId: intent.plan_id }, 409);

  const secret = process.env.REVENUECAT_SECRET_API_KEY?.trim() || process.env.REVENUECAT_API_KEY?.trim();
  if (!secret) return json({ message: "RevenueCat verification is not configured." }, 503);
  const subscriber = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
  if (!subscriber.ok) return json({ message: "Unable to verify store purchase." }, 502);
  const payload = await subscriber.json() as { subscriber?: { non_subscriptions?: Record<string, Array<{ id?: string; transaction_identifier?: string; store_transaction_id?: string; purchase_date?: string; store?: string }>> } };
  const verified = findVerifiedCoursePurchase(payload.subscriber, intent.product_id, body.data.transactionId ?? null, intent.created_at, intent.provider);
  if (!verified) return json({ granted: false, status: "pending", planId: intent.plan_id }, 202);
  const transactionId = getRevenueCatTransactionId(verified);
  if (!transactionId || !verified.purchase_date) return json({ message: "Store transaction is incomplete." }, 422);
  const unlock = await fetch(`${service.supabaseUrl}/rest/v1/rpc/claim_runner_plan_unlock`, {
    method: "POST", headers,
    body: JSON.stringify({ p_user_id: user.id, p_plan_id: intent.plan_id, p_provider: intent.provider, p_transaction_id: transactionId, p_product_id: intent.product_id, p_purchased_at: verified.purchase_date, p_intent_id: intent.id }),
  });
  if (!unlock.ok) return json({ message: "Unable to claim verified transaction." }, 503);
  if ((await unlock.json().catch(() => false)) !== true) return json({ message: "Transaction belongs to another plan, expired, or was refunded." }, 409);
  return json({ granted: true, status: "fulfilled", planId: intent.plan_id, transactionId });
}

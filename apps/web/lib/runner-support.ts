import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";

export type RunnerSupportProvider = "apple" | "google";

export class RunnerSupportIntentConflictError extends Error {
  constructor(message = "A support purchase is already pending.") {
    super(message);
    this.name = "RunnerSupportIntentConflictError";
  }
}

export type VerifiedSupportPurchase = {
  productId: string;
  provider: RunnerSupportProvider;
  purchasedAt: string;
  transactionId: string;
};

type SupportPurchaseRow = {
  product_id: string;
  provider: RunnerSupportProvider;
  status: "active" | "refunded";
  transaction_id: string;
};

type SupportIntentRow = {
  expires_at: string;
  id: string;
  product_id: string;
  provider: RunnerSupportProvider;
  status: "pending" | "fulfilled" | "cancelled" | "expired";
  transaction_id: string | null;
};

const purchaseSchema = z.object({
  id: z.string().optional(),
  purchase_date: z.string().optional(),
  store: z.string().optional(),
  store_transaction_id: z.string().optional(),
  transaction_identifier: z.string().optional(),
});

const subscriberSchema = z.object({
  subscriber: z.object({
    non_subscriptions: z.record(z.array(purchaseSchema)).optional().default({}),
  }),
});

function serviceHeaders() {
  const service = getSupabaseServiceConfig();
  if (!service) return null;
  return {
    service,
    headers: {
      apikey: service.supabaseServiceRoleKey,
      Authorization: `Bearer ${service.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
}

export function getRunnerSupportProductId(provider: RunnerSupportProvider) {
  const platformProduct = provider === "apple"
    ? process.env.REVENUECAT_IOS_SUPPORT_PRODUCT_ID?.trim()
    : process.env.REVENUECAT_ANDROID_SUPPORT_PRODUCT_ID?.trim();
  return platformProduct
    || process.env.REVENUECAT_SUPPORT_PRODUCT_ID?.trim()
    || process.env.EXPO_PUBLIC_REVENUECAT_SUPPORT_PRODUCT_ID?.trim()
    || null;
}

export function findVerifiedSupportPurchase(
  subscriber: z.infer<typeof subscriberSchema>["subscriber"] | null | undefined,
  options: {
    productId: string;
    provider: RunnerSupportProvider;
    transactionId?: string | null;
  },
): VerifiedSupportPurchase | null {
  const purchases = subscriber?.non_subscriptions?.[options.productId] ?? [];
  const expectedStores = options.provider === "apple"
    ? new Set(["APP_STORE", "MAC_APP_STORE"])
    : new Set(["PLAY_STORE"]);

  const matches = purchases.flatMap((purchase) => {
    const transactionId = purchase.transaction_identifier
      ?? purchase.store_transaction_id
      ?? purchase.id
      ?? null;
    const purchasedAtMs = Date.parse(purchase.purchase_date ?? "");
    const store = purchase.store?.trim().toUpperCase() ?? "";
    if (!transactionId || !Number.isFinite(purchasedAtMs) || !expectedStores.has(store)) return [];
    if (options.transactionId && transactionId !== options.transactionId) return [];
    return [{
      productId: options.productId,
      provider: options.provider,
      purchasedAt: new Date(purchasedAtMs).toISOString(),
      transactionId,
    } satisfies VerifiedSupportPurchase];
  });

  return matches.sort((left, right) => Date.parse(right.purchasedAt) - Date.parse(left.purchasedAt))[0] ?? null;
}

function getRevenueCatApiKeys(provider: RunnerSupportProvider) {
  const keys = [
    provider === "apple"
      ? process.env.REVENUECAT_IOS_SECRET_API_KEY?.trim() || process.env.REVENUECAT_IOS_PUBLIC_API_KEY?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()
      : process.env.REVENUECAT_ANDROID_SECRET_API_KEY?.trim() || process.env.REVENUECAT_ANDROID_PUBLIC_API_KEY?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim(),
    process.env.REVENUECAT_SECRET_API_KEY?.trim(),
    process.env.REVENUECAT_API_KEY?.trim(),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(keys)];
}

export async function verifyRevenueCatSupportPurchase(options: {
  productId: string;
  provider: RunnerSupportProvider;
  transactionId?: string | null;
  userId: string;
}) {
  const keys = getRevenueCatApiKeys(options.provider);
  for (const key of keys) {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(options.userId)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      },
    ).catch(() => null);
    if (!response?.ok) continue;
    const parsed = subscriberSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) continue;
    const purchase = findVerifiedSupportPurchase(parsed.data.subscriber, options);
    if (purchase) return purchase;
  }
  return null;
}

export async function getRunnerSupportPurchase(userId: string): Promise<SupportPurchaseRow | null> {
  const config = serviceHeaders();
  if (!config) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(
    `${config.service.supabaseUrl}/rest/v1/runner_support_purchases?user_id=eq.${encodeURIComponent(userId)}&select=provider,product_id,transaction_id,status&limit=1`,
    { cache: "no-store", headers: config.headers },
  );
  if (!response.ok) throw new Error(`Unable to read support purchase: ${await response.text()}`);
  return ((await response.json()) as SupportPurchaseRow[])[0] ?? null;
}

export async function createRunnerSupportIntent(options: {
  productId: string;
  provider: RunnerSupportProvider;
  userId: string;
}): Promise<SupportIntentRow> {
  const config = serviceHeaders();
  if (!config) throw new Error("Supabase service configuration is missing.");
  const baseUrl = `${config.service.supabaseUrl}/rest/v1/runner_support_purchase_intents`;
  const pendingResponse = await fetch(
    `${baseUrl}?user_id=eq.${encodeURIComponent(options.userId)}&status=eq.pending&select=id,provider,product_id,status,transaction_id,expires_at&limit=1`,
    { cache: "no-store", headers: config.headers },
  );
  if (!pendingResponse.ok) throw new Error(`Unable to recover support intent: ${await pendingResponse.text()}`);
  const pending = ((await pendingResponse.json()) as SupportIntentRow[])[0] ?? null;
  if (pending && Date.parse(pending.expires_at) > Date.now()) {
    throw new RunnerSupportIntentConflictError("A support purchase is already pending for this account.");
  }
  if (pending) {
    const expired = await fetch(`${baseUrl}?id=eq.${pending.id}&status=eq.pending`, {
      method: "PATCH",
      headers: config.headers,
      body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }),
    });
    if (!expired.ok) throw new Error(`Unable to expire support intent: ${await expired.text()}`);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const created = await fetch(baseUrl, {
    method: "POST",
    headers: { ...config.headers, Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: options.userId,
      provider: options.provider,
      product_id: options.productId,
      expires_at: expiresAt,
    }),
  });
  if (!created.ok) {
    if (created.status === 409) throw new RunnerSupportIntentConflictError();
    throw new Error(`Unable to create support intent: ${await created.text()}`);
  }
  const row = ((await created.json()) as SupportIntentRow[])[0];
  if (!row?.id) throw new Error("Support intent creation returned no row.");
  return row;
}

export async function cancelRunnerSupportIntent(options: { intentId: string; userId: string }) {
  const config = serviceHeaders();
  if (!config) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(
    `${config.service.supabaseUrl}/rest/v1/runner_support_purchase_intents?id=eq.${encodeURIComponent(options.intentId)}&user_id=eq.${encodeURIComponent(options.userId)}&status=eq.pending&transaction_id=is.null`,
    {
      method: "PATCH",
      headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(`Unable to cancel support intent: ${await response.text()}`);
  return ((await response.json()) as Array<{ id: string }>).length > 0;
}

export async function claimRunnerSupportPurchase(options: VerifiedSupportPurchase & {
  intentId?: string | null;
  userId: string;
}) {
  const config = serviceHeaders();
  if (!config) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(`${config.service.supabaseUrl}/rest/v1/rpc/claim_runner_support_purchase`, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify({
      p_user_id: options.userId,
      p_provider: options.provider,
      p_product_id: options.productId,
      p_transaction_id: options.transactionId,
      p_purchased_at: options.purchasedAt,
      p_intent_id: options.intentId ?? null,
    }),
  });
  if (!response.ok) throw new Error(`Unable to claim support purchase: ${await response.text()}`);
  return (await response.json().catch(() => false)) === true;
}

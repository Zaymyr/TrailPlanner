import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { getStripeConfig, getStripeJson, postStripeForm } from "../../../../lib/stripe";
import { getOwnedRunnerPlan, getRunnerAdminMode, getRunnerMonetizationEnabled, getRunnerPlanAccess, runnerRest } from "../../../../lib/runner-access";
import {
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  extractBearerToken,
  fetchSupabaseUser,
  isAnonymousUser,
} from "../../../../lib/supabase";

const requestSchema = z.object({
  offer: z.enum(["annual", "course"]).default("annual"),
  raceId: z.string().trim().min(1).max(200).optional(),
  editionId: z.string().trim().min(1).max(200).optional(),
  planId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.offer === "course" && !value.planId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["planId"], message: "A saved plan is required for a course purchase." });
  }
});

const subscriptionRowSchema = z.array(
  z.object({
    user_id: z.string(),
    stripe_customer_id: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    current_period_end: z.string().nullable().optional(),
  })
);

const upsertSubscriptionCustomer = async (userId: string, customerId: string) => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return;

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: serviceConfig.supabaseServiceRoleKey,
      Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      user_id: userId,
      stripe_customer_id: customerId,
      provider: "web",
    }),
  });
  if (!response.ok) throw new Error(`Unable to persist Stripe customer: ${await response.text()}`);
};

const fetchSubscription = async (userId: string) => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return null;

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(
        userId
      )}&select=user_id,stripe_customer_id,status,current_period_end&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to read subscription", await response.text());
      return null;
    }

    const row = subscriptionRowSchema.parse(await response.json())?.[0];
    return row ?? null;
  } catch (error) {
    console.error("Unexpected error while loading subscription", error);
    return null;
  }
};

export async function POST(request: NextRequest) {
  const stripeConfig = getStripeConfig();
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!stripeConfig || !supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (isAnonymousUser(user)) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Guest accounts must create a full account before subscribing." },
        { status: 403 }
      )
    );
  }

  const [monetizationEnabled, adminMode] = await Promise.all([
    getRunnerMonetizationEnabled(),
    getRunnerAdminMode(user, token),
  ]);
  if (!monetizationEnabled) {
    return withSecurityHeaders(NextResponse.json({ message: "Purchases are not enabled." }, { status: 409 }));
  }
  if (adminMode !== "real") {
    return withSecurityHeaders(NextResponse.json({ message: "Purchases are disabled in admin simulation mode." }, { status: 409 }));
  }

  const rateLimit = await checkRateLimitAsync(`stripe:checkout:${user.id}`, 5, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many checkout attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const body = requestSchema.safeParse(await request.json().catch(() => ({})));

  if (!body.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  let ownedPlan: Awaited<ReturnType<typeof getOwnedRunnerPlan>> = null;
  if (body.data.offer === "course") {
    ownedPlan = await getOwnedRunnerPlan(user.id, body.data.planId!);
    if (!ownedPlan) return withSecurityHeaders(NextResponse.json({ message: "Plan not found." }, { status: 404 }));
    const access = await getRunnerPlanAccess(user.id, ownedPlan.id, { adminMode, planKey: ownedPlan.planKey });
    if (access.canEdit) return withSecurityHeaders(NextResponse.json({ message: "This plan is already unlocked." }, { status: 409 }));
  } else {
    const [legacy, providerAccounts] = await Promise.all([
      fetchSubscription(user.id),
      runnerRest<Array<{ current_period_end: string | null }>>(`runner_subscription_accounts?user_id=eq.${encodeURIComponent(user.id)}&status=in.(active,trialing)&select=current_period_end`),
    ]);
    const legacyActive = Boolean(legacy && ["active", "trialing"].includes(legacy.status ?? "") && (!legacy.current_period_end || Date.parse(legacy.current_period_end) > Date.now()));
    const ledgerActive = providerAccounts?.some((row) => Boolean(row.current_period_end && Date.parse(row.current_period_end) > Date.now())) ?? false;
    if (legacyActive || ledgerActive) return withSecurityHeaders(NextResponse.json({ message: "An annual subscription is already active." }, { status: 409 }));
  }

  const priceId = body.data.offer === "course"
    ? stripeConfig.coursePriceId
    : stripeConfig.annualPriceId ?? stripeConfig.priceId;

  if (!priceId) {
    return withSecurityHeaders(NextResponse.json({ message: "Stripe price is not configured." }, { status: 500 }));
  }
  const configuredPrice = await getStripeJson<{ currency?: string; unit_amount?: number; recurring?: { interval?: string; interval_count?: number } | null }>(`/v1/prices/${encodeURIComponent(priceId)}`, stripeConfig.secretKey).catch(() => null);
  const expectedAmount = body.data.offer === "course" ? 999 : 2999;
  const validPrice = configuredPrice?.currency?.toLowerCase() === "eur" && configuredPrice.unit_amount === expectedAmount && (body.data.offer === "course" ? !configuredPrice.recurring : configuredPrice.recurring?.interval === "year" && configuredPrice.recurring.interval_count === 1);
  if (!validPrice) return withSecurityHeaders(NextResponse.json({ message: "Configured Stripe price does not match this offer." }, { status: 500 }));

  let stripeIntentId: string | null = null;
  if (body.data.offer === "course" && ownedPlan) {
    const intentHeaders = { apikey: supabaseService.supabaseServiceRoleKey, Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`, "Content-Type": "application/json" };
    const pendingResponse = await fetch(`${supabaseService.supabaseUrl}/rest/v1/runner_purchase_intents?user_id=eq.${user.id}&provider=eq.stripe&status=eq.pending&select=id,plan_id,product_id,expires_at&limit=1`, { headers: intentHeaders, cache: "no-store" });
    if (!pendingResponse.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to prepare course checkout." }, { status: 503 }));
    const pending = ((await pendingResponse.json()) as Array<{ id: string; plan_id: string | null; product_id: string | null; expires_at: string }>)[0];
    if (pending && Date.parse(pending.expires_at) > Date.now()) {
      if (pending.plan_id !== ownedPlan.id || pending.product_id !== priceId) return withSecurityHeaders(NextResponse.json({ message: "Another course checkout is pending." }, { status: 409 }));
      stripeIntentId = pending.id;
    } else {
      if (pending) {
        const expired = await fetch(`${supabaseService.supabaseUrl}/rest/v1/runner_purchase_intents?id=eq.${pending.id}&status=eq.pending`, { method: "PATCH", headers: intentHeaders, body: JSON.stringify({ status: "expired", failure_reason: "intent_expired" }) });
        if (!expired.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to expire stale checkout." }, { status: 503 }));
      }
      const created = await fetch(`${supabaseService.supabaseUrl}/rest/v1/runner_purchase_intents`, {
        method: "POST", headers: { ...intentHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ user_id: user.id, plan_id: ownedPlan.id, plan_key: ownedPlan.planKey, provider: "stripe", product_id: priceId, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), store_started_at: new Date().toISOString() }),
      });
      if (!created.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to prepare course checkout." }, { status: created.status === 409 ? 409 : 503 }));
      stripeIntentId = ((await created.json()) as Array<{ id: string }>)[0]?.id ?? null;
      if (!stripeIntentId) return withSecurityHeaders(NextResponse.json({ message: "Unable to prepare course checkout." }, { status: 503 }));
    }
  }

  const requestOrigin = (() => {
    try {
      const url = new URL(request.url);
      return url.origin;
    } catch {
      return null;
    }
  })();

  const successUrl = stripeConfig.checkoutSuccessUrl ?? (requestOrigin ? `${requestOrigin}/settings?billing=success` : null);
  const cancelUrl = stripeConfig.checkoutCancelUrl ?? (requestOrigin ? `${requestOrigin}/settings?billing=cancel` : null);

  if (!successUrl || !cancelUrl) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Checkout URLs are not configured." }, { status: 500 })
    );
  }

  try {
    const existing = await fetchSubscription(user.id);
    let customerId = existing?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await postStripeForm<{ id: string }>("/v1/customers", {
        email: user.email,
        "metadata[user_id]": user.id,
      }, stripeConfig.secretKey);

      customerId = customer.id;
      await upsertSubscriptionCustomer(user.id, customerId);
    }

    const isCoursePurchase = body.data.offer === "course";
    const metadata: Record<string, string | undefined> = {
      user_id: user.id,
      purchase_type: isCoursePurchase ? "runner_course" : "runner_subscription",
      race_id: ownedPlan?.race_id ?? undefined,
      edition_id: ownedPlan?.races?.edition_id ?? undefined,
      plan_id: body.data.planId,
      plan_key: ownedPlan?.planKey,
      intent_id: stripeIntentId ?? undefined,
      product_id: isCoursePurchase ? priceId : undefined,
    };
    const session = await postStripeForm<{ url?: string }>("/v1/checkout/sessions", {
      mode: isCoursePurchase ? "payment" : "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId,
      ...(isCoursePurchase
        ? Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, value]))
        : Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`subscription_data[metadata][${key}]`, value]))),
      client_reference_id: user.id,
      "payment_intent_data[metadata][user_id]": isCoursePurchase ? user.id : undefined,
      "payment_intent_data[metadata][purchase_type]": isCoursePurchase ? "runner_course" : undefined,
      "payment_intent_data[metadata][race_id]": isCoursePurchase ? ownedPlan?.race_id ?? undefined : undefined,
      "payment_intent_data[metadata][edition_id]": isCoursePurchase ? ownedPlan?.races?.edition_id ?? undefined : undefined,
      "payment_intent_data[metadata][plan_id]": isCoursePurchase ? body.data.planId : undefined,
      "payment_intent_data[metadata][plan_key]": isCoursePurchase ? ownedPlan?.planKey : undefined,
      "payment_intent_data[metadata][intent_id]": isCoursePurchase ? stripeIntentId ?? undefined : undefined,
      "payment_intent_data[metadata][product_id]": isCoursePurchase ? priceId : undefined,
    }, stripeConfig.secretKey, {
      idempotencyKey: `runner-checkout:${user.id}:${body.data.offer}:${body.data.planId ?? "annual"}:${Math.floor(Date.now() / 3_600_000)}`,
    });

    if (!session.url) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create checkout session." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json({ url: session.url }));
  } catch (error) {
    console.error("Stripe checkout error", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to create checkout session." }, { status: 500 })
    );
  }
}

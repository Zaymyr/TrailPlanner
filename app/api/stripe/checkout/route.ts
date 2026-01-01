import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getStripeConfig, postStripeForm } from "../../../../lib/stripe";
import { getSupabaseAnonConfig, getSupabaseServiceConfig, extractBearerToken, fetchSupabaseUser } from "../../../../lib/supabase";

const requestSchema = z.object({
  priceId: z.string().optional(),
});

const subscriptionRowSchema = z.array(
  z.object({
    user_id: z.string(),
    stripe_customer_id: z.string().nullable().optional(),
  })
);

const upsertSubscriptionCustomer = async (userId: string, customerId: string) => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return;

  await fetch(`${serviceConfig.supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
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
    }),
  }).catch((error) => {
    console.error("Unable to upsert subscription customer", error);
  });
};

const fetchSubscription = async (userId: string) => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return null;

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(
        userId
      )}&select=user_id,stripe_customer_id&limit=1`,
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

  const rateLimit = checkRateLimit(`stripe:checkout:${user.id}`, 5, 60_000);

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

  const priceId = body.data.priceId ?? stripeConfig.priceId;

  if (!priceId) {
    return withSecurityHeaders(NextResponse.json({ message: "Stripe price is not configured." }, { status: 500 }));
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

    const session = await postStripeForm<{ url?: string }>("/v1/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId,
      "subscription_data[metadata][user_id]": user.id,
      client_reference_id: user.id,
    }, stripeConfig.secretKey);

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

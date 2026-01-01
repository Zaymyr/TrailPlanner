import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getStripeConfig, postStripeForm } from "../../../../lib/stripe";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../../lib/supabase";

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

    const rows = (await response.json().catch(() => null)) as Array<{ stripe_customer_id?: string | null }> | null;
    return rows?.[0] ?? null;
  } catch (error) {
    console.error("Unexpected error while loading subscription", error);
    return null;
  }
};

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

  const rateLimit = checkRateLimit(`stripe:portal:${user.id}`, 10, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many billing portal attempts. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const returnUrl = stripeConfig.billingReturnUrl;

  if (!returnUrl) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Billing portal return URL is not configured." }, { status: 500 })
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

    const session = await postStripeForm<{ url?: string }>("/v1/billing_portal/sessions", {
      customer: customerId,
      return_url: returnUrl,
    }, stripeConfig.secretKey);

    if (!session.url) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create portal session." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json({ url: session.url }));
  } catch (error) {
    console.error("Stripe portal error", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to open billing portal." }, { status: 500 }));
  }
}

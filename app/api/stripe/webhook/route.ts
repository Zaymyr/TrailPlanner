import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { getStripeConfig, StripeEvent, StripeSubscriptionEventData, verifyStripeSignature } from "../../../../lib/stripe";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

const findUserByCustomer = async (customerId: string): Promise<string | null> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return null;

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?stripe_customer_id=eq.${encodeURIComponent(
        customerId
      )}&select=user_id&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to fetch subscription by customer", await response.text());
      return null;
    }

    const row = (await response.json().catch(() => null)) as Array<{ user_id: string }> | null;
    return row?.[0]?.user_id ?? null;
  } catch (error) {
    console.error("Unexpected error while finding subscription owner", error);
    return null;
  }
};

const upsertSubscription = async (params: {
  userId: string;
  customerId?: string;
  subscriptionId?: string;
  status?: string | null;
  priceId?: string | null;
  planName?: string | null;
  currentPeriodEnd?: string | null;
}) => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return;

  const payload = {
    user_id: params.userId,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    status: params.status,
    price_id: params.priceId,
    plan_name: params.planName,
    current_period_end: params.currentPeriodEnd,
  };

  await fetch(`${serviceConfig.supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: serviceConfig.supabaseServiceRoleKey,
      Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error("Unable to upsert subscription from webhook", error);
  });
};

const fetchCoachTierIdByName = async (planName: string): Promise<string | null> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return null;

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/coach_tiers?name=eq.${encodeURIComponent(
        planName
      )}&select=id&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to fetch coach tier for subscription", await response.text());
      return null;
    }

    const row = (await response.json().catch(() => null)) as Array<{ id: string }> | null;
    return row?.[0]?.id ?? null;
  } catch (error) {
    console.error("Unexpected error while fetching coach tier", error);
    return null;
  }
};

const updateCoachStatus = async (params: {
  userId: string;
  isActive: boolean;
  planName?: string | null;
}) => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) return;

  const coachTierId =
    params.isActive && params.planName ? await fetchCoachTierIdByName(params.planName) : null;
  const payload = params.isActive
    ? {
        is_coach: true,
        coach_plan_name: params.planName ?? null,
        coach_tier_id: coachTierId,
      }
    : {
        is_coach: false,
        coach_plan_name: null,
        coach_tier_id: null,
      };

  await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(params.userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceConfig.supabaseServiceRoleKey,
        Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }
  ).catch((error) => {
    console.error("Unable to update coach status from webhook", error);
  });
};

const isSubscriptionActive = (status: string | null, currentPeriodEnd: string | null): boolean => {
  if (status !== "active") return false;
  if (!currentPeriodEnd) return false;
  const periodEnd = Date.parse(currentPeriodEnd);
  if (Number.isNaN(periodEnd)) return false;
  return periodEnd >= Date.now();
};

const handleSubscriptionEvent = async (payload: StripeSubscriptionEventData) => {
  const customerId = typeof payload.customer === "string" ? payload.customer : undefined;
  const subscriptionId = typeof payload.id === "string" ? payload.id : undefined;
  const status = typeof payload.status === "string" ? payload.status : null;
  const periodEnd =
    typeof payload.current_period_end === "number" && Number.isFinite(payload.current_period_end)
      ? new Date(payload.current_period_end * 1000).toISOString()
      : null;
  const priceId =
    payload.items?.data?.[0]?.price && typeof payload.items.data[0].price?.id === "string"
      ? payload.items.data[0].price?.id ?? null
      : null;
  const planNameFromPrice =
    payload.items?.data?.[0]?.price?.metadata && typeof payload.items.data[0].price?.metadata?.plan_name === "string"
      ? payload.items.data[0].price.metadata.plan_name
      : null;
  const planNameFromSubscription =
    payload.metadata && typeof payload.metadata.plan_name === "string" ? payload.metadata.plan_name : null;
  const planName = planNameFromPrice ?? planNameFromSubscription;

  const metadataUserId =
    payload.metadata && typeof payload.metadata.user_id === "string" ? payload.metadata.user_id : null;

  const userId = metadataUserId ?? (customerId ? await findUserByCustomer(customerId) : null);

  if (!userId) {
    console.error("Unable to resolve user for subscription event", { subscriptionId, customerId });
    return;
  }

  await upsertSubscription({
    userId,
    customerId,
    subscriptionId,
    status,
    priceId,
    planName,
    currentPeriodEnd: periodEnd,
  });

  await updateCoachStatus({
    userId,
    isActive: isSubscriptionActive(status, periodEnd),
    planName,
  });
};

export async function POST(request: NextRequest) {
  const stripeConfig = getStripeConfig();
  const serviceConfig = getSupabaseServiceConfig();

  if (!stripeConfig || !serviceConfig || !stripeConfig.webhookSecret) {
    return withSecurityHeaders(NextResponse.json({ message: "Server configuration is missing." }, { status: 500 }));
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const validSignature = verifyStripeSignature(rawBody, signature, stripeConfig.webhookSecret);

  if (!validSignature) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid signature." }, { status: 400 }));
  }

  let event: StripeEvent;

  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch (error) {
    console.error("Unable to parse Stripe event", error);
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

  if (!event?.type) {
    return withSecurityHeaders(NextResponse.json({ message: "Unknown event." }, { status: 400 }));
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionEvent(event.data.object as StripeSubscriptionEventData);
    }
  } catch (error) {
    console.error("Stripe webhook handling error", error);
    return withSecurityHeaders(NextResponse.json({ message: "Webhook handling failed." }, { status: 500 }));
  }

  return withSecurityHeaders(NextResponse.json({ received: true }));
}

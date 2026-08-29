import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  getStripeConfig,
  StripeEvent,
  StripeSubscriptionEventData,
  verifyStripeSignature,
} from "../../../../lib/stripe";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

type StripeCheckoutSessionEventData = {
  id?: string;
  customer?: string;
  payment_intent?: string;
  subscription?: string;
  subscription_status?: string;
  status?: string;
  payment_status?: string;
  client_reference_id?: string;
  metadata?: Record<string, unknown>;
  amount_subtotal?: number;
  amount_total?: number;
  currency?: string;
  total_details?: { amount_tax?: number };
};

type StripeChargeEventData = {
  payment_intent?: string;
  amount_refunded?: number;
  disputed?: boolean;
  status?: string;
};

const serviceHeaders = (serviceConfig: NonNullable<ReturnType<typeof getSupabaseServiceConfig>>, contentType = "application/json") => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const isOrganizerCheckout = (payload: { metadata?: Record<string, unknown> }) =>
  payload.metadata?.purchase_type === "organizer_edition" && typeof payload.metadata?.payment_id === "string";

const updateOrganizerPayment = async (
  paymentId: string,
  updates: Record<string, unknown>,
  options?: { recalculate?: boolean; onlyStatuses?: string[] }
) => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${encodeURIComponent(paymentId)}${
      options?.onlyStatuses?.length ? `&status=in.(${options.onlyStatuses.join(",")})` : ""
    }&select=edition_id`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
      cache: "no-store",
    }
  );
  if (!response.ok) throw new Error(`Unable to update organizer payment: ${await response.text()}`);
  const rows = (await response.json()) as Array<{ edition_id?: string }>;
  const editionId = rows[0]?.edition_id;
  if (options?.recalculate && editionId) {
    const recalculate = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/recalculate_organizer_edition_entitlement`, {
      method: "POST",
      headers: serviceHeaders(serviceConfig),
      body: JSON.stringify({ p_edition_id: editionId }),
      cache: "no-store",
    });
    if (!recalculate.ok) throw new Error(`Unable to recalculate organizer entitlement: ${await recalculate.text()}`);
  }
};

const updateOrganizerPaymentByIntent = async (
  paymentIntentId: string,
  status: "paid" | "refunded" | "disputed",
  onlyStatuses: string[]
) => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?stripe_payment_intent_id=eq.${encodeURIComponent(
      paymentIntentId
    )}&select=id&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) throw new Error(`Unable to find organizer payment: ${await response.text()}`);
  const payment = ((await response.json()) as Array<{ id?: string }>)[0];
  if (payment?.id) {
    await updateOrganizerPayment(
      payment.id,
      { status, invalidated_at: status === "paid" ? null : new Date().toISOString() },
      { recalculate: true, onlyStatuses }
    );
  }
};

const handleOrganizerCheckout = async (
  payload: StripeCheckoutSessionEventData,
  eventType: "completed" | "async_succeeded" | "async_failed" | "expired"
) => {
  const paymentId = typeof payload.metadata?.payment_id === "string" ? payload.metadata.payment_id : null;
  if (!paymentId) return;
  const paid = payload.payment_status === "paid" || payload.payment_status === "no_payment_required";
  const status = eventType === "expired" ? "expired" : eventType === "async_failed" ? "failed" : paid || eventType === "async_succeeded" ? "paid" : "pending";
  await updateOrganizerPayment(
    paymentId,
    {
      status,
      stripe_checkout_session_id: payload.id,
      stripe_payment_intent_id: payload.payment_intent,
      stripe_customer_id: payload.customer,
      amount_subtotal: payload.amount_subtotal,
      amount_tax: payload.total_details?.amount_tax,
      amount_total: payload.amount_total,
      currency: payload.currency,
      paid_at: status === "paid" ? new Date().toISOString() : undefined,
      invalidated_at: status === "failed" || status === "expired" ? new Date().toISOString() : undefined,
    },
    {
      recalculate: status === "paid",
      onlyStatuses: status === "paid" ? ["pending", "failed", "expired", "paid"] : ["pending"],
    }
  );
};

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
    provider: "web",
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
};

const getCheckoutSubscriptionStatus = (payload: StripeCheckoutSessionEventData): string | null => {
  if (typeof payload.subscription_status === "string") {
    return payload.subscription_status;
  }

  if (payload.payment_status === "paid" || payload.payment_status === "no_payment_required") {
    return "active";
  }

  if (payload.status === "complete") {
    return "active";
  }

  return null;
};

const handleCheckoutSessionCompleted = async (payload: StripeCheckoutSessionEventData) => {
  const customerId = typeof payload.customer === "string" ? payload.customer : undefined;
  const subscriptionId = typeof payload.subscription === "string" ? payload.subscription : undefined;
  const metadataUserId =
    payload.metadata && typeof payload.metadata.user_id === "string" ? payload.metadata.user_id : null;
  const planName =
    payload.metadata && typeof payload.metadata.plan_name === "string" ? payload.metadata.plan_name : null;
  const clientReferenceId =
    typeof payload.client_reference_id === "string" ? payload.client_reference_id : null;
  const userId = metadataUserId ?? clientReferenceId ?? (customerId ? await findUserByCustomer(customerId) : null);

  if (!userId) {
    console.error("Unable to resolve user for checkout session", { subscriptionId, customerId });
    return;
  }

  const subscriptionStatus = getCheckoutSubscriptionStatus(payload);

  await upsertSubscription({
    userId,
    customerId,
    subscriptionId,
    status: subscriptionStatus,
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

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      const checkout = event.data.object as StripeCheckoutSessionEventData;
      if (isOrganizerCheckout(checkout)) {
        const checkoutEventType =
          event.type === "checkout.session.async_payment_succeeded"
            ? "async_succeeded"
            : event.type === "checkout.session.async_payment_failed"
              ? "async_failed"
              : event.type === "checkout.session.expired"
                ? "expired"
                : "completed";
        await handleOrganizerCheckout(checkout, checkoutEventType);
      } else if (event.type === "checkout.session.completed") {
        await handleCheckoutSessionCompleted(checkout);
      }
    }

    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge = event.data.object as StripeChargeEventData;
      if (typeof charge.payment_intent === "string") {
        await updateOrganizerPaymentByIntent(
          charge.payment_intent,
          event.type === "charge.refunded" ? "refunded" : "disputed",
          event.type === "charge.refunded" ? ["paid", "disputed"] : ["paid"]
        );
      }
    }

    if (event.type === "charge.dispute.closed") {
      const dispute = event.data.object as StripeChargeEventData;
      if (typeof dispute.payment_intent === "string") {
        await updateOrganizerPaymentByIntent(
          dispute.payment_intent,
          dispute.status === "won" ? "paid" : "disputed",
          dispute.status === "won" ? ["disputed"] : ["paid", "disputed"]
        );
      }
    }
  } catch (error) {
    console.error("Stripe webhook handling error", error);
    return withSecurityHeaders(NextResponse.json({ message: "Webhook handling failed." }, { status: 500 }));
  }

  return withSecurityHeaders(NextResponse.json({ received: true }));
}

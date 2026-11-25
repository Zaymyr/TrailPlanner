import { NextRequest, NextResponse } from "next/server";

import { sendFlyoverPaidEmail } from "../../../../lib/flyover-generation";
import { createFlyoverOrderRepository } from "../../../../lib/flyover-orders";
import { withSecurityHeaders } from "../../../../lib/http";
import {
  getStripeConfig,
  getStripeJson,
  StripeEvent,
  StripeSubscriptionEventData,
  verifyStripeSignature,
} from "../../../../lib/stripe";
import {
  chargeColumns,
  newerChargeFilter,
  type RunnerSaleCharge,
  stripeCharge,
  subscriptionChargeColumns,
} from "../../../../lib/runner-payments";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

type StripeCheckoutSessionEventData = {
  id?: string;
  customer?: string;
  payment_intent?: string;
  invoice?: string;
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
  charge?: string;
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

type StripeInvoiceEventData = {
  id?: string;
  amount_paid?: number;
  currency?: string;
  subscription?: string | { id?: string } | null;
  // Stripe API 2025-03+ moved the subscription under `parent.subscription_details`.
  parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
};

const idOf = (value: string | { id?: string } | null | undefined) =>
  typeof value === "string" ? value : typeof value?.id === "string" ? value.id : null;

const stripeEventAt = (event: StripeEvent) =>
  typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : new Date().toISOString();

const recordRunnerBillingEvent = async (
  event: StripeEvent,
  transactionId: string,
  /** `null` for subscription charges: they never take part in the course transaction state. */
  transactionStatus: "active" | "refunded" | "revoked" | null,
  charge: RunnerSaleCharge | null = null,
) => {
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");
  const eventAt = stripeEventAt(event);
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_billing_events?on_conflict=provider,provider_event_id`, {
    method: "POST",
    headers: { ...serviceHeaders(service), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      provider: "stripe",
      provider_event_id: event.id,
      event_type: event.type,
      transaction_id: transactionId,
      transaction_status: transactionStatus,
      event_at: eventAt,
      payload: event,
      processing_error: null,
      ...chargeColumns(charge),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to journal Stripe event: ${await response.text()}`);
  return eventAt;
};

const markRunnerBillingEventProcessed = async (eventId: string) => {
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_billing_events?provider=eq.stripe&provider_event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: serviceHeaders(service),
    body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: null }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to finalize Stripe event journal: ${await response.text()}`);
};

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

const revokeRunnerCourseByIntent = async (paymentIntentId: string, status: "refunded" | "revoked" = "refunded") => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return;
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/revoke_runner_payment_transaction`, {
    method: "POST", headers: serviceHeaders(serviceConfig),
    body: JSON.stringify({ p_provider: "stripe", p_transaction_id: paymentIntentId, p_status: status }), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to revoke runner course: ${await response.text()}`);
  if ((await response.json().catch(() => false)) !== true) throw new Error("Runner course revocation was rejected.");
};

const restoreRunnerCourseByIntent = async (paymentIntentId: string) => {
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(`${service.supabaseUrl}/rest/v1/rpc/restore_runner_payment_transaction`, {
    method: "POST", headers: serviceHeaders(service),
    body: JSON.stringify({ p_provider: "stripe", p_transaction_id: paymentIntentId }), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to restore runner course: ${await response.text()}`);
};

const resolveDisputePaymentIntent = async (payload: StripeChargeEventData, secretKey: string) => {
  if (typeof payload.payment_intent === "string") return payload.payment_intent;
  if (typeof payload.charge !== "string") return null;
  const charge = await getStripeJson<{ payment_intent?: string }>(`/v1/charges/${encodeURIComponent(payload.charge)}`, secretKey);
  return typeof charge.payment_intent === "string" ? charge.payment_intent : null;
};

/**
 * Organizer flyover video (/survol): paid → the cron route starts the video; expired or failed →
 * the order stays unpaid. Status-guarded, so a replayed event changes nothing.
 */
const handleFlyoverCheckout = async (
  payload: StripeCheckoutSessionEventData,
  eventType: "completed" | "async_succeeded" | "async_failed" | "expired"
) => {
  const orderId = typeof payload.metadata?.order_id === "string" ? payload.metadata.order_id : null;
  const serviceConfig = getSupabaseServiceConfig();
  if (!orderId || !serviceConfig) return;
  const orders = createFlyoverOrderRepository(serviceConfig);
  const paid = eventType === "async_succeeded" || (eventType === "completed" && (payload.payment_status === "paid" || payload.payment_status === "no_payment_required"));
  if (paid) {
    const order = await orders.update(orderId, {
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: payload.id,
      stripe_payment_intent_id: payload.payment_intent ?? null,
      error: null,
    }, "status=in.(pending_payment,expired)");
    const current = order ?? await orders.get(orderId);
    // The confirmation email never fails the webhook (Stripe would replay the payment).
    if (current && ["paid", "scripted", "rendering", "ready"].includes(current.status)) {
      await sendFlyoverPaidEmail(serviceConfig, current).catch((error) => console.error("Flyover paid email failed", error instanceof Error ? error.message : error));
    }
    return;
  }
  if (eventType === "expired" || eventType === "async_failed") {
    await orders.update(orderId, { status: "expired" }, "status=eq.pending_payment");
  }
};

/** A refunded or disputed flyover order stops its pipeline (a finished video stays as is). */
const refundFlyoverOrdersByIntent = async (paymentIntentId: string) => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return;
  const orders = createFlyoverOrderRepository(serviceConfig);
  for (const order of await orders.findByPaymentIntent(paymentIntentId)) {
    await orders.update(order.id, { status: "refunded", locked_until: null }, "status=in.(paid,scripted,rendering,ready,failed,cancelled)");
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
      stripe_invoice_id: typeof payload.invoice === "string" ? payload.invoice : undefined,
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

const handleRunnerCourseFulfillment = async (payload: StripeCheckoutSessionEventData, purchasedAt: string) => {
  const metadata = payload.metadata ?? {};
  const userId = typeof metadata.user_id === "string" ? metadata.user_id : payload.client_reference_id;
  const planId = typeof metadata.plan_id === "string" ? metadata.plan_id : null;
  const intentId = typeof metadata.intent_id === "string" ? metadata.intent_id : null;
  const productId = typeof metadata.product_id === "string" ? metadata.product_id : null;
  if (!userId || !planId || !intentId || !productId) throw new Error("Runner checkout metadata is incomplete.");
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) throw new Error("Supabase service configuration is missing.");
  const transactionId = typeof payload.payment_intent === "string" ? payload.payment_intent : payload.id;
  await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/claim_runner_plan_unlock`, {
    method: "POST",
    headers: { ...serviceHeaders(serviceConfig), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ p_user_id: userId, p_plan_id: planId, p_provider: "stripe", p_transaction_id: transactionId, p_product_id: productId, p_purchased_at: purchasedAt, p_intent_id: intentId }),
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Unable to fulfill runner course: ${await response.text()}`);
    if ((await response.json().catch(() => false)) !== true) throw new Error("Runner course claim was rejected.");
  });
};

const closeRunnerCourseIntent = async (payload: StripeCheckoutSessionEventData, status: "expired" | "cancelled", reason: string) => {
  const intentId = typeof payload.metadata?.intent_id === "string" ? payload.metadata.intent_id : null;
  if (!intentId) throw new Error("Runner checkout intent metadata is missing.");
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?id=eq.${encodeURIComponent(intentId)}&provider=eq.stripe&status=eq.pending`, {
    method: "PATCH", headers: serviceHeaders(service),
    body: JSON.stringify({ status, failure_reason: reason }), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to close runner checkout intent: ${await response.text()}`);
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

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: serviceConfig.supabaseServiceRoleKey,
      Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Unable to upsert subscription from webhook: ${await response.text()}`);
};

const upsertRunnerSubscriptionAccount = async (userId: string, subscriptionId: string, status: string | null, periodEnd: string | null) => {
  const service = getSupabaseServiceConfig();
  if (!service || !subscriptionId) return;
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_subscription_accounts?on_conflict=provider,provider_subscription_id`, { method: "POST", headers: { ...serviceHeaders(service), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: userId, provider: "stripe", provider_subscription_id: subscriptionId, status: status ?? "unknown", current_period_end: periodEnd }) });
  if (!response.ok) throw new Error(`Unable to upsert runner subscription account: ${await response.text()}`);
  await fillStripeSubscriptionChargeFromJournal(subscriptionId);
};

/** Writes a charged period as the latest charge of a Stripe subscription account (older never wins). */
const patchStripeSubscriptionCharge = async (subscriptionId: string, charge: RunnerSaleCharge, chargedAt: string) => {
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(
    `${service.supabaseUrl}/rest/v1/runner_subscription_accounts?provider=eq.stripe&provider_subscription_id=eq.${encodeURIComponent(subscriptionId)}&${newerChargeFilter(chargedAt)}`,
    { method: "PATCH", headers: serviceHeaders(service), body: JSON.stringify(subscriptionChargeColumns(charge, chargedAt)), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to record runner subscription charge: ${await response.text()}`);
};

/**
 * Subscription charge (`invoice.paid`, or the first Checkout): journaled with the subscription id as
 * transaction and no transaction status, then copied onto the account when it already exists.
 */
const recordStripeSubscriptionCharge = async (event: StripeEvent, subscriptionId: string, charge: RunnerSaleCharge) => {
  const chargedAt = await recordRunnerBillingEvent(event, subscriptionId, null, charge);
  await patchStripeSubscriptionCharge(subscriptionId, charge, chargedAt);
  await markRunnerBillingEventProcessed(event.id);
};

/** A charge delivered before `customer.subscription.created` is picked up from the journal. */
const fillStripeSubscriptionChargeFromJournal = async (subscriptionId: string) => {
  const service = getSupabaseServiceConfig();
  if (!service) return;
  const response = await fetch(
    `${service.supabaseUrl}/rest/v1/runner_billing_events?provider=eq.stripe&transaction_id=eq.${encodeURIComponent(subscriptionId)}&transaction_status=is.null&amount_minor=not.is.null&select=amount_minor,currency,event_at&order=event_at.desc&limit=1`,
    { headers: serviceHeaders(service, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to read runner subscription charges: ${await response.text()}`);
  const row = ((await response.json().catch(() => [])) as Array<{ amount_minor?: number; currency?: string; event_at?: string }>)[0];
  const charge = stripeCharge(row?.amount_minor, row?.currency);
  if (charge && row?.event_at) await patchStripeSubscriptionCharge(subscriptionId, charge, row.event_at);
};

const handleSubscriptionEvent = async (payload: StripeSubscriptionEventData) => {
  const customerId = typeof payload.customer === "string" ? payload.customer : undefined;
  const subscriptionId = typeof payload.id === "string" ? payload.id : undefined;
  const status = typeof payload.status === "string" ? payload.status : null;
  const periodEndSeconds = payload.current_period_end ?? payload.items?.data?.[0]?.current_period_end;
  const periodEnd =
    typeof periodEndSeconds === "number" && Number.isFinite(periodEndSeconds)
      ? new Date(periodEndSeconds * 1000).toISOString()
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
  if (subscriptionId) await upsertRunnerSubscriptionAccount(userId, subscriptionId, periodEnd ? status : "expired", periodEnd);
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
      if (checkout.metadata?.purchase_type === "flyover_video") {
        await handleFlyoverCheckout(
          checkout,
          event.type === "checkout.session.async_payment_succeeded"
            ? "async_succeeded"
            : event.type === "checkout.session.async_payment_failed"
              ? "async_failed"
              : event.type === "checkout.session.expired"
                ? "expired"
                : "completed"
        );
      } else if (isOrganizerCheckout(checkout)) {
        const checkoutEventType =
          event.type === "checkout.session.async_payment_succeeded"
            ? "async_succeeded"
            : event.type === "checkout.session.async_payment_failed"
              ? "async_failed"
              : event.type === "checkout.session.expired"
                ? "expired"
                : "completed";
        await handleOrganizerCheckout(checkout, checkoutEventType);
      } else if (checkout.metadata?.purchase_type === "runner_course") {
        if (
          (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
          && (checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required" || event.type === "checkout.session.async_payment_succeeded")
        ) {
          const transactionId = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.id;
          if (!transactionId) throw new Error("Runner checkout transaction is missing.");
          // The journaled charge (TTC, minor units) is copied onto the unlock by the claim RPC.
          const charge = stripeCharge(checkout.amount_total, checkout.currency, { allowZero: true });
          const purchasedAt = await recordRunnerBillingEvent(event, transactionId, "active", charge);
          await handleRunnerCourseFulfillment(checkout, purchasedAt);
          await markRunnerBillingEventProcessed(event.id);
        } else if (event.type === "checkout.session.async_payment_failed") {
          await closeRunnerCourseIntent(checkout, "cancelled", "stripe_async_payment_failed");
        } else if (event.type === "checkout.session.expired") {
          await closeRunnerCourseIntent(checkout, "expired", "stripe_checkout_expired");
        }
      } else if (event.type === "checkout.session.completed") {
          await handleCheckoutSessionCompleted(checkout);
          // First charge of an annual subscription Checkout (renewals come from `invoice.paid`).
          const subscriptionId = typeof checkout.subscription === "string" ? checkout.subscription : null;
          const charge = stripeCharge(checkout.amount_total, checkout.currency);
          if (subscriptionId && charge && (checkout.payment_status === "paid" || checkout.status === "complete")) {
            await recordStripeSubscriptionCharge(event, subscriptionId, charge);
          }
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as StripeInvoiceEventData;
      const subscriptionId = idOf(invoice.subscription) ?? idOf(invoice.parent?.subscription_details?.subscription);
      const charge = stripeCharge(invoice.amount_paid, invoice.currency);
      if (subscriptionId && charge) await recordStripeSubscriptionCharge(event, subscriptionId, charge);
    }

    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge = event.data.object as StripeChargeEventData;
      const paymentIntentId = event.type === "charge.refunded" ? charge.payment_intent ?? null : await resolveDisputePaymentIntent(charge, stripeConfig.secretKey);
      if (typeof paymentIntentId === "string") {
        await refundFlyoverOrdersByIntent(paymentIntentId);
        await updateOrganizerPaymentByIntent(
          paymentIntentId,
          event.type === "charge.refunded" ? "refunded" : "disputed",
          event.type === "charge.refunded" ? ["paid", "disputed"] : ["paid"]
        );
        if (event.type === "charge.refunded") {
          await recordRunnerBillingEvent(event, paymentIntentId, "refunded");
          await revokeRunnerCourseByIntent(paymentIntentId, "refunded");
          await markRunnerBillingEventProcessed(event.id);
        } else {
          await recordRunnerBillingEvent(event, paymentIntentId, "revoked");
          await revokeRunnerCourseByIntent(paymentIntentId, "revoked");
          await markRunnerBillingEventProcessed(event.id);
        }
      }
    }

    if (event.type === "charge.dispute.closed") {
      const dispute = event.data.object as StripeChargeEventData;
      const paymentIntentId = await resolveDisputePaymentIntent(dispute, stripeConfig.secretKey);
      if (paymentIntentId) {
        await updateOrganizerPaymentByIntent(
          paymentIntentId,
          dispute.status === "won" ? "paid" : "disputed",
          dispute.status === "won" ? ["disputed"] : ["paid", "disputed"]
        );
        if (dispute.status === "won") {
          await recordRunnerBillingEvent(event, paymentIntentId, "active");
          await restoreRunnerCourseByIntent(paymentIntentId);
        } else {
          await recordRunnerBillingEvent(event, paymentIntentId, "revoked");
          await revokeRunnerCourseByIntent(paymentIntentId, "revoked");
        }
        await markRunnerBillingEventProcessed(event.id);
      }
    }
  } catch (error) {
    console.error("Stripe webhook handling error", error);
    return withSecurityHeaders(NextResponse.json({ message: "Webhook handling failed." }, { status: 500 }));
  }

  return withSecurityHeaders(NextResponse.json({ received: true }));
}

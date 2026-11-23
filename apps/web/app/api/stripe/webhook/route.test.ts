import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const paymentId = "11111111-1111-1111-1111-111111111111";
const editionId = "22222222-2222-2222-2222-222222222222";

const webhookRequest = (type: string, object: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "valid" },
    body: JSON.stringify({ id: `evt_${type}`, type, data: { object } }),
  });

describe("organizer Stripe webhooks", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("activates only a confirmed paid checkout and recalculates the edition", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json({ tier: "racebook" }));

    const response = await POST(webhookRequest("checkout.session.completed", {
      id: "cs_paid",
      payment_status: "paid",
      payment_intent: "pi_paid",
      invoice: "in_paid",
      amount_subtotal: 9_900,
      amount_total: 11_880,
      total_details: { amount_tax: 1_980 },
      currency: "eur",
      metadata: { purchase_type: "organizer_edition", payment_id: paymentId },
    }));

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      status: "paid",
      amount_subtotal: 9_900,
      amount_tax: 1_980,
      amount_total: 11_880,
      stripe_invoice_id: "in_paid",
    });
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain("/rpc/recalculate_organizer_edition_entitlement");
  });

  it("keeps an unpaid deferred checkout pending", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ edition_id: editionId }]));
    const response = await POST(webhookRequest("checkout.session.completed", {
      id: "cs_pending",
      payment_status: "unpaid",
      metadata: { purchase_type: "organizer_edition", payment_id: paymentId },
    }));

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({ status: "pending" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("marks a paid flyover video order without touching organizer payments", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([]));
    const response = await POST(webhookRequest("checkout.session.completed", {
      id: "cs_flyover",
      payment_status: "paid",
      payment_intent: "pi_flyover",
      metadata: { purchase_type: "flyover_video", order_id: paymentId },
    }));
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain(`/flyover_video_orders?id=eq.${paymentId}&status=in.(pending_payment,expired)`);
    expect(JSON.parse(String(init?.body))).toMatchObject({ status: "paid", stripe_payment_intent_id: "pi_flyover" });
    expect(vi.mocked(fetch).mock.calls.some(([target]) => String(target).includes("organizer_edition_payments"))).toBe(false);
  });

  it.each(["charge.refunded", "charge.dispute.created"])("invalidates a payment on %s", async (eventType) => {
    vi.mocked(fetch)
      // No flyover video order paid with this intent.
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]))
      .mockResolvedValueOnce(Response.json([{ edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json({ tier: "visibility" }))
      .mockResolvedValue(Response.json(true));

    const response = await POST(webhookRequest(eventType, { payment_intent: "pi_invalidated", amount_refunded: 1 }));

    expect(response.status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("/flyover_video_orders?stripe_payment_intent_id=eq.pi_invalidated");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toMatchObject({
      status: eventType === "charge.refunded" ? "refunded" : "disputed",
    });
    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain("/rpc/recalculate_organizer_edition_entitlement");
    if (eventType === "charge.dispute.created") {
      expect(JSON.parse(String(vi.mocked(fetch).mock.calls[4]?.[1]?.body))).toMatchObject({ transaction_status: "revoked" });
      expect(String(vi.mocked(fetch).mock.calls[5]?.[0])).toContain("/rpc/revoke_runner_payment_transaction");
    }
  });

  it("fulfills a paid runner checkout delivered through async success", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const response = await POST(webhookRequest("checkout.session.async_payment_succeeded", {
      id: "cs_runner", payment_status: "paid", payment_intent: "pi_runner",
      metadata: { purchase_type: "runner_course", user_id: "33333333-3333-3333-3333-333333333333", plan_id: "44444444-4444-4444-4444-444444444444", intent_id: "55555555-5555-5555-5555-555555555555", product_id: "price_course" },
    }));

    expect(response.status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("runner_billing_events");
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain("/rpc/claim_runner_plan_unlock");
  });

  it("journals the runner course charge so the claim records the amount", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await POST(webhookRequest("checkout.session.completed", {
      id: "cs_runner", payment_status: "paid", payment_intent: "pi_runner", amount_subtotal: 833, amount_total: 999, total_details: { amount_tax: 166 }, currency: "eur",
      metadata: { purchase_type: "runner_course", user_id: "33333333-3333-3333-3333-333333333333", plan_id: "44444444-4444-4444-4444-444444444444", intent_id: "55555555-5555-5555-5555-555555555555", product_id: "price_course" },
    }));

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      transaction_id: "pi_runner", transaction_status: "active", amount_minor: 999, currency: "EUR", store_takehome_rate: null, store_tax_rate: null,
    });
  });

  it("records a paid subscription invoice as the latest charge of the runner account", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await POST(new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid" },
      body: JSON.stringify({ id: "evt_invoice", created: 1819865414, type: "invoice.paid", data: { object: {
        id: "in_renewal", amount_paid: 2999, currency: "eur", parent: { subscription_details: { subscription: "sub_runner" } },
      } } }),
    }));

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({ event_type: "invoice.paid", transaction_id: "sub_runner", transaction_status: null, amount_minor: 2999, currency: "EUR" });
    const [url, init] = vi.mocked(fetch).mock.calls[1] ?? [];
    expect(String(url)).toContain("/runner_subscription_accounts?provider=eq.stripe&provider_subscription_id=eq.sub_runner&or=(last_charged_at.is.null,last_charged_at.lte.");
    expect(JSON.parse(String(init?.body))).toEqual({ last_amount_minor: 2999, last_currency: "EUR", last_charged_at: new Date(1819865414000).toISOString(), last_store_takehome_rate: null, last_store_tax_rate: null });
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("provider_event_id=eq.evt_invoice");
  });

  it("ignores a zero invoice (trial) and keeps the account untouched", async () => {
    const response = await POST(webhookRequest("invoice.paid", { id: "in_trial", amount_paid: 0, currency: "eur", subscription: "sub_trial" }));
    expect(response.status).toBe(200);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("gives a new subscription account the charge journaled before it existed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 201 })) // subscriptions upsert
      .mockResolvedValueOnce(new Response("{}", { status: 201 })) // runner account upsert
      .mockResolvedValueOnce(Response.json([{ amount_minor: 2999, currency: "EUR", event_at: "2026-11-23T10:00:00+00:00" }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await POST(webhookRequest("customer.subscription.created", {
      id: "sub_runner", customer: "cus_1", status: "active", current_period_end: 1851401414, metadata: { user_id: "33333333-3333-3333-3333-333333333333" },
    }));

    expect(response.status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("/runner_billing_events?provider=eq.stripe&transaction_id=eq.sub_runner&transaction_status=is.null&amount_minor=not.is.null");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[3]?.[1]?.body))).toMatchObject({ last_amount_minor: 2999, last_charged_at: "2026-11-23T10:00:00+00:00" });
  });

  it("retries the webhook when the atomic runner claim is rejected", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json(false));
    const response = await POST(webhookRequest("checkout.session.completed", {
      id: "cs_runner", payment_status: "paid", payment_intent: "pi_collision",
      metadata: { purchase_type: "runner_course", user_id: "33333333-3333-3333-3333-333333333333", plan_id: "44444444-4444-4444-4444-444444444444", intent_id: "55555555-5555-5555-5555-555555555555", product_id: "price_course" },
    }));
    expect(response.status).toBe(500);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("restores a disputed transaction only when Stripe closes the dispute as won", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]))
      .mockResolvedValueOnce(Response.json([{ edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json({ tier: "racebook" }))
      .mockResolvedValue(Response.json(true));

    const response = await POST(webhookRequest("charge.dispute.closed", {
      payment_intent: "pi_won",
      status: "won",
    }));

    expect(response.status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain("status=in.(disputed)");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toMatchObject({
      status: "paid",
      invalidated_at: null,
    });
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("/rpc/recalculate_organizer_edition_entitlement");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[3]?.[1]?.body))).toMatchObject({ transaction_status: "active" });
    expect(String(vi.mocked(fetch).mock.calls[4]?.[0])).toContain("/rpc/restore_runner_payment_transaction");
  });

  it("keeps runner access revoked when a dispute closes lost", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]))
      .mockResolvedValueOnce(Response.json([{ edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json({ tier: "visibility" }))
      .mockResolvedValue(Response.json(true));
    const response = await POST(webhookRequest("charge.dispute.closed", { payment_intent: "pi_lost", status: "lost" }));
    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[3]?.[1]?.body))).toMatchObject({ transaction_status: "revoked" });
    expect(String(vi.mocked(fetch).mock.calls[4]?.[0])).toContain("/rpc/revoke_runner_payment_transaction");
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/stripe", () => ({
  getStripeConfig: () => ({ webhookSecret: "whsec_test" }),
  getStripeJson: vi.fn(),
  verifyStripeSignature: () => true,
}));
vi.mock("../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" }),
}));

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

  it.each(["charge.refunded", "charge.dispute.created"])("invalidates a payment on %s", async (eventType) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]))
      .mockResolvedValueOnce(Response.json([{ edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json({ tier: "visibility" }));

    const response = await POST(webhookRequest(eventType, { payment_intent: "pi_invalidated", amount_refunded: 1 }));

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toMatchObject({
      status: eventType === "charge.refunded" ? "refunded" : "disputed",
    });
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("/rpc/recalculate_organizer_edition_entitlement");
  });

  it("restores a disputed transaction only when Stripe closes the dispute as won", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]))
      .mockResolvedValueOnce(Response.json([{ edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json({ tier: "racebook" }));

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
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/stripe", () => ({
  getStripeConfig: () => ({ webhookSecret: "whsec_test" }),
  verifyStripeSignature: () => true,
}));
vi.mock("../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" }),
}));

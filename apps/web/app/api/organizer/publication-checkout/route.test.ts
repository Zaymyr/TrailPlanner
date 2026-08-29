import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";
const editionId = "22222222-2222-2222-2222-222222222222";
const paymentId = "33333333-3333-3333-3333-333333333333";

const mocks = vi.hoisted(() => ({
  currentTier: "visibility" as "visibility" | "racebook" | "pro",
  getStripeJson: vi.fn(),
  postStripeForm: vi.fn(),
}));

const request = (targetTier: "racebook" | "pro") =>
  new NextRequest("http://localhost/api/organizer/publication-checkout", {
    method: "POST",
    headers: { authorization: "Bearer organizer-token", "content-type": "application/json" },
    body: JSON.stringify({ eventId, editionId, targetTier }),
  });

describe("POST /api/organizer/publication-checkout", () => {
  beforeEach(() => {
    mocks.currentTier = "visibility";
    mocks.getStripeJson.mockReset();
    mocks.postStripeForm.mockReset().mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.test/session" });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ id: editionId }]))
      .mockResolvedValueOnce(Response.json([{ id: paymentId, stripe_checkout_url: null }], { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })));
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["visibility", "racebook", "price_racebook", 9_900, "racebook"],
    ["visibility", "pro", "price_pro", 29_900, "pro_direct"],
    ["racebook", "pro", "price_upgrade", 20_000, "pro_upgrade"],
  ] as const)("charges the server-selected price for %s to %s", async (fromTier, targetTier, priceId, amount, purchaseKind) => {
    mocks.currentTier = fromTier;
    mocks.getStripeJson.mockResolvedValue({
      id: priceId,
      active: true,
      currency: "eur",
      unit_amount: amount,
      recurring: null,
      tax_behavior: "exclusive",
    });

    const response = await POST(request(targetTier));

    expect(response.status).toBe(200);
    expect(mocks.postStripeForm).toHaveBeenCalledWith(
      "/v1/checkout/sessions",
      expect.objectContaining({
        "line_items[0][price]": priceId,
        "automatic_tax[enabled]": "true",
        "invoice_creation[enabled]": "true",
        "metadata[edition_id]": editionId,
        "metadata[from_tier]": fromTier,
        "metadata[to_tier]": targetTier,
      }),
      "sk_test",
      expect.objectContaining({ idempotencyKey: expect.stringContaining("organizer-edition-") })
    );
    const insertCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(insertCall?.[1]?.body))).toMatchObject({
      purchase_kind: purchaseKind,
      amount_subtotal: amount,
      from_tier: fromTier,
      to_tier: targetTier,
    });
  });

  it("reuses an existing pending Checkout instead of creating a duplicate", async () => {
    mocks.getStripeJson.mockResolvedValue({
      id: "price_racebook",
      active: true,
      currency: "eur",
      unit_amount: 9_900,
      recurring: null,
      tax_behavior: "exclusive",
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ id: editionId }]))
      .mockResolvedValueOnce(Response.json({ message: "duplicate" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json([{
        id: paymentId,
        stripe_checkout_url: "https://checkout.stripe.test/already-open",
      }])));

    const response = await POST(request("racebook"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://checkout.stripe.test/already-open",
      paymentId,
    });
    expect(mocks.postStripeForm).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../lib/http", () => ({
  checkRateLimitAsync: () => Promise.resolve({ allowed: true }),
  withSecurityHeaders: (response: Response) => response,
}));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: () => Promise.resolve(true),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001", email: "orga@example.test", is_anonymous: false },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key", "Content-Type": "application/json" }),
}));
vi.mock("../../../../lib/organizer-publication", () => ({
  validateOrganizerEditionPublication: () => Promise.resolve({ ok: true }),
}));
vi.mock("../../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlement: () => Promise.resolve({ tier: mocks.currentTier, status: "active" }),
}));
vi.mock("../../../../lib/stripe", () => ({
  getStripeConfig: () => ({
    secretKey: "sk_test",
    organizerRacebookPriceId: "price_racebook",
    organizerProPriceId: "price_pro",
    organizerProUpgradePriceId: "price_upgrade",
  }),
  getStripeJson: mocks.getStripeJson,
  postStripeForm: mocks.postStripeForm,
}));
vi.mock("../../../../lib/supabase", () => ({ isAnonymousUser: () => false }));

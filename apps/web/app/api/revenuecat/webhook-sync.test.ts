import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

import { syncRevenueCatWebhookPayload } from "../../../lib/revenuecat";

describe("syncRevenueCatWebhookPayload", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("persists an active Google subscription directly from the webhook payload", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));

    const result = await syncRevenueCatWebhookPayload({
      api_version: "1.0",
      event: {
        app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e",
        original_app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e",
        store: "PLAY_STORE",
        type: "INITIAL_PURCHASE",
        period_type: "NORMAL",
        product_id: "a_abo_annuel",
        entitlement_ids: ["Pace YourSelf Premium"],
        expiration_at_ms: 1819865414000,
      },
    });

    expect(result.userIds).toEqual(["0c88781b-8e90-4d54-8198-ae0d03cdc64e"]);
    expect(result.results).toEqual([
      expect.objectContaining({
        provider: "google",
        status: "active",
        synced: true,
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/rest/v1/subscriptions?on_conflict=user_id");

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e",
      provider: "google",
      status: "active",
      price_id: "a_abo_annuel",
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });
  });
});

vi.mock("../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }),
}));

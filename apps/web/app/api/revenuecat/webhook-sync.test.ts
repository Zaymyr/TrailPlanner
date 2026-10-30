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
    vi.unstubAllEnvs();
  });

  it("persists an active Google subscription directly from the webhook payload", async () => {
    vi.stubEnv("REVENUECAT_ANNUAL_PRODUCT_ID", "a_abo_annuel");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));

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

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/rest/v1/runner_subscription_accounts?on_conflict=provider,provider_subscription_id");

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e",
      provider: "google",
      status: "active",
      provider_subscription_id: "revenuecat:0c88781b-8e90-4d54-8198-ae0d03cdc64e",
    });
  });

  it("never turns an unrelated non-renewing purchase into global Premium", async () => {
    const result = await syncRevenueCatWebhookPayload({ event: {
      id: "evt_one_off", type: "NON_RENEWING_PURCHASE", store: "APP_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "unrelated_one_off",
      transaction_id: "txn_one_off", purchased_at_ms: 1819865414000,
    } });
    expect(result.results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("atomically binds a non-renewing purchase only to an intent that predates it", async () => {
    vi.stubEnv("REVENUECAT_COURSE_PRODUCT_ID", "course_unlock");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json([{ id: "11111111-1111-1111-1111-111111111111", plan_id: "22222222-2222-2222-2222-222222222222" }]))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await syncRevenueCatWebhookPayload({ event: {
      id: "evt_course", type: "NON_RENEWING_PURCHASE", store: "PLAY_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "course_unlock",
      transaction_id: "txn_course", purchased_at_ms: 1819865414000, event_timestamp_ms: 1819865415000,
    } });

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("created_at=lte.");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("expires_at=gte.");
    const claim = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(claim).toMatchObject({ p_intent_id: "11111111-1111-1111-1111-111111111111", p_transaction_id: "txn_course", p_purchased_at: new Date(1819865414000).toISOString() });
  });

  it("journals an official CANCELLATION refund before revoking the transaction", async () => {
    vi.stubEnv("REVENUECAT_COURSE_PRODUCT_ID", "course_unlock");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await syncRevenueCatWebhookPayload({ event: {
      id: "evt_refund", type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", store: "APP_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "course_unlock",
      transaction_id: "txn_refunded", event_timestamp_ms: 1819865415000,
    } });

    const journal = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(journal).toMatchObject({ transaction_status: "refunded", transaction_id: "txn_refunded" });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/rpc/revoke_runner_payment_transaction");
  });
});

vi.mock("../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }),
}));

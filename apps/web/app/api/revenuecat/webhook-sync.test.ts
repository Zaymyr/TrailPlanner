import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

import { syncRevenueCatSubscriptionForUser, syncRevenueCatWebhookPayload } from "../../../lib/revenuecat";

describe("syncRevenueCatWebhookPayload", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not expire a subscription when RevenueCat is unavailable", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "server-key");
    fetchMock.mockResolvedValueOnce(Response.json({ message: "unavailable" }, { status: 503 }));

    await expect(syncRevenueCatSubscriptionForUser("0c88781b-8e90-4d54-8198-ae0d03cdc64e"))
      .resolves.toEqual({
        currentPeriodEnd: null,
        provider: null,
        reason: "provider_unavailable",
        status: null,
        synced: false,
      });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.revenuecat.com/v1/subscribers/");
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

  it("records support purchases without creating Premium or plan rights", async () => {
    vi.stubEnv("REVENUECAT_SUPPORT_PRODUCT_ID", "runner_app_support");
    fetchMock.mockResolvedValueOnce(Response.json(true));

    const result = await syncRevenueCatWebhookPayload({ event: {
      id: "evt_support", type: "NON_RENEWING_PURCHASE", store: "APP_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "runner_app_support",
      transaction_id: "txn_support", purchased_at_ms: 1819865414000, event_timestamp_ms: 1819865415000,
    } });

    expect(result.results).toEqual([]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/rpc/record_runner_support_event");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("runner_plan_unlock");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      p_product_id: "runner_app_support",
      p_status: "active",
      p_transaction_id: "txn_support",
    });
  });

  it("records a support refund against only the support ledger", async () => {
    vi.stubEnv("REVENUECAT_SUPPORT_PRODUCT_ID", "runner_app_support");
    fetchMock.mockResolvedValueOnce(Response.json(true));

    await syncRevenueCatWebhookPayload({ event: {
      id: "evt_support_refund", type: "CANCELLATION", store: "PLAY_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "runner_app_support",
      transaction_id: "txn_support", purchased_at_ms: 1819865414000, event_timestamp_ms: 1819866415000,
    } });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ p_provider: "google", p_status: "refunded" });
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("revoke_runner_payment_transaction");
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

  it("journals the course charge before the claim, which copies it onto the unlock", async () => {
    vi.stubEnv("REVENUECAT_COURSE_PRODUCT_ID", "course_unlock");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json([{ id: "11111111-1111-1111-1111-111111111111", plan_id: "22222222-2222-2222-2222-222222222222" }]))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await syncRevenueCatWebhookPayload({ api_version: "1.0", event: {
      id: "evt_course_priced", type: "NON_RENEWING_PURCHASE", store: "APP_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "course_unlock",
      transaction_id: "txn_course_priced", purchased_at_ms: 1819865414000, event_timestamp_ms: 1819865415000,
      price: 11.135, price_in_purchased_currency: 9.99, currency: "EUR", takehome_percentage: 0.74, tax_percentage: 0.1667,
    } });

    const journal = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(journal).toMatchObject({ transaction_status: "active", amount_minor: 999, currency: "EUR", store_takehome_rate: 0.74, store_tax_rate: 0.1667 });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/rpc/claim_runner_plan_unlock");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fills an unlock already claimed by the app sync with the webhook charge", async () => {
    vi.stubEnv("REVENUECAT_COURSE_PRODUCT_ID", "course_unlock");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await syncRevenueCatWebhookPayload({ event: {
      id: "evt_course_late", type: "NON_RENEWING_PURCHASE", store: "PLAY_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "course_unlock",
      transaction_id: "GPA.1234", purchased_at_ms: 1819865414000,
      price_in_purchased_currency: 9.99, currency: "EUR", takehome_percentage: 0.85, tax_percentage: 0.1662,
    } });

    const [url, init] = fetchMock.mock.calls[2] ?? [];
    expect(String(url)).toContain("/runner_plan_unlocks?provider=eq.google&provider_transaction_id=eq.GPA.1234&amount_minor=is.null");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ amount_minor: 999, currency: "EUR", store_takehome_rate: 0.85, store_tax_rate: 0.1662 });
  });

  it("passes the support charge to the ledger RPC, and none on a refund", async () => {
    vi.stubEnv("REVENUECAT_SUPPORT_PRODUCT_ID", "runner_app_support");
    fetchMock.mockResolvedValueOnce(Response.json(true)).mockResolvedValueOnce(Response.json(true));
    const event = {
      id: "evt_support_priced", type: "NON_RENEWING_PURCHASE", store: "PLAY_STORE",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "runner_app_support",
      transaction_id: "GPA.support", purchased_at_ms: 1819865414000, event_timestamp_ms: 1819865415000,
      price_in_purchased_currency: 4.99, currency: "EUR", takehome_percentage: 0.85, tax_percentage: 0.1662,
    };
    await syncRevenueCatWebhookPayload({ event });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ p_amount_minor: 499, p_currency: "EUR", p_store_takehome_rate: 0.85, p_store_tax_rate: 0.1662 });

    await syncRevenueCatWebhookPayload({ event: { ...event, id: "evt_support_refund_priced", type: "CANCELLATION", price_in_purchased_currency: -4.99 } });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ p_status: "refunded", p_amount_minor: null, p_currency: null });
  });

  it("journals a subscription renewal and records it as the latest charged period", async () => {
    vi.stubEnv("REVENUECAT_ANNUAL_PRODUCT_ID", "a_abo_annuel");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 201 })) // journal
      .mockResolvedValueOnce(new Response("{}", { status: 201 })) // account upsert
      .mockResolvedValueOnce(Response.json([])) // existing subscription snapshot
      .mockResolvedValueOnce(new Response("{}", { status: 201 })) // subscriptions upsert
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // account charge
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // journal processed

    const result = await syncRevenueCatWebhookPayload({ api_version: "1.0", event: {
      id: "evt_renewal", type: "RENEWAL", store: "PLAY_STORE", period_type: "NORMAL",
      app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e", product_id: "a_abo_annuel",
      entitlement_ids: ["Pace YourSelf Premium"], expiration_at_ms: 4102444800000,
      transaction_id: "GPA.renewal..1", purchased_at_ms: 1819865414000, event_timestamp_ms: 1819865415000,
      price_in_purchased_currency: 29.99, currency: "EUR", takehome_percentage: 0.85, tax_percentage: 0.1662,
    } });

    expect(result.results).toEqual([expect.objectContaining({ synced: true })]);
    const journal = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/runner_billing_events");
    expect(journal).toMatchObject({ event_type: "RENEWAL", transaction_status: null, transaction_id: "GPA.renewal..1", amount_minor: 2999 });
    const [chargeUrl, chargeInit] = fetchMock.mock.calls[4] ?? [];
    expect(String(chargeUrl)).toContain("/runner_subscription_accounts?provider=eq.google&provider_subscription_id=eq.revenuecat%3A0c88781b-8e90-4d54-8198-ae0d03cdc64e&or=(last_charged_at.is.null,last_charged_at.lte.");
    expect(JSON.parse(String(chargeInit?.body))).toEqual({
      last_amount_minor: 2999,
      last_currency: "EUR",
      last_charged_at: new Date(1819865414000).toISOString(),
      last_store_takehome_rate: 0.85,
      last_store_tax_rate: 0.1662,
    });
    expect(String(fetchMock.mock.calls[5]?.[0])).toContain("/runner_billing_events?provider=eq.google&provider_event_id=eq.evt_renewal");
  });

  it("fills an untracked subscription from the subscriber API price only when RevenueCat returns one", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "server-key");
    vi.stubEnv("REVENUECAT_ANNUAL_PRODUCT_ID", "a_abo_annuel");
    const subscriber = (price?: unknown) => Response.json({ subscriber: { entitlements: {}, subscriptions: { a_abo_annuel: {
      expires_date: "2100-01-01T00:00:00Z", purchase_date: "2026-10-01T10:00:00Z", period_type: "normal", store: "app_store", ...(price === undefined ? {} : { price }),
    } } } });
    fetchMock
      .mockResolvedValueOnce(subscriber({ amount: 29.99, currency: "EUR" }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(syncRevenueCatSubscriptionForUser("0c88781b-8e90-4d54-8198-ae0d03cdc64e")).resolves.toMatchObject({ synced: true, provider: "apple" });
    const [url, init] = fetchMock.mock.calls[4] ?? [];
    expect(String(url)).toContain("provider_subscription_id=eq.revenuecat%3A0c88781b-8e90-4d54-8198-ae0d03cdc64e&last_amount_minor=is.null");
    expect(JSON.parse(String(init?.body))).toMatchObject({ last_amount_minor: 2999, last_currency: "EUR", last_charged_at: "2026-10-01T10:00:00.000Z", last_store_takehome_rate: null });

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(subscriber())
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    await syncRevenueCatSubscriptionForUser("0c88781b-8e90-4d54-8198-ae0d03cdc64e");
    expect(fetchMock).toHaveBeenCalledTimes(4);
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

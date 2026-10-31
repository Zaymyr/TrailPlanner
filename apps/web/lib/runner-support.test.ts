import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRunnerSupportIntent,
  findVerifiedSupportPurchase,
  getRunnerSupportProductId,
  RunnerSupportIntentConflictError,
} from "./runner-support";

describe("runner support verification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires the configured product, provider store, and exact transaction", () => {
    const subscriber = {
      non_subscriptions: {
        runner_app_support: [
          { transaction_identifier: "wrong-store", purchase_date: "2026-10-30T08:00:00.000Z", store: "play_store" },
          { transaction_identifier: "expected", purchase_date: "2026-10-30T09:00:00.000Z", store: "app_store" },
        ],
        unrelated_product: [
          { transaction_identifier: "unrelated", purchase_date: "2026-10-30T10:00:00.000Z", store: "app_store" },
        ],
      },
    };

    expect(findVerifiedSupportPurchase(subscriber, {
      productId: "runner_app_support",
      provider: "apple",
      transactionId: "expected",
    })).toEqual({
      productId: "runner_app_support",
      provider: "apple",
      purchasedAt: "2026-10-30T09:00:00.000Z",
      transactionId: "expected",
    });
    expect(findVerifiedSupportPurchase(subscriber, {
      productId: "runner_app_support",
      provider: "google",
      transactionId: "expected",
    })).toBeNull();
    expect(findVerifiedSupportPurchase(subscriber, {
      productId: "unrelated_product",
      provider: "apple",
      transactionId: "expected",
    })).toBeNull();
  });

  it("uses a platform override before the shared support product", () => {
    vi.stubEnv("REVENUECAT_SUPPORT_PRODUCT_ID", "shared_support");
    vi.stubEnv("REVENUECAT_IOS_SUPPORT_PRODUCT_ID", "ios_support");
    expect(getRunnerSupportProductId("apple")).toBe("ios_support");
    expect(getRunnerSupportProductId("google")).toBe("shared_support");
  });

  it("rejects a second provider while an account intent is pending", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([{
      id: "11111111-1111-1111-1111-111111111111",
      provider: "google",
      product_id: "runner_app_support",
      status: "pending",
      transaction_id: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRunnerSupportIntent({
      userId: "22222222-2222-2222-2222-222222222222",
      provider: "apple",
      productId: "runner_app_support",
    })).rejects.toBeInstanceOf(RunnerSupportIntentConflictError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a live same-provider intent on another device", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([{
      id: "11111111-1111-1111-1111-111111111111",
      provider: "apple",
      product_id: "runner_app_support",
      status: "pending",
      transaction_id: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRunnerSupportIntent({
      userId: "22222222-2222-2222-2222-222222222222",
      provider: "apple",
      productId: "runner_app_support",
    })).rejects.toBeInstanceOf(RunnerSupportIntentConflictError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

vi.mock("./supabase", () => ({
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }),
}));

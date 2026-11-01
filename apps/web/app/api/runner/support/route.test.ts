import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  adminMode: "real" as "real" | "free" | "premium",
  purchase: null as null | { status: "active" | "refunded" },
  verified: null as null | {
    productId: string;
    provider: "apple";
    purchasedAt: string;
    transactionId: string;
  },
  claim: true,
  intentConflict: false,
  launch: { launchedAt: "2026-10-31T09:00:00.000Z", endsAt: "2026-11-07T09:00:00.000Z", eligible: true, earlySupporter: true },
}));
const SupportIntentConflict = vi.hoisted(() => class RunnerSupportIntentConflictError extends Error {});
const mocks = vi.hoisted(() => ({ cancelIntent: vi.fn(), createIntent: vi.fn(), claim: vi.fn() }));

import { GET, POST } from "./route";

const getRequest = () => new Request("https://example.test/api/runner/support?provider=apple", {
  headers: { Authorization: "Bearer token" },
});
const postRequest = (body: unknown) => new Request("https://example.test/api/runner/support", {
  method: "POST",
  headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("runner support route", () => {
  beforeEach(() => {
    state.adminMode = "real";
    state.purchase = null;
    state.verified = null;
    state.claim = true;
    state.intentConflict = false;
    state.launch = { launchedAt: "2026-10-31T09:00:00.000Z", endsAt: "2026-11-07T09:00:00.000Z", eligible: true, earlySupporter: true };
  });

  afterEach(() => vi.clearAllMocks());

  it("reports one-account status and never offers a second purchase", async () => {
    state.purchase = { status: "active" };
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ purchased: true, canPurchase: false });
  });

  it.each(["free", "premium"] as const)("blocks authorization in admin %s simulation", async (mode) => {
    state.adminMode = mode;
    const response = await POST(postRequest({ action: "authorize", provider: "apple" }));
    expect(response.status).toBe(409);
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["before launch", { launchedAt: null, endsAt: null, eligible: false, earlySupporter: true }],
    ["for a new account outside the cohort", { launchedAt: "2026-10-31T09:00:00.000Z", endsAt: "2026-11-07T09:00:00.000Z", eligible: false, earlySupporter: false }],
    ["after the launch window", { launchedAt: "2026-10-20T09:00:00.000Z", endsAt: "2026-10-27T09:00:00.000Z", eligible: false, earlySupporter: true }],
  ] as const)("blocks direct support authorization %s", async (_label, launch) => {
    state.launch = { ...launch };
    const statusResponse = await GET(getRequest());
    expect(await statusResponse.json()).toMatchObject({ canPurchase: false });
    const authorization = await POST(postRequest({ action: "authorize", provider: "apple" }));
    expect(authorization.status).toBe(409);
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("does not claim a client transaction that RevenueCat cannot verify", async () => {
    const response = await POST(postRequest({
      action: "sync",
      provider: "apple",
      intentId: "11111111-1111-1111-1111-111111111111",
      transactionId: "forged-transaction",
    }));
    expect(response.status).toBe(404);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("rejects a concurrent authorization for another provider", async () => {
    state.intentConflict = true;
    const response = await POST(postRequest({ action: "authorize", provider: "apple" }));
    expect(response.status).toBe(409);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("claims only the server-verified transaction with its durable intent", async () => {
    state.verified = {
      productId: "runner_app_support",
      provider: "apple",
      purchasedAt: "2026-10-30T09:00:00.000Z",
      transactionId: "verified-transaction",
    };
    const intentId = "11111111-1111-1111-1111-111111111111";
    const response = await POST(postRequest({
      action: "sync",
      provider: "apple",
      intentId,
      transactionId: "verified-transaction",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ purchased: true, verified: true });
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({
      intentId,
      userId: "44444444-4444-4444-4444-444444444444",
      transactionId: "verified-transaction",
    }));
  });

  it("grants no rights when the transaction conflicts with another account", async () => {
    state.verified = {
      productId: "runner_app_support",
      provider: "apple",
      purchasedAt: "2026-10-30T09:00:00.000Z",
      transactionId: "duplicate-transaction",
    };
    state.claim = false;
    const response = await POST(postRequest({
      action: "sync",
      provider: "apple",
      intentId: "11111111-1111-1111-1111-111111111111",
      transactionId: "duplicate-transaction",
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ purchased: false, verified: true });
  });
});

vi.mock("../../../../lib/http", () => ({
  checkRateLimitAsync: () => Promise.resolve({ allowed: true }),
  withSecurityHeaders: (response: Response) => response,
}));
vi.mock("../../../../lib/runner-access", () => ({
  getRunnerAdminMode: () => Promise.resolve(state.adminMode),
  getRunnerLaunchStatus: () => Promise.resolve(state.launch),
}));
vi.mock("../../../../lib/runner-support", () => ({
  RunnerSupportIntentConflictError: SupportIntentConflict,
  claimRunnerSupportPurchase: mocks.claim.mockImplementation(() => Promise.resolve(state.claim)),
  cancelRunnerSupportIntent: mocks.cancelIntent.mockResolvedValue(true),
  createRunnerSupportIntent: mocks.createIntent.mockImplementation(() => {
    if (state.intentConflict) throw new SupportIntentConflict();
    return Promise.resolve({
      id: "22222222-2222-2222-2222-222222222222",
      expires_at: "2026-11-01T09:00:00.000Z",
    });
  }),
  getRunnerSupportProductId: () => "runner_app_support",
  getRunnerSupportPurchase: () => Promise.resolve(state.purchase),
  verifyRevenueCatSupportPurchase: () => Promise.resolve(state.verified),
}));
vi.mock("../../../../lib/supabase", () => ({
  extractBearerToken: () => "token",
  fetchSupabaseUser: () => Promise.resolve({
    id: "44444444-4444-4444-4444-444444444444",
    app_metadata: {},
    user_metadata: {},
  }),
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service" }),
  isAnonymousUser: () => false,
}));

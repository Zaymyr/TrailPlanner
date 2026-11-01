import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ enabled: true, mode: "real" as "real" | "free" | "premium" }));

import { POST } from "./route";

const planId = "11111111-1111-1111-1111-111111111111";
const request = () => new Request("https://example.test/api/runner/purchase-intents", {
  method: "POST",
  headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
  body: JSON.stringify({ planId, provider: "apple" }),
});

describe("runner purchase intents", () => {
  beforeEach(() => {
    state.enabled = true;
    state.mode = "real";
    vi.stubEnv("REVENUECAT_COURSE_PRODUCT_ID", "course_unlock");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([false, "free", "premium"])("blocks real store work for rollout/admin state %s", async (blocked) => {
    if (typeof blocked === "boolean") state.enabled = blocked;
    else state.mode = blocked;
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recovers the same durable pending intent instead of creating another", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{
      id: "22222222-2222-2222-2222-222222222222",
      plan_id: planId,
      plan_key: "race:33333333-3333-3333-3333-333333333333:edition:legacy",
      product_id: "course_unlock",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }]));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ intentId: "22222222-2222-2222-2222-222222222222", recovered: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

vi.mock("../../../../lib/http", () => ({
  checkRateLimitAsync: () => Promise.resolve({ allowed: true }),
  withSecurityHeaders: (response: Response) => response,
}));
vi.mock("../../../../lib/runner-access", () => ({
  getRunnerMonetizationEnabled: () => Promise.resolve(state.enabled),
  getRunnerAdminMode: () => Promise.resolve(state.mode),
  getOwnedRunnerPlan: () => Promise.resolve({ id: planId, race_id: "33333333-3333-3333-3333-333333333333", races: { edition_id: null }, planKey: "race:33333333-3333-3333-3333-333333333333:edition:legacy" }),
  getRunnerPlanAccess: () => Promise.resolve({ canEdit: false }),
}));
vi.mock("../../../../lib/supabase", () => ({
  extractBearerToken: () => "token",
  fetchSupabaseUser: () => Promise.resolve({ id: "44444444-4444-4444-4444-444444444444", app_metadata: {}, user_metadata: {} }),
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service" }),
  isAnonymousUser: () => false,
}));

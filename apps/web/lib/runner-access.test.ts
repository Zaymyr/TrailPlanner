import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRunnerPlanAccess } = await import("./runner-access");

describe("runner plan access", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    vi.restoreAllMocks();
  });

  it("keeps legacy access open while monetization is disabled", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ monetization_enabled: false }])));
    const access = await getRunnerPlanAccess("u", "plan");
    expect(access.enabled).toBe(false);
    expect(access.canEdit).toBe(true);
  });

  it("honors free admin simulation while monetization is disabled", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ monetization_enabled: false }])));
    const access = await getRunnerPlanAccess("u", "plan", { adminMode: "free" });
    expect(access).toMatchObject({
      enabled: false,
      mode: "free",
      source: "free",
      canEdit: false,
      canViewDetails: false,
    });
  });

  it("honors premium admin simulation while monetization is disabled", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ monetization_enabled: false }])));
    const access = await getRunnerPlanAccess("u", "plan", { adminMode: "premium" });
    expect(access).toMatchObject({
      enabled: false,
      mode: "premium",
      source: "admin",
      isPremium: true,
      canEdit: true,
      canViewDetails: true,
    });
  });

  it("grants premium access when the server entitlement is active", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) return new Response(JSON.stringify([{ monetization_enabled: true }]));
      if (url.includes("subscriptions?")) return new Response(JSON.stringify([{ user_id: "u", status: "active", current_period_end: null }]));
      if (url.includes("user_profiles?")) return new Response(JSON.stringify([{ trial_ends_at: null, trial_expired_seen_at: null }]));
      return new Response(JSON.stringify([]));
    });
    const access = await getRunnerPlanAccess("u", "plan");
    expect(access.source).toBe("subscription");
    expect(access.canEdit).toBe(true);
  });

  it("does not unlock an unrelated course", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) return new Response(JSON.stringify([{ monetization_enabled: true }]));
      if (url.includes("runner_plan_unlocks")) return new Response(JSON.stringify([]));
      if (url.includes("subscriptions?") || url.includes("user_profiles?") || url.includes("premium_grants?")) return new Response(JSON.stringify([]));
      return new Response(JSON.stringify([]));
    });
    const access = await getRunnerPlanAccess("u", "other-course");
    expect(access.hasPlanUnlock).toBe(false);
    expect(access.canEdit).toBe(false);
  });

  it("recognizes a purchased course unlock", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) return new Response(JSON.stringify([{ monetization_enabled: true }]));
      if (url.includes("runner_plan_unlocks")) return new Response(JSON.stringify([{ status: "active" }]));
      return new Response(JSON.stringify([]));
    });
    const access = await getRunnerPlanAccess("u", "course");
    expect(access.source).toBe("plan_unlock");
    expect(access.canEdit).toBe(true);
  });

  it("keeps a historical plan readable but not editable", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) return new Response(JSON.stringify([{ monetization_enabled: true }]));
      if (url.includes("runner_plan_unlocks")) return new Response(JSON.stringify([]));
      return new Response(JSON.stringify([]));
    });
    const access = await getRunnerPlanAccess("u", "course", { hasHistoricalDetail: true });
    expect(access.source).toBe("historical_subscription");
    expect(access.canViewDetails).toBe(true);
    expect(access.canEdit).toBe(false);
  });
});

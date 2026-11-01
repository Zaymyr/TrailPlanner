import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRunnerLaunchStatus, getRunnerPlanAccess } = await import("./runner-access");

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

  it("keeps only the exact grandfathered plan editable", async () => {
    const requestedUrls: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("runner_monetization_config")) return new Response(JSON.stringify([{ monetization_enabled: true }]));
      if (url.includes("runner_launch_grandfathered_plans") && url.includes("plan_id=eq.old-plan") && url.includes("user_id=eq.owner")) {
        return new Response(JSON.stringify([{ plan_id: "old-plan" }]));
      }
      return new Response(JSON.stringify([]));
    });

    const grandfathered = await getRunnerPlanAccess("owner", "old-plan");
    expect(grandfathered).toMatchObject({
      source: "grandfathered_plan",
      canEdit: true,
      canViewDetails: true,
    });
    expect(requestedUrls.some((url) => url.includes("subscriptions?"))).toBe(false);

    const newPlan = await getRunnerPlanAccess("owner", "new-plan", { subscriptionActive: false });
    expect(newPlan).toMatchObject({ source: "free", canEdit: false, canViewDetails: false });
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

describe("runner launch status", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    vi.restoreAllMocks();
  });

  it("stays inactive before the server-side launch cutover", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ launched_at: null, launch_popup_ends_at: null }])),
    );
    await expect(getRunnerLaunchStatus("owner", Date.parse("2026-11-01T00:00:00Z"))).resolves.toEqual({
      launchedAt: null,
      endsAt: null,
      eligible: false,
      earlySupporter: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the campaign only to the early cohort during its seven-day window", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) {
        return new Response(JSON.stringify([{
          launched_at: "2026-11-01T00:00:00.000Z",
          launch_popup_ends_at: "2026-11-08T00:00:00.000Z",
        }]));
      }
      return new Response(JSON.stringify([{ early_supporter: true }]));
    });
    await expect(getRunnerLaunchStatus("owner", Date.parse("2026-11-04T00:00:00Z"))).resolves.toEqual({
      launchedAt: "2026-11-01T00:00:00.000Z",
      endsAt: "2026-11-08T00:00:00.000Z",
      eligible: true,
      earlySupporter: true,
    });
  });

  it("keeps the badge but stops the announcement after the launch week", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) {
        return new Response(JSON.stringify([{
          launched_at: "2026-11-01T00:00:00.000Z",
          launch_popup_ends_at: "2026-11-08T00:00:00.000Z",
        }]));
      }
      return new Response(JSON.stringify([{ early_supporter: true }]));
    });
    await expect(getRunnerLaunchStatus("owner", Date.parse("2026-11-08T00:00:00Z"))).resolves.toMatchObject({
      eligible: false,
      earlySupporter: true,
    });
  });

  it("does not enroll an account created after launch", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("runner_monetization_config")) {
        return new Response(JSON.stringify([{
          launched_at: "2026-11-01T00:00:00.000Z",
          launch_popup_ends_at: "2026-11-08T00:00:00.000Z",
        }]));
      }
      return new Response(JSON.stringify([]));
    });
    await expect(getRunnerLaunchStatus("new-owner", Date.parse("2026-11-04T00:00:00Z"))).resolves.toMatchObject({
      eligible: false,
      earlySupporter: false,
    });
  });
});

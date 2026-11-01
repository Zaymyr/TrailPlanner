import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sync: vi.fn(),
}));

vi.mock("./revenuecat", () => ({
  syncRevenueCatSubscriptionForUser: mocks.sync,
}));

vi.mock("./supabase", () => ({
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }),
}));

import { reconcileRevenueCatSubscriptions } from "./revenuecat-reconciliation";

describe("reconcileRevenueCatSubscriptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.sync.mockReset();
  });

  it("paginates Auth users and reconciles each UUID", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ users: [
        { id: "11111111-1111-4111-8111-111111111111" },
        { id: "22222222-2222-4222-8222-222222222222" },
      ] }))
      .mockResolvedValueOnce(Response.json({ users: [
        { id: "33333333-3333-4333-8333-333333333333" },
      ] }));
    mocks.sync
      .mockResolvedValueOnce({ synced: true })
      .mockResolvedValueOnce({ synced: false, reason: "not_found" })
      .mockRejectedValueOnce(new Error("temporary failure"));

    await expect(reconcileRevenueCatSubscriptions({ perPage: 2, concurrency: 2 })).resolves.toEqual({
      scanned: 3,
      synced: 1,
      unchanged: 1,
      failed: 1,
    });
    expect(mocks.sync).toHaveBeenCalledTimes(3);
  });

  it("fails closed when the Auth user list cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(reconcileRevenueCatSubscriptions()).rejects.toThrow("Unable to list Supabase Auth users (503)");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});

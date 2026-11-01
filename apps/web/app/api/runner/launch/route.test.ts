import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ status: vi.fn(), user: vi.fn() }));

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://example.test", supabaseAnonKey: "key" }),
  extractBearerToken: (header: string | null) => header?.replace("Bearer ", "") ?? null,
  fetchSupabaseUser: mocks.user,
  isAnonymousUser: (user: { isAnonymous?: boolean }) => user.isAnonymous === true,
}));
vi.mock("../../../../lib/runner-access", () => ({ getRunnerLaunchStatus: mocks.status }));

import { GET } from "./route";

const request = () => new Request("https://example.test/api/runner/launch", {
  headers: { Authorization: "Bearer token" },
});

describe("runner launch endpoint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "owner" });
    mocks.status.mockResolvedValue({
      launchedAt: "2026-11-01T00:00:00.000Z",
      endsAt: "2026-11-08T00:00:00.000Z",
      eligible: true,
      earlySupporter: true,
    });
  });

  it("requires an identified account", async () => {
    mocks.user.mockResolvedValue({ id: "guest", isAnonymous: true });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("returns the server-derived launch cohort with no-store caching", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.status).toHaveBeenCalledWith("owner");
    await expect(response.json()).resolves.toMatchObject({ eligible: true, earlySupporter: true });
  });

  it("fails closed when launch state cannot be resolved", async () => {
    mocks.status.mockRejectedValue(new Error("database unavailable"));
    expect((await GET(request())).status).toBe(503);
  });
});

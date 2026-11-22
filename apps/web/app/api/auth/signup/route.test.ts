import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  enforceAuthRateLimit: vi.fn(),
  getSupabaseAnonConfig: vi.fn(),
  ensureTrialStatus: vi.fn(),
}));

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceAuthRateLimit.mockResolvedValue(null);
    vi.unstubAllGlobals();
    mocks.getSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
  });


  it("returns the rate-limit response without contacting Supabase", async () => {
    mocks.enforceAuthRateLimit.mockResolvedValue(Response.json({ code: "rate_limited" }, { status: 429 }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("https://pace-yourself.test/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "runner@example.com", password: "password123" }) }));

    expect(response.status).toBe(429);
    expect(mocks.enforceAuthRateLimit).toHaveBeenCalledWith(expect.anything(), "signup", "runner@example.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes only a validated runner return path to the confirmation email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", email: "runner@example.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("https://pace-yourself.test/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "runner@example.com",
        password: "password123",
        fullName: "Runner Test",
        returnPath: "/race-planner?catalogRaceId=76b11657-f10a-49af-a728-18a58875ac4a&ignored=yes",
      }),
    }));

    expect(response.status).toBe(200);
    const signUpUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(signUpUrl.searchParams.get("redirect_to")).toBe(
      "https://pace-yourself.test/auth/callback?next=%2Frace-planner%3FcatalogRaceId%3D76b11657-f10a-49af-a728-18a58875ac4a",
    );
  });

  it("does not turn an external return URL into an email redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(new Request("https://pace-yourself.test/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "runner@example.com",
        password: "password123",
        returnPath: "https://malicious.example/steal",
      }),
    }));

    const signUpUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(signUpUrl.searchParams.get("redirect_to")).toBe(
      "https://pace-yourself.test/auth/callback?next=%2Frace-planner",
    );
  });
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: mocks.getSupabaseAnonConfig,
}));

vi.mock("../../../../lib/trial-server", () => ({
  ensureTrialStatus: mocks.ensureTrialStatus,
}));

vi.mock("../../../../lib/auth-rate-limit", () => ({
  enforceAuthRateLimit: mocks.enforceAuthRateLimit,
}));

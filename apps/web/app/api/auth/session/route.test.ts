import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  ensureTrialStatus: vi.fn(),
  extractBearerToken: vi.fn(),
  fetchSupabaseUser: vi.fn(),
  getSupabaseAnonConfig: vi.fn(),
  isAnonymousUser: vi.fn(),
}));

const sessionRequest = (headers?: HeadersInit) =>
  new Request("http://localhost/api/auth/session", { headers });

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.extractBearerToken.mockReturnValue(null);
    mocks.getSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
    mocks.isAnonymousUser.mockReturnValue(false);
  });

  it("fails closed when Supabase configuration is unavailable", async () => {
    mocks.getSupabaseAnonConfig.mockReturnValue(null);

    const response = await GET(sessionRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: "Supabase configuration is missing." });
  });

  it("rejects a request without an access token", async () => {
    const response = await GET(sessionRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Missing access token." });
    expect(mocks.fetchSupabaseUser).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token before returning the session", async () => {
    mocks.extractBearerToken.mockImplementation((value: string | null) => {
      if (value === "Bearer expired-token") return "expired-token";
      if (value === "Bearer refresh-token") return "refresh-token";
      return null;
    });
    mocks.fetchSupabaseUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "user-1", email: "runner@example.com", role: "authenticated", roles: [] });
    mocks.ensureTrialStatus.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "renewed-token",
            refresh_token: "renewed-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await GET(
      sessionRequest({
        authorization: "Bearer expired-token",
        "x-refresh-token": "Bearer refresh-token",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      user: { id: "user-1", isAnonymous: false },
      access_token: "renewed-token",
      refresh_token: "renewed-refresh-token",
    });
    expect(mocks.fetchSupabaseUser).toHaveBeenNthCalledWith(
      2,
      "renewed-token",
      expect.objectContaining({ supabaseAnonKey: "anon-key" }),
    );
    expect(mocks.ensureTrialStatus).toHaveBeenCalledWith(
      expect.objectContaining({ token: "renewed-token", userId: "user-1" }),
    );
    expect(response.headers.get("set-cookie")).toContain("trailplanner.access-token=renewed-token");
  });

  it("returns the session even when trial initialization temporarily fails", async () => {
    mocks.extractBearerToken.mockReturnValue("access-token");
    mocks.fetchSupabaseUser.mockResolvedValue({
      id: "anonymous-user",
      email: null,
      role: "authenticated",
      roles: [],
    });
    mocks.isAnonymousUser.mockReturnValue(true);
    mocks.ensureTrialStatus.mockRejectedValue(new Error("database unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(sessionRequest({ authorization: "Bearer access-token" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: "anonymous-user", isAnonymous: true },
      access_token: "access-token",
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

vi.mock("next/headers", () => ({
  cookies: () => ({ get: mocks.cookieGet }),
}));

vi.mock("../../../../lib/supabase", () => ({
  extractBearerToken: mocks.extractBearerToken,
  fetchSupabaseUser: mocks.fetchSupabaseUser,
  getSupabaseAnonConfig: mocks.getSupabaseAnonConfig,
  isAnonymousUser: mocks.isAnonymousUser,
}));

vi.mock("../../../../lib/trial-server", () => ({
  ensureTrialStatus: mocks.ensureTrialStatus,
}));

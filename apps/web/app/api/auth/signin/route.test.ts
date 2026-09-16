import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSupabaseAnonConfig: vi.fn(),
  getSupabaseServiceConfig: vi.fn(),
}));

const signInRequest = (body: unknown) =>
  new Request("http://localhost/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/auth/signin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
    mocks.getSupabaseServiceConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseServiceRoleKey: "service-key",
    });
  });

  it("rejects malformed credentials without contacting Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(signInRequest({ email: "invalid", password: "short" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "sign_in_failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when either server configuration is unavailable", async () => {
    mocks.getSupabaseServiceConfig.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(signInRequest({ email: "runner@example.com", password: "password123" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "sign_in_failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes Supabase authentication errors without exposing provider details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error_code: "invalid_credentials", debug: "secret detail" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const response = await POST(signInRequest({ email: "runner@example.com", password: "password123" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "invalid_credentials" });
  });

  it("sets secure HTTP-only cookies and records the sign-in metric after success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: "user-1", email: "runner@example.com" },
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 7200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(signInRequest({ email: "runner@example.com", password: "password123" }));
    const payload = await response.json();
    const cookies = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      user: { id: "user-1", email: "runner@example.com" },
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(cookies).toContain("trailplanner.access-token=access-token");
    expect(cookies).toContain("trailplanner.refresh-token=refresh-token");
    expect(cookies.toLowerCase()).toContain("httponly");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://supabase.example/rest/v1/rpc/increment_user_sign_in",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ p_user_id: "user-1" }),
      }),
    );
  });

  it("returns a stable error when the authentication request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private upstream failure")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(signInRequest({ email: "runner@example.com", password: "password123" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "sign_in_failed" });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: mocks.getSupabaseAnonConfig,
  getSupabaseServiceConfig: mocks.getSupabaseServiceConfig,
}));

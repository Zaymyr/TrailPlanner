import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSupabaseAnonConfig: vi.fn(),
  getSupabaseServiceConfig: vi.fn(),
}));

describe("POST /api/auth/password-reset-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
    mocks.getSupabaseServiceConfig.mockReturnValue(null);
  });

  it("passes the reset page as GoTrue's redirect_to query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new NextRequest("https://pace-yourself.com/api/auth/password-reset-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.0.2.42",
        },
        body: JSON.stringify({ email: "organizer@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [requestedUrl, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const recoveryUrl = new URL(requestedUrl);

    expect(recoveryUrl.origin + recoveryUrl.pathname).toBe("https://supabase.example/auth/v1/recover");
    expect(recoveryUrl.searchParams.get("redirect_to")).toBe("https://pace-yourself.com/reset-password");
    expect(JSON.parse(String(options.body))).toEqual({ email: "organizer@example.com" });
  });
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: mocks.getSupabaseAnonConfig,
  getSupabaseServiceConfig: mocks.getSupabaseServiceConfig,
}));

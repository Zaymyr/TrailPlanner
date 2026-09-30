import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const supabaseMocks = vi.hoisted(() => ({
  fetchSupabaseUser: vi.fn(),
}));

describe("GET /api/races", () => {
  beforeEach(() => {
    supabaseMocks.fetchSupabaseUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([], { status: 200 })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads only public live races", async () => {
    const response = await GET(new NextRequest("http://localhost/api/races", {
      headers: { authorization: "Bearer user-token" },
    }));

    expect(response.status).toBe(200);
    const requestUrl = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("is_live")).toBe("eq.true");
    expect(requestUrl.searchParams.get("is_public")).toBe("eq.true");
    expect(requestUrl.searchParams.get("or")).toBeNull();
    expect(requestUrl.searchParams.get("order")).toBe("name.asc");
  });
});

describe("POST /api/races", () => {
  beforeEach(() => {
    supabaseMocks.fetchSupabaseUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json([{
        id: "11111111-1111-4111-8111-111111111111",
        name: "Trail des Sources de l'Yvette",
        distance_km: 42,
        elevation_gain_m: 900,
        elevation_loss_m: 900,
        location_text: "Yvette",
        is_public: false,
        created_by: "00000000-0000-4000-8000-000000000001",
        gpx_storage_path: null,
      }], { status: 201 })
    ));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects retired personal race creation", async () => {
    const response = await POST(new NextRequest("http://localhost/api/races", {
      method: "POST",
      headers: { authorization: "Bearer user-token", "content-type": "application/json" },
      body: JSON.stringify({
        name: "Trail des Sources de l'Yvette",
        distance_km: 42,
        elevation_gain_m: 900,
        elevation_loss_m: 900,
      }),
    }));

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      message: "Personal race creation is no longer available.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../lib/http", () => ({
  checkRateLimit: () => ({ allowed: true }),
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: () => "user-token",
  fetchSupabaseUser: supabaseMocks.fetchSupabaseUser,
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-key",
  }),
}));

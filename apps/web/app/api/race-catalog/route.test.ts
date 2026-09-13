import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const supabaseMocks = vi.hoisted(() => ({
  fetchSupabaseUser: vi.fn(),
}));

describe("POST /api/race-catalog", () => {
  beforeEach(() => {
    supabaseMocks.fetchSupabaseUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      app_metadata: { role: "admin" },
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json([{
        id: "11111111-1111-4111-8111-111111111111",
        name: "Trail catalogue",
        distance_km: 10,
        elevation_gain_m: 250,
        elevation_loss_m: 250,
        location_text: null,
        gpx_storage_path: "catalog/source.gpx",
      }], { status: 201 }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes the required edition-group identity for a catalog race", async () => {
    const formData = new FormData();
    formData.set("name", "Trail catalogue");
    formData.set("gpx", new File(["<gpx></gpx>"], "course.gpx", { type: "application/gpx+xml" }));

    const response = await POST(new NextRequest("http://localhost/api/race-catalog", {
      method: "POST",
      headers: { authorization: "Bearer admin-token" },
      body: formData,
    }));

    expect(response.status).toBe(200);
    const insertCall = vi.mocked(fetch).mock.calls[1];
    const insertBody = JSON.parse(String(insertCall?.[1]?.body));
    expect(insertBody).toMatchObject({
      series_name: "Trail catalogue",
      name: "Trail catalogue",
      is_public: true,
    });
    expect(insertBody.edition_group_id).toBe(insertBody.id);
  });
});

vi.mock("../../../lib/gpx/parseGpx", () => ({
  parseGpx: () => ({
    name: "Trail catalogue",
    points: [],
    waypoints: [],
    pointSource: "track",
    stats: {
      distanceKm: 10,
      gainM: 250,
      lossM: 250,
      minAltM: 100,
      maxAltM: 350,
      startLat: 48.7,
      startLng: 2.1,
      boundsMinLat: 48.6,
      boundsMinLng: 2,
      boundsMaxLat: 48.8,
      boundsMaxLng: 2.2,
    },
  }),
}));

vi.mock("../../../lib/http", () => ({
  checkRateLimit: () => ({ allowed: true }),
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: () => "admin-token",
  fetchSupabaseUser: supabaseMocks.fetchSupabaseUser,
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-key",
  }),
  isAdminUser: () => true,
}));

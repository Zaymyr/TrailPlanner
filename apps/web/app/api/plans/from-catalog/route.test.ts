import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const request = () =>
  new NextRequest("http://localhost/api/plans/from-catalog", {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ catalogRaceId: "11111111-1111-1111-1111-111111111111" }),
  });

describe("/api/plans/from-catalog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies catalog aid station service flags into planner values", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Grand Trail",
            distance_km: 42,
            elevation_gain_m: 1800,
            elevation_loss_m: 1700,
            gpx_storage_path: "catalog/grand-trail.gpx",
            gpx_sha256: null,
            updated_at: "2026-06-18T10:00:00.000Z",
            race_aid_stations: [
              {
                id: "22222222-2222-2222-2222-222222222222",
                name: "Refuge",
                km: 12.5,
                water_available: true,
                solid_available: false,
                assistance_allowed: true,
                order_index: 0,
              },
              {
                id: "33333333-3333-3333-3333-333333333333",
                name: "Col",
                km: 24,
                water_available: false,
                solid_available: true,
                assistance_allowed: false,
                order_index: 1,
              },
            ],
          },
        ])
      )
      .mockResolvedValueOnce(new Response("<gpx />", { status: 200 }))
      .mockResolvedValueOnce(buildJsonResponse({}))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse(
          [
            {
              id: "44444444-4444-4444-4444-444444444444",
              name: "Grand Trail",
              created_at: "2026-06-18T10:00:00.000Z",
              updated_at: "2026-06-18T10:00:00.000Z",
              planner_values: {},
              elevation_profile: [],
            },
          ],
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(buildJsonResponse([]));

    const response = await POST(request());
    expect(response.status).toBe(200);

    const planInsertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).endsWith("/rest/v1/race_plans") && init?.method === "POST"
    );
    expect(planInsertCall).toBeDefined();

    const planInsertBody = JSON.parse(planInsertCall?.[1]?.body as string);
    expect(planInsertBody.planner_values.aidStations).toEqual([
      {
        name: "Refuge",
        distanceKm: 12.5,
        sourceAidStationId: "22222222-2222-2222-2222-222222222222",
        waterRefill: true,
        solidRefill: false,
        assistanceAllowed: true,
      },
      {
        name: "Col",
        distanceKm: 24,
        sourceAidStationId: "33333333-3333-3333-3333-333333333333",
        waterRefill: false,
        solidRefill: true,
        assistanceAllowed: false,
      },
    ]);
  });
});

vi.mock("../../../../lib/entitlements", () => ({
  getUserEntitlements: () => Promise.resolve({ isPremium: true, planLimit: Number.POSITIVE_INFINITY }),
}));

vi.mock("../../../../lib/gpx/parseGpx", () => ({
  parseGpx: () => ({
    pointSource: "track",
    points: [
      { distKmCum: 0, ele: 100, lat: 45, lng: 6 },
      { distKmCum: 42, ele: 120, lat: 45.1, lng: 6.1 },
    ],
    waypoints: [],
    stats: {
      distanceKm: 42,
      gainM: 1800,
      lossM: 1700,
      minAltM: 100,
      maxAltM: 1400,
      startLat: 45,
      startLng: 6,
    },
  }),
}));

vi.mock("../../../../lib/http", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10 }),
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-key",
  }),
  extractBearerToken: () => "user-token",
  fetchSupabaseUser: () =>
    Promise.resolve({
      id: "00000000-0000-0000-0000-000000000001",
      email: "runner@example.com",
      appMetadata: { role: "user" },
    }),
}));

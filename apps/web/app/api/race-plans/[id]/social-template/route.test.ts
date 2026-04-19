import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mockFetchSupabaseUser = vi.fn();
const mockIsAdminUser = vi.fn();

const mockSupabaseConfig = {
  supabaseUrl: "https://supabase.example",
  supabaseAnonKey: "anon-key",
};

const buildJsonResponse = (payload: unknown, options: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(payload), { status: options.status ?? 200, headers: options.headers });

const buildRequest = (planId: string, accessToken = "test-token") =>
  new NextRequest(`http://localhost/api/race-plans/${planId}/social-template`, {
    method: "GET",
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
  });

describe("GET /api/race-plans/[id]/social-template", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockFetchSupabaseUser.mockReset();
    mockIsAdminUser.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when the access token is missing", async () => {
    const response = await GET(buildRequest("11111111-1111-1111-1111-111111111111", ""), {
      params: { id: "11111111-1111-1111-1111-111111111111" },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Missing access token." });
  });

  it("returns 403 when the user is not admin", async () => {
    mockFetchSupabaseUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "user" });
    mockIsAdminUser.mockReturnValue(false);

    const response = await GET(buildRequest("11111111-1111-1111-1111-111111111111"), {
      params: { id: "11111111-1111-1111-1111-111111111111" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "Not authorized." });
  });

  it("returns 404 when the plan does not belong to the admin", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetchSupabaseUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "admin" });
    mockIsAdminUser.mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(buildJsonResponse([]));

    const response = await GET(buildRequest("11111111-1111-1111-1111-111111111111"), {
      params: { id: "11111111-1111-1111-1111-111111111111" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "Race plan not found." });
  });

  it("returns a social template with explicit supplies and preserves unknown products", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetchSupabaseUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "admin" });
    mockIsAdminUser.mockReturnValue(true);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Plan montagne",
            planner_values: {
              raceDistanceKm: 50,
              elevationGain: 2400,
              fatigueLevel: 0.5,
              paceType: "pace",
              paceMinutes: 6,
              paceSeconds: 30,
              speedKph: 9.2,
              targetIntakePerHour: 70,
              waterIntakePerHour: 550,
              sodiumIntakePerHour: 650,
              waterBagLiters: 1.5,
              startSupplies: [{ productId: "known-gel", quantity: 2 }],
              aidStations: [
                {
                  name: "Col du Lac",
                  distanceKm: 20,
                  waterRefill: true,
                  supplies: [{ productId: "missing-product", quantity: 1 }],
                },
              ],
            },
            elevation_profile: [
              { distanceKm: 0, elevationM: 500 },
              { distanceKm: 20, elevationM: 1200 },
              { distanceKm: 50, elevationM: 700 },
            ],
            plan_course_stats: {
              distanceKm: 50,
              elevationGainM: 2400,
            },
            races: {
              name: "Ultra des Cretes",
              distance_km: 50,
              elevation_gain_m: 2400,
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "known-gel",
            slug: "maurten-gel-100",
            name: "Maurten Gel 100",
            fuel_type: "gel",
            calories_kcal: 100,
            carbs_g: 25,
            sodium_mg: 85,
            protein_g: 0,
            fat_g: 0,
          },
        ])
      );

    const response = await GET(buildRequest("11111111-1111-1111-1111-111111111111"), {
      params: { id: "11111111-1111-1111-1111-111111111111" },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.race.name).toBe("Ultra des Cretes");
    expect(payload.startCarry.fallbackUsed).toBe(false);
    expect(payload.startCarry.items[0]).toMatchObject({
      kind: "product",
      label: "Maurten Gel 100",
      quantity: 2,
      carbsG: 50,
      sodiumMg: 170,
    });
    expect(payload.aidStations[0].take.fallbackUsed).toBe(false);
    expect(payload.aidStations[0].take.items[0]).toMatchObject({
      kind: "product",
      label: "Produit inconnu",
      productId: "missing-product",
      quantity: 1,
      note: "Produit introuvable dans le catalogue actuel.",
    });
    expect(payload.missingData).toContain("product_details");
    expect(payload.race.targetTime.source).toBe("computed");
  });

  it("falls back cleanly when no linked race or explicit supplies are available", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetchSupabaseUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "admin" });
    mockIsAdminUser.mockReturnValue(true);

    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: "22222222-2222-2222-2222-222222222222",
          name: "Plan solo",
          planner_values: {
            raceDistanceKm: 20,
            elevationGain: 0,
            fatigueLevel: 0.5,
            paceType: "pace",
            paceMinutes: 6,
            paceSeconds: 30,
            speedKph: 9.2,
            targetIntakePerHour: 70,
            waterIntakePerHour: 500,
            sodiumIntakePerHour: 600,
            waterBagLiters: 1.5,
            startSupplies: [],
            aidStations: [{ name: "Aid 1", distanceKm: 10, waterRefill: true, pauseMinutes: 10 }],
            sectionSegments: {
              "section-0": [{ segmentKm: 5 }, { segmentKm: 5, paceAdjustmentMinutesPerKm: 2 }],
              "section-1": [{ segmentKm: 10 }],
            },
          },
          elevation_profile: [
            { distanceKm: 0, elevationM: 0 },
            { distanceKm: 10, elevationM: 0 },
            { distanceKm: 20, elevationM: 0 },
          ],
          plan_course_stats: {
            distanceKm: 20,
            elevationGainM: 0,
          },
          races: null,
        },
      ])
    );

    const response = await GET(buildRequest("22222222-2222-2222-2222-222222222222"), {
      params: { id: "22222222-2222-2222-2222-222222222222" },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.race.name).toBe("Plan solo");
    expect(payload.startCarry.fallbackUsed).toBe(true);
    expect(payload.startCarry.items[0]).toMatchObject({
      kind: "estimate",
      label: "Estimation jusqu'a Aid 1",
      carbsG: 88,
      waterMl: 625,
      sodiumMg: 750,
    });
    expect(payload.aidStations[0].eta).toMatchObject({
      minutes: 75,
      label: "1h15",
    });
    expect(payload.aidStations[0].take.fallbackUsed).toBe(true);
    expect(payload.aidStations[0].take.items[0]).toMatchObject({
      kind: "estimate",
      label: "Estimation jusqu'a Arrivee",
      carbsG: 88,
      waterMl: 625,
      sodiumMg: 750,
    });
    expect(payload.race.targetTime).toMatchObject({
      minutes: 150,
      label: "2h30",
      source: "computed",
    });
    expect(payload.missingData).toContain("start_carry_details");
    expect(payload.missingData).toContain("aid_station_take_details");
  });
});

vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => mockSupabaseConfig,
  extractBearerToken: (authorizationHeader: string | null) => {
    if (!authorizationHeader) return null;
    const [scheme, token] = authorizationHeader.split(" ");
    if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
    return token;
  },
  fetchSupabaseUser: (...args: unknown[]) => mockFetchSupabaseUser(...args),
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
}));

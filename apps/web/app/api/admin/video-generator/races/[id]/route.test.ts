import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const raceId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const stationId = "33333333-3333-4333-8333-333333333333";

const authState = vi.hoisted(() => ({
  user: { id: "99999999-9999-4999-8999-999999999999", appMetadata: { role: "admin" } } as
    | { id: string; appMetadata: { role: string } }
    | null,
  isAdmin: true,
}));

const request = (withToken = true) => new NextRequest(`http://localhost/api/admin/video-generator/races/${raceId}`, {
  headers: withToken ? { authorization: "Bearer admin-token" } : undefined,
});

const raceRow = {
  id: raceId,
  event_id: eventId,
  name: "SaintéLyon 82 km",
  distance_km: 82,
  elevation_gain_m: 2300,
  elevation_loss_m: null,
  gpx_storage_path: "catalog/saintelyon.gpx",
  race_date: "2026-11-28",
  race_events: { id: eventId, name: "SaintéLyon" },
};

const stationRows = [{ id: stationId, name: "Sainte-Catherine", km: 32.5 }];

const validGpx = `<?xml version="1.0"?><gpx><trk><trkseg>
  <trkpt lat="45.0000" lon="6.0000"><ele>400</ele></trkpt>
  <trkpt lat="45.1000" lon="6.1000"><ele>500</ele></trkpt>
</trkseg></trk></gpx>`;

describe("GET /api/admin/video-generator/races/[id]", () => {
  beforeEach(() => {
    authState.user = { id: "99999999-9999-4999-8999-999999999999", appMetadata: { role: "admin" } };
    authState.isAdmin = true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.restoreAllMocks());

  it("rejects a request without a bearer token before reading private data", async () => {
    const response = await GET(request(false), { params: { id: raceId } });
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-admin before reading private data", async () => {
    authState.isAdmin = false;
    const response = await GET(request(), { params: { id: raceId } });
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads a draft race, its stations and every ordered GPX point", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([raceRow]))
      .mockResolvedValueOnce(Response.json(stationRows))
      .mockResolvedValueOnce(new Response(validGpx));

    const response = await GET(request(), { params: { id: raceId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain("is_live");
    expect(payload).toMatchObject({
      race: { id: raceId, eventName: "SaintéLyon", elevationLossM: null, editionYear: 2026 },
      aidStations: [{ id: stationId, name: "Sainte-Catherine", distanceKm: 32.5 }],
      gpx: { status: "ready", pointCount: 2 },
    });
    expect(payload.gpx.points).toEqual([
      { lat: 45, lon: 6, elevationM: 400, distanceKm: 0 },
      expect.objectContaining({ lat: 45.1, lon: 6.1, elevationM: 500 }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("gpx_storage_path");
    expect(JSON.stringify(payload)).not.toContain("catalog/saintelyon.gpx");
    expect(JSON.stringify(payload)).not.toContain("service-key");
  });

  it("returns an explicit non-error state when the format has no GPX", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ ...raceRow, gpx_storage_path: null }]))
      .mockResolvedValueOnce(Response.json([]));

    const response = await GET(request(), { params: { id: raceId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gpx: { status: "missing" } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns 404 for an unknown format", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([]));

    const response = await GET(request(), { params: { id: raceId } });
    expect(response.status).toBe(404);
  });

  it("returns 422 for an invalid GPX without leaking its content", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([raceRow]))
      .mockResolvedValueOnce(Response.json(stationRows))
      .mockResolvedValueOnce(new Response("not a gpx"));

    const response = await GET(request(), { params: { id: raceId } });
    const payload = await response.json();
    expect(response.status).toBe(422);
    expect(payload.message).toMatch(/^Invalid GPX file:/);
    expect(JSON.stringify(payload)).not.toContain("not a gpx");
  });

  it("returns 502 when the private Storage object cannot be read", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([raceRow]))
      .mockResolvedValueOnce(Response.json(stationRows))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));

    const response = await GET(request(), { params: { id: raceId } });
    expect(response.status).toBe(502);
  });
});

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () => Promise.resolve(authState.user),
  isAdminUser: () => authState.isAdmin,
}));

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";
const eventId = "22222222-2222-2222-2222-222222222222";
const existingStationId = "33333333-3333-3333-3333-333333333333";

const organizerMocks = vi.hoisted(() => ({
  loadRaceForOrganizer: vi.fn(),
}));

const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><name>Test GPX</name><trkseg>
    <trkpt lat="45.0000" lon="6.0000"><ele>100</ele></trkpt>
    <trkpt lat="45.0100" lon="6.0100"><ele>250</ele></trkpt>
    <trkpt lat="45.0200" lon="6.0200"><ele>150</ele></trkpt>
  </trkseg></trk>
  <wpt lat="45.0100" lon="6.0100"><name>Ravito 1</name></wpt>
</gpx>`;

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const buildTextResponse = (payload: string, options: { status?: number } = {}) =>
  new Response(payload, {
    status: options.status ?? 200,
    headers: { "content-type": "application/gpx+xml" },
  });

const getRequest = () =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}/gpx`, {
    method: "GET",
    headers: { authorization: "Bearer user-token" },
  });

const putRequest = () => {
  const formData = new FormData();
  formData.append("gpx", new File([gpxContent], "race.gpx", { type: "application/gpx+xml" }));
  return new NextRequest(`http://localhost/api/organizer/races/${raceId}/gpx`, {
    method: "PUT",
    headers: { authorization: "Bearer user-token" },
    body: formData,
  });
};

describe("/api/organizer/races/[id]/gpx", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.loadRaceForOrganizer.mockResolvedValue({ id: raceId, event_id: eventId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed stats, elevation profile, and detected aid stations for an existing GPX", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(buildJsonResponse([{ id: raceId, gpx_storage_path: "race.gpx" }]))
      .mockResolvedValueOnce(buildTextResponse(gpxContent));

    const response = (await GET(getRequest(), { params: { id: raceId } })) as Response;
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.stats.distanceKm).toBeGreaterThan(0);
    expect(payload.stats.gainM).toBeGreaterThan(0);
    expect(payload.elevationProfile.length).toBeGreaterThanOrEqual(2);
    expect(payload.detectedAidStations[0]).toMatchObject({ name: "Ravito 1" });
  });

  it("creates waypoint aid stations only when none exist", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(buildJsonResponse([{ id: raceId, gpx_storage_path: "new.gpx" }]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    const response = (await PUT(putRequest(), { params: { id: raceId } })) as Response;
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.appliedAidStationCount).toBe(1);
    expect(payload.detectedAidStations[0]).toMatchObject({ name: "Ravito 1" });

    const stationInsertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).endsWith("/rest/v1/race_aid_stations") && init?.method === "POST"
    );
    expect(stationInsertCall).toBeTruthy();
    expect(JSON.parse(stationInsertCall?.[1]?.body as string)[0]).toMatchObject({
      race_id: raceId,
      name: "Ravito 1",
      water_available: true,
    });
  });

  it("preserves existing aid stations when GPX waypoints are detected", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(buildJsonResponse([{ id: raceId, gpx_storage_path: "new.gpx" }]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: existingStationId }]));

    const response = (await PUT(putRequest(), { params: { id: raceId } })) as Response;
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.detectedAidStations).toHaveLength(1);
    expect(payload.appliedAidStationCount).toBe(0);
    expect(
      mockFetch.mock.calls.some(
        ([url, init]) => String(url).endsWith("/rest/v1/race_aid_stations") && init?.method === "POST"
      )
    ).toBe(false);
  });
});

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: organizerMocks.loadRaceForOrganizer,
  requireOrganizerAuth: () =>
    Promise.resolve({
      user: { id: "00000000-0000-0000-0000-000000000001" },
      serviceConfig: {
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service-key",
      },
    }),
  serviceHeaders: (_serviceConfig: unknown, contentType = "application/json") => ({
    apikey: "service-key",
    Authorization: "Bearer service-key",
    ...(contentType ? { "Content-Type": contentType } : {}),
  }),
  uuidParamSchema: {
    safeParse: (params: { id?: string }) =>
      typeof params.id === "string" ? { success: true, data: { id: params.id } } : { success: false },
  },
}));

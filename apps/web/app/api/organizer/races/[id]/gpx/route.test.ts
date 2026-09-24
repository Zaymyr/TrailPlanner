import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PUT } from "./route";

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

const deleteRequest = () =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}/gpx`, {
    method: "DELETE",
    headers: { authorization: "Bearer user-token" },
  });

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
    expect(payload.elevationProfile[0]).toMatchObject({
      cumulativeGainM: 0,
      cumulativeLossM: 0,
    });
    expect(payload.elevationProfile.at(-1)).toMatchObject({
      cumulativeGainM: payload.stats.gainM,
      cumulativeLossM: payload.stats.lossM,
    });
    expect(payload.detectedAidStations[0]).toMatchObject({ name: "Ravito 1" });
  });

  it("deletes the GPX source while preserving race metrics and aid stations", async () => {
    organizerMocks.loadRaceForOrganizer.mockResolvedValueOnce({
      id: raceId,
      event_id: eventId,
      organizer_details: {
        gpxDisplay: { showRoute: true, showElevationProfile: true },
      },
    });
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(buildJsonResponse([{ id: raceId, gpx_storage_path: "organizer/race.gpx" }]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: raceId,
            gpx_storage_path: null,
            distance_km: 42,
            elevation_gain_m: 1800,
            organizer_details: {
              gpxDisplay: { showRoute: false, showElevationProfile: false },
            },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = (await DELETE(deleteRequest(), { params: { id: raceId } })) as Response;
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.race).toMatchObject({
      gpx_storage_path: null,
      distance_km: 42,
      elevation_gain_m: 1800,
      organizerDetails: {
        gpxDisplay: { showRoute: false, showElevationProfile: false },
      },
    });

    const updateBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body));
    expect(updateBody).toMatchObject({
      gpx_path: null,
      gpx_hash: null,
      gpx_storage_path: null,
      gpx_sha256: null,
      organizer_details: {
        gpxDisplay: { showRoute: false, showElevationProfile: false },
      },
    });
    expect(updateBody).not.toHaveProperty("distance_km");
    expect(updateBody).not.toHaveProperty("elevation_gain_m");
    expect(
      mockFetch.mock.calls.some(([url]) => String(url).includes("/rest/v1/race_aid_stations"))
    ).toBe(false);
    expect(mockFetch.mock.calls[2]).toMatchObject([
      "https://supabase.example/storage/v1/object/race-gpx/organizer/race.gpx",
      { method: "DELETE" },
    ]);
  });

  it("refuses GPX deletion when the race has no source file", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(buildJsonResponse([{ id: raceId, gpx_storage_path: null }]));

    const response = (await DELETE(deleteRequest(), { params: { id: raceId } })) as Response;

    expect(response.status).toBe(409);
    expect(mockFetch).toHaveBeenCalledTimes(1);
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

  it("completes an imported draft when the GPX supplies its missing metrics", async () => {
    organizerMocks.loadRaceForOrganizer.mockResolvedValueOnce({
      id: raceId,
      event_id: eventId,
      data_status: "draft",
      missing_required_fields: ["distance_km", "elevation_gain_m"],
    });
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(buildJsonResponse([{ id: raceId, gpx_storage_path: "new.gpx" }]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: existingStationId }]));

    const response = (await PUT(putRequest(), { params: { id: raceId } })) as Response;

    expect(response.status).toBe(200);
    expect(JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body))).toMatchObject({
      missing_required_fields: [],
      data_status: "complete",
      is_live: false,
      racebook_is_live: false,
    });
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

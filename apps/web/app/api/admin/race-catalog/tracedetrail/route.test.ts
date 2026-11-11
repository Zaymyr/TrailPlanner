import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

const mockGpx = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">',
  "<trk><trkseg>",
  '<trkpt lat="45.0000" lon="6.0000"><ele>100</ele></trkpt>',
  '<trkpt lat="45.0100" lon="6.0100"><ele>150</ele></trkpt>',
  "</trkseg></trk>",
  "</gpx>",
].join("");

vi.mock("../../../../../lib/supabase", () => ({
  extractBearerToken: vi.fn(() => "admin-token"),
  fetchSupabaseUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" })),
  getSupabaseAnonConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "anon-key",
  })),
  getSupabaseServiceConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceRoleKey: "service-key",
  })),
  isAdminUser: vi.fn(() => true),
}));

vi.mock("../../../../../lib/tracedetrail-race-import", () => ({
  getTraceDeTrailRaceData: vi.fn(async () => ({
    traceId: 316035,
    normalizedUrl: "https://tracedetrail.fr/fr/trace/316035",
    courseName: "W100 Été",
    eventName: "THP",
    officialSiteUrl: null,
    thumbnailUrl: null,
    distanceKm: 100,
    elevationGainM: 5000,
    elevationLossM: 5000,
    date: null,
    location: null,
    aidStations: [],
    elevationProfile: [{ distanceKm: 0, elevationM: 100 }],
    gpxContent: mockGpx,
    gpxAccessMode: "embedded",
  })),
  TraceDeTrailImportError: class TraceDeTrailImportError extends Error {},
}));

import { getTraceDeTrailRaceData } from "../../../../../lib/tracedetrail-race-import";
import { POST } from "./route";

describe("Trace de Trail admin route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns a GPX download without calling Supabase REST or Storage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const request = new NextRequest("http://localhost/api/admin/race-catalog/tracedetrail", {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url: "https://tracedetrail.fr/fr/trace/316035",
        action: "download",
      }),
    });

    const response = await POST(request);
    if (!response) throw new Error("Expected a download response");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/gpx+xml");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="w100-ete.gpx"');
    expect(await response.text()).toBe(mockGpx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("enriches an existing race without creating an event, format, or aid stations", async () => {
    const raceId = "22222222-2222-4222-8222-222222222222";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.includes(`/rest/v1/races?id=eq.${raceId}&select=`) && !init?.method) {
        return Response.json([
          {
            id: raceId,
            name: "W100 Été existante",
            location_text: "Chamonix",
            location: null,
            distance_km: 99.5,
            elevation_gain_m: 4900,
            elevation_loss_m: 4800,
            trace_provider: "tracedetrail",
            trace_id: 316035,
            source_url: null,
            external_site_url: "https://example.com/course",
            thumbnail_url: null,
            gpx_path: null,
            gpx_hash: null,
            gpx_storage_path: null,
            gpx_sha256: null,
            is_live: false,
            slug: "w100-ete-existante",
          },
        ]);
      }

      if (url.includes("/storage/v1/object/race-gpx/catalog/") && init?.method === "POST") {
        return new Response(null, { status: 200 });
      }

      if (url.endsWith(`/rest/v1/races?id=eq.${raceId}`) && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json([
          {
            id: raceId,
            name: "W100 Été existante",
            location_text: "Chamonix",
            distance_km: 99.5,
            elevation_gain_m: 4900,
            elevation_loss_m: 4800,
            trace_provider: payload.trace_provider,
            trace_id: payload.trace_id,
            external_site_url: "https://example.com/course",
            thumbnail_url: null,
            gpx_storage_path: payload.gpx_storage_path,
            is_live: false,
            slug: "w100-ete-existante",
          },
        ]);
      }

      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });

    const request = new NextRequest("http://localhost/api/admin/race-catalog/tracedetrail", {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ raceId, action: "enrich" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      enriched: true,
      race: { id: raceId, name: "W100 Été existante", trace_id: 316035 },
    });
    expect(getTraceDeTrailRaceData).toHaveBeenCalledWith(
      "https://tracedetrail.fr/fr/trace/316035",
      { credentials: null }
    );

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith(`/rest/v1/races?id=eq.${raceId}`) && init?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    const patchPayload = JSON.parse(String(patchCall?.[1]?.body)) as Record<string, unknown>;
    expect(patchPayload).toMatchObject({
      trace_provider: "tracedetrail",
      trace_id: 316035,
      source_url: "https://tracedetrail.fr/fr/trace/316035",
      gpx_path: expect.stringMatching(new RegExp(`^catalog/${raceId}/tracedetrail-\\d+\\.gpx$`)),
      gpx_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      gpx_storage_path: expect.stringMatching(new RegExp(`^catalog/${raceId}/tracedetrail-\\d+\\.gpx$`)),
      gpx_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(patchPayload).not.toHaveProperty("name");
    expect(patchPayload).not.toHaveProperty("event_id");
    expect(patchPayload).not.toHaveProperty("edition_id");
    expect(patchPayload).not.toHaveProperty("distance_km");
    expect(patchPayload).not.toHaveProperty("elevation_gain_m");
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          (String(url).includes("/rest/v1/race_events") ||
            String(url).includes("/rest/v1/race_aid_stations")) &&
          init?.method === "POST"
      )
    ).toBe(false);
  });

  it("refuses to associate a downloaded trace when the stored trace id differs", async () => {
    const raceId = "33333333-3333-4333-8333-333333333333";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json([
        {
          id: raceId,
          name: "Another course",
          location_text: null,
          location: null,
          distance_km: 20,
          elevation_gain_m: 800,
          elevation_loss_m: 800,
          trace_provider: "tracedetrail",
          trace_id: 999999,
          source_url: "https://tracedetrail.fr/fr/trace/316035",
          external_site_url: null,
          thumbnail_url: null,
          gpx_path: null,
          gpx_hash: null,
          gpx_storage_path: null,
          gpx_sha256: null,
          is_live: false,
          slug: "another-course",
        },
      ])
    );
    const request = new NextRequest("http://localhost/api/admin/race-catalog/tracedetrail", {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ raceId, action: "enrich" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "L'identifiant de la trace téléchargée ne correspond pas à la course ciblée.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not upload or patch when the existing GPX already has the downloaded hash", async () => {
    const raceId = "44444444-4444-4444-8444-444444444444";
    const gpxSha = createHash("sha256").update(mockGpx).digest("hex");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json([
        {
          id: raceId,
          name: "Already enriched",
          location_text: null,
          location: null,
          distance_km: 42,
          elevation_gain_m: 1800,
          elevation_loss_m: 1800,
          trace_provider: "tracedetrail",
          trace_id: 316035,
          source_url: "https://tracedetrail.fr/fr/trace/316035",
          external_site_url: null,
          thumbnail_url: null,
          gpx_path: `catalog/${raceId}/tracedetrail-existing.gpx`,
          gpx_hash: gpxSha,
          gpx_storage_path: `catalog/${raceId}/tracedetrail-existing.gpx`,
          gpx_sha256: gpxSha,
          is_live: true,
          slug: "already-enriched",
        },
      ])
    );
    const request = new NextRequest("http://localhost/api/admin/race-catalog/tracedetrail", {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ raceId, action: "enrich" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      enriched: false,
      unchanged: true,
      race: { id: raceId, gpx_sha256: gpxSha },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTraceDeTrailRaceData,
  TraceDeTrailImportError,
} from "./tracedetrail-race-import";
import {
  enrichExistingRaceWithTraceDeTrailGpx,
  TraceDeTrailEnrichmentError,
} from "./tracedetrail-gpx-enrichment";

vi.mock("server-only", () => ({}));
vi.mock("./tracedetrail-race-import", () => {
  class TraceDeTrailImportError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  }
  return { TraceDeTrailImportError, getTraceDeTrailRaceData: vi.fn() };
});

const raceId = "22222222-2222-4222-8222-222222222222";
const serviceConfig = {
  supabaseUrl: "https://project.supabase.co",
  supabaseServiceRoleKey: "service-key",
};
const gpx = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">',
  "<trk><trkseg>",
  '<trkpt lat="45.0000" lon="6.0000"><ele>100</ele></trkpt>',
  '<trkpt lat="45.0100" lon="6.0100"><ele>150</ele></trkpt>',
  "</trkseg></trk>",
  "</gpx>",
].join("");
const gpxSha = createHash("sha256").update(gpx).digest("hex");

const race = {
  id: raceId,
  name: "Course existante",
  location_text: "Millau",
  location: null,
  distance_km: 42,
  elevation_gain_m: 1800,
  elevation_loss_m: 1700,
  trace_provider: "tracedetrail",
  trace_id: 325355,
  source_url: "https://tracedetrail.fr/fr/trace/325355",
  external_site_url: null,
  thumbnail_url: null,
  gpx_path: null,
  gpx_hash: null,
  gpx_storage_path: null,
  gpx_sha256: null,
  min_alt_m: null,
  max_alt_m: null,
  start_lat: null,
  start_lng: null,
  bounds_min_lat: null,
  bounds_min_lng: null,
  bounds_max_lat: null,
  bounds_max_lng: null,
  is_live: true,
  slug: "course-existante",
};

const providerRace = {
  traceId: 325355,
  normalizedUrl: "https://tracedetrail.fr/fr/trace/325355",
  courseName: "Course existante",
  eventName: "Hivernale des Templiers",
  officialSiteUrl: null,
  thumbnailUrl: null,
  distanceKm: 42,
  elevationGainM: 1800,
  elevationLossM: 1700,
  date: "2026-12-06",
  location: "Roquefort-sur-Soulzon",
  aidStations: [],
  elevationProfile: [{ distanceKm: 0, elevationM: 100 }],
  gpxContent: gpx,
  gpxAccessMode: "public" as const,
};

const mockedProvider = vi.mocked(getTraceDeTrailRaceData);

describe("Trace de Trail existing-race GPX enrichment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedProvider.mockReset();
    mockedProvider.mockResolvedValue(providerRace);
  });

  it("uploads, verifies, and associates an official GPX without touching stations, plans, or publication", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/rest/v1/races?") && !init?.method) return Response.json([race]);
      if (url.includes("/storage/v1/object/race-gpx/") && init?.method === "POST") {
        return new Response(null, { status: 200 });
      }
      if (url.includes("/storage/v1/object/race-gpx/") && !init?.method) {
        return new Response(gpx, { status: 200 });
      }
      if (url.endsWith(`/rest/v1/races?id=eq.${raceId}`) && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json([{ ...race, ...payload }]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });

    const result = await enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId });

    expect(result).toMatchObject({ enriched: true, unchanged: false, storageVerified: true });
    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith(`/rest/v1/races?id=eq.${raceId}`) && init?.method === "PATCH"
    );
    const payload = JSON.parse(String(patchCall?.[1]?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      trace_provider: "tracedetrail",
      trace_id: 325355,
      gpx_sha256: gpxSha,
      gpx_storage_path: expect.stringMatching(new RegExp(`^catalog/${raceId}/tracedetrail-\\d+\\.gpx$`)),
    });
    expect(payload).not.toHaveProperty("is_live");
    expect(payload).not.toHaveProperty("distance_km");
    expect(payload).not.toHaveProperty("elevation_gain_m");
    expect(payload).not.toHaveProperty("commercial_data");
    expect(fetchMock.mock.calls.some(([url]) => /race_aid_stations|race_plans/.test(String(url)))).toBe(false);
  });

  it("returns a provider error without writing", async () => {
    mockedProvider.mockRejectedValue(new TraceDeTrailImportError("FETCH_FAILED", "Fournisseur indisponible."));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([race]));

    await expect(enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid GPX content before Storage", async () => {
    mockedProvider.mockResolvedValue({ ...providerRace, gpxContent: "<html>not gpx</html>" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([race]));

    await expect(enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId })).rejects.toMatchObject({
      code: "INVALID_GPX",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a downloaded trace whose id differs from the stored trace_id", async () => {
    mockedProvider.mockResolvedValue({ ...providerRace, traceId: 999999 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([race]));

    await expect(enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId })).rejects.toMatchObject({
      code: "TRACE_ID_MISMATCH",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an unchanged GPX only after verifying the existing Storage object", async () => {
    const existing = {
      ...race,
      gpx_path: `catalog/${raceId}/existing.gpx`,
      gpx_hash: gpxSha,
      gpx_storage_path: `catalog/${raceId}/existing.gpx`,
      gpx_sha256: gpxSha,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json([existing]))
      .mockResolvedValueOnce(new Response(gpx, { status: 200 }));

    await expect(enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId })).resolves.toMatchObject({
      enriched: false,
      unchanged: true,
      storageVerified: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a Storage write failure and never patches the race", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json([race]))
      .mockResolvedValueOnce(new Response("write failed", { status: 500 }));

    const promise = enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId });
    await expect(promise).rejects.toBeInstanceOf(TraceDeTrailEnrichmentError);
    await expect(promise).rejects.toMatchObject({ code: "STORAGE_WRITE_FAILED" });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("rejects reconstructed embedded geometry because it is not the official GPX file", async () => {
    mockedProvider.mockResolvedValue({ ...providerRace, gpxAccessMode: "embedded" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([race]));

    await expect(enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId })).rejects.toMatchObject({
      code: "OFFICIAL_GPX_REQUIRED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

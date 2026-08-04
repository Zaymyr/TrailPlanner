import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
    gpxContent: "<gpx><trk /></gpx>",
    gpxAccessMode: "embedded",
  })),
  TraceDeTrailImportError: class TraceDeTrailImportError extends Error {},
}));

import { POST } from "./route";

describe("Trace de Trail admin route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    expect(await response.text()).toBe("<gpx><trk /></gpx>");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

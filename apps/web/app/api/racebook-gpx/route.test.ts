import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ loadCurrent: vi.fn() }));
vi.mock("../../../lib/racebook-publications", () => ({ loadCurrentRacebookPublication: mocks.loadCurrent }));
vi.mock("../../../lib/gpx/parseGpx", () => ({
  parseGpx: () => ({ points: [
    { lat: 45, lng: 6, ele: 1000, distKmCum: 0 },
    { lat: 45.1, lng: 6.1, ele: 1100, distKmCum: 1.5 },
  ] }),
}));
vi.mock("../../../lib/organizer", () => ({ serviceHeaders: () => ({}), isOrganizerForEvent: () => Promise.resolve(false) }));
vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: () => null, fetchSupabaseUser: () => null, getSupabaseAnonConfig: () => null,
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));

const raceId = "11111111-1111-4111-8111-111111111111";
const access = [{ id: raceId, event_id: "22222222-2222-4222-8222-222222222222", edition_id: "33333333-3333-4333-8333-333333333333", is_live: true, racebook_is_live: true, racebook_preview_is_visible: true, race_events: { is_live: true } }];

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("GET /api/racebook-gpx", () => {
  it("loads only the GPX path captured by the publication", async () => {
    mocks.loadCurrent.mockResolvedValue({ publication: { id: "44444444-4444-4444-8444-444444444444", source_draft_revision: 2, published_at: "2026-11-03T12:00:00Z", content: { assets: { gpxStoragePath: "published/course.gpx" } } } });
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access)).mockResolvedValueOnce(new Response("<gpx />"));
    const response = await GET(new NextRequest(`http://localhost/api/racebook-gpx?raceId=${raceId}`));
    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("published/course.gpx");
    expect(await response.json()).toMatchObject({ publicationRevision: 2, elevationProfile: [{ distanceKm: 0, elevationM: 1000 }, { distanceKm: 1.5, elevationM: 1100 }] });
  });

  it("does not fall back to the race draft when the publication has no GPX", async () => {
    mocks.loadCurrent.mockResolvedValue({ publication: { content: { assets: { gpxStoragePath: null } } } });
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access));
    expect((await GET(new NextRequest(`http://localhost/api/racebook-gpx?raceId=${raceId}`))).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

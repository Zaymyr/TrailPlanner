import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getSupabaseServiceConfig: vi.fn() }));
const raceId = "76b11657-f10a-49af-a728-18a58875ac4a";

describe("GET /api/race-catalog/:id/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getSupabaseServiceConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseServiceRoleKey: "service-key",
    });
  });

  it("returns only the public mini-card contract", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: raceId,
        event_id: "7a110000-0000-4000-8000-000000000001",
        name: "Bibracte Ultra Trail 12 km",
        slug: "bibracte-ultra-trail-12-km-2026",
        distance_km: 12,
        elevation_gain_m: 480,
        race_date: "2026-12-01",
        private_notes: "must not leak",
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "7a110000-0000-4000-8000-000000000001" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request(`http://localhost/api/race-catalog/${raceId}/summary`) as never, { params: { id: raceId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ race: {
      id: raceId,
      name: "Bibracte Ultra Trail 12 km",
      slug: "bibracte-ultra-trail-12-km-2026",
      distanceKm: 12,
      elevationGainM: 480,
      date: "2026-12-01",
    } });
    expect(fetchMock.mock.calls[0][0]).toContain("web_catalog_is_live=eq.true&is_public=eq.true");
    expect(fetchMock.mock.calls[0][0]).toContain("select=id,event_id,name,slug,distance_km,elevation_gain_m,race_date");
  });

  it("hides a race whose parent event is not live", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: raceId,
        event_id: "7a110000-0000-4000-8000-000000000001",
        name: "Course",
        slug: "course",
        distance_km: 12,
        elevation_gain_m: 480,
        race_date: null,
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 })));

    const response = await GET(new Request(`http://localhost/api/race-catalog/${raceId}/summary`) as never, { params: { id: raceId } });
    expect(response.status).toBe(404);
  });
});

vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: mocks.getSupabaseServiceConfig,
}));

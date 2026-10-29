import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";

const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "content-type": "application/json" },
});
const request = (supporterPoints: unknown[]) => new NextRequest(`http://localhost/api/organizer/races/${raceId}/supporter-points`, {
  method: "PUT",
  headers: { authorization: "Bearer token", "content-type": "application/json" },
  body: JSON.stringify({ supporterPoints }),
});

describe("/api/organizer/races/[id]/supporter-points", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("sorts complete and incomplete drafts before one atomic replacement", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response([]));
    const result = await PUT(request([
      { name: "Village", distanceKm: 32, encouragementAllowed: true, assistanceAllowed: false, accessLabel: "Place", latitude: 45, longitude: 6, googleMapsUrl: "https://maps.google.com/test", accessNote: "Parking nord", planUrl: "https://example.com/plan" },
      { name: "Brouillon", distanceKm: null, encouragementAllowed: false, assistanceAllowed: false, accessLabel: "", latitude: null, longitude: null, accessNote: "", planUrl: "" },
      { name: "Col", distanceKm: 12, encouragementAllowed: true, assistanceAllowed: true, accessLabel: "Col", latitude: 45.2, longitude: 6.2, accessNote: "", planUrl: "" },
    ]), { params: { id: raceId } });

    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("/rpc/replace_race_supporter_points");
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string);
    expect(body.p_items.map((point: { name: string }) => point.name)).toEqual(["Col", "Village", "Brouillon"]);
    expect(body.p_items[0]).toMatchObject({ km: 12, encouragement_allowed: true, assistance_allowed: true });
  });

  it("rejects a point beyond the format distance", async () => {
    const result = await PUT(request([
      { name: "Trop loin", distanceKm: 51, encouragementAllowed: true, assistanceAllowed: false, accessLabel: "Lieu", latitude: 45, longitude: 6 },
    ]), { params: { id: raceId } });
    expect(result.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-http plan links", async () => {
    const result = await PUT(request([
      { name: "Col", distanceKm: 12, encouragementAllowed: true, assistanceAllowed: false, accessLabel: "Lieu", latitude: 45, longitude: 6, planUrl: "ftp://example.com/plan" },
    ]), { params: { id: raceId } });
    expect(result.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (value: Response) => value }));
vi.mock("../../../../../../lib/organizer-module-settings", () => ({ isOrganizerRaceModuleSelected: () => Promise.resolve(true) }));
vi.mock("../../../../../../lib/racebook-cache", () => ({ invalidateRacebookCache: () => Promise.resolve() }));
vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: () => Promise.resolve({ id: raceId, event_id: "44444444-4444-4444-4444-444444444444", edition_id: "55555555-5555-4555-8555-555555555555", distance_km: 50 }),
  requireOrganizerAuth: () => Promise.resolve({ user: { id: "00000000-0000-0000-0000-000000000001" }, serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" } }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key", "Content-Type": "application/json" }),
  uuidParamSchema: { safeParse: (params: { id?: string }) => params.id ? { success: true, data: { id: params.id } } : { success: false } },
}));

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({ moduleSelected: false, invalidate: vi.fn(async () => {}) }));

vi.mock("../../../../../../lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../../lib/supabase")>()),
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseAnonKey: "anon" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
  fetchSupabaseUser: async (token: string) => (token === "organizer" || token === "stranger" ? { id: token === "organizer" ? USER_ID : STRANGER_ID } : null),
  isAdminUser: () => false,
}));
vi.mock("../../../../../../lib/organizer-module-settings", () => ({ isOrganizerRaceModuleSelected: async () => mocks.moduleSelected }));
vi.mock("../../../../../../lib/course-terrain/cache", () => ({ invalidateCourseTerrainCache: mocks.invalidate }));

const raceId = "11111111-1111-4111-8111-111111111111";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const STRANGER_ID = "00000000-0000-4000-8000-000000000002";

const terrainRow = (overrides: Record<string, unknown> = {}) => ({
  race_id: raceId,
  gpx_storage_path: "races/x/course-v2.gpx",
  gpx_sha256: "sha-2",
  status: "ready",
  attempts: 0,
  next_attempt_at: "2026-11-26T08:00:00+00:00",
  last_error: null,
  rules_version: 1,
  distance_km: 10,
  osm_segments: [
    { fromKm: 0, toKm: 4, class: "road", surface: "asphalt", source: "osm" },
    { fromKm: 4, toKm: 10, class: "trail", surface: null, source: "osm" },
  ],
  coverage: { matchedPct: 98, surfaceTagPct: 40, sacScaleTagPct: 10 },
  computed_at: "2026-11-26T08:10:00+00:00",
  organizer_overrides: [],
  overrides_gpx_sha256: null,
  overrides_updated_at: null,
  ...overrides,
});

let state: { race: Record<string, unknown> | null; gpx: { gpx_storage_path: string | null; gpx_sha256: string | null }; terrain: Record<string, unknown> | null; patches: unknown[]; inserts: unknown[] };

beforeEach(() => {
  // The Ravitos section is switched off: terrain corrections must still work.
  mocks.moduleSelected = false;
  mocks.invalidate.mockClear();
  state = {
    race: { id: raceId, event_id: "22222222-2222-4222-8222-222222222222", edition_id: "33333333-3333-4333-8333-333333333333", distance_km: 10 },
    gpx: { gpx_storage_path: "races/x/course-v2.gpx", gpx_sha256: "sha-2" },
    terrain: terrainRow(),
    patches: [],
    inserts: [],
  };
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/rest/v1/race_event_organizers?")) {
      return Response.json(url.includes(`user_id=eq.${USER_ID}`) ? [{ id: "44444444-4444-4444-8444-444444444444" }] : []);
    }
    if (url.includes("/rest/v1/races?") && url.includes("data_status")) return Response.json(state.race ? [state.race] : []);
    if (url.includes("/rest/v1/races?") && url.includes("select=gpx_storage_path,gpx_sha256")) return Response.json([state.gpx]);
    if (url.includes("/rest/v1/race_course_terrain")) {
      if (method === "PATCH") {
        if (!state.terrain) return Response.json([]);
        const patch = JSON.parse(String(init?.body));
        state.patches.push(patch);
        state.terrain = { ...state.terrain, ...patch };
        return Response.json([state.terrain]);
      }
      if (method === "POST") {
        const row = JSON.parse(String(init?.body));
        state.inserts.push(row);
        state.terrain = terrainRow({ status: "pending", osm_segments: null, coverage: null, distance_km: null, computed_at: null, rules_version: null, ...row });
        return Response.json([{ race_id: raceId }]);
      }
      return Response.json(state.terrain ? [state.terrain] : []);
    }
    if (url.includes("/storage/v1/object/race-gpx/")) {
      return new Response(
        `<gpx><trk><trkseg><trkpt lat="45" lon="6"></trkpt><trkpt lat="45.045" lon="6"></trkpt></trkseg></trk></gpx>`,
      );
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  });
});
afterEach(() => vi.restoreAllMocks());

const request = (method: "GET" | "PUT", token: string | null, body?: unknown, id = raceId) =>
  new NextRequest(`http://localhost/api/organizer/races/${id}/terrain`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("/api/organizer/races/[id]/terrain", () => {
  it("rejects missing sessions, other users and unknown races", async () => {
    expect((await GET(request("GET", null), { params: { id: raceId } })).status).toBe(401);
    expect((await GET(request("GET", "bad"), { params: { id: raceId } })).status).toBe(401);
    expect((await GET(request("GET", "stranger"), { params: { id: raceId } })).status).toBe(403);
    expect((await PUT(request("PUT", "stranger", { overrides: [] }), { params: { id: raceId } })).status).toBe(403);
    state.race = null;
    expect((await GET(request("GET", "organizer"), { params: { id: raceId } })).status).toBe(404);
    expect((await GET(request("GET", "organizer", undefined, "nope"), { params: { id: "nope" } })).status).toBe(400);
  });

  it("returns OSM segments, overrides and the runner-facing terrain", async () => {
    state.terrain = terrainRow({ organizer_overrides: [{ fromKm: 5, toKm: 6, class: "technical" }], overrides_gpx_sha256: "sha-1" });
    const response = await GET(request("GET", "organizer"), { params: { id: raceId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.osmSegments).toHaveLength(2);
    expect(body.overrides).toEqual([{ fromKm: 5, toKm: 6, class: "technical" }]);
    expect(body.overridesNeedReview).toBe(true);
    expect(body.terrain.status).toBe("ready");
    expect(body.terrain.hasOrganizerOverrides).toBe(true);
    expect(body.terrain.segments.map((s: { class: string }) => s.class)).toEqual(["road", "trail", "technical", "trail"]);
  });

  it("stores validated overrides with the current GPX hash and purges the public cache", async () => {
    const response = await PUT(request("PUT", "organizer", { overrides: [{ fromKm: 1.23456, toKm: 2, class: "track" }] }), { params: { id: raceId } });
    expect(response.status).toBe(200);
    expect(state.patches[0]).toMatchObject({
      organizer_overrides: [{ fromKm: 1.235, toKm: 2, class: "track" }],
      overrides_gpx_sha256: "sha-2",
      overrides_updated_by: USER_ID,
    });
    const body = await response.json();
    expect(body.overridesNeedReview).toBe(false);
    expect(body.terrain.summary.track.km).toBeCloseTo(0.765, 1);
    expect(mocks.invalidate).toHaveBeenCalledWith(raceId);
  });

  it("works while the terrain is still pending, measuring the GPX", async () => {
    state.terrain = null;
    const response = await PUT(request("PUT", "organizer", { overrides: [{ fromKm: 0, toKm: 5, class: "off_path" }] }), { params: { id: raceId } });
    expect(response.status).toBe(200);
    expect(state.inserts[0]).toMatchObject({ race_id: raceId, status: "pending", gpx_storage_path: "races/x/course-v2.gpx" });
    const body = await response.json();
    expect(body.terrain).toEqual({ status: "pending", raceId });
    expect(body.overrides).toEqual([{ fromKm: 0, toKm: 5, class: "off_path" }]);

    // The GPX measures ~5 km: 7 km is out of range.
    const tooFar = await PUT(request("PUT", "organizer", { overrides: [{ fromKm: 0, toKm: 7, class: "trail" }] }), { params: { id: raceId } });
    expect(tooFar.status).toBe(400);
  });

  it.each([
    [{ overrides: [{ fromKm: 3, toKm: 2, class: "trail" }] }],
    [{ overrides: [{ fromKm: 0, toKm: 2, class: "mud" }] }],
    [{ overrides: [{ fromKm: -1, toKm: 2, class: "trail" }] }],
    [{ overrides: [{ fromKm: 0, toKm: 11, class: "trail" }] }],
    [{ overrides: Array.from({ length: 201 }, () => ({ fromKm: 0, toKm: 1, class: "trail" })) }],
    [{ nope: true }],
  ])("rejects invalid overrides %#", async (body) => {
    const response = await PUT(request("PUT", "organizer", body), { params: { id: raceId } });
    expect(response.status).toBe(400);
    expect(state.patches).toEqual([]);
  });

  it("does not depend on the Ravitos section, like the GPX upload, but needs a GPX", async () => {
    mocks.moduleSelected = false;
    expect((await PUT(request("PUT", "organizer", { overrides: [] }), { params: { id: raceId } })).status).toBe(200);
    state.race = { ...state.race!, edition_id: null };
    expect((await PUT(request("PUT", "organizer", { overrides: [] }), { params: { id: raceId } })).status).toBe(200);
    state.gpx = { gpx_storage_path: null, gpx_sha256: null };
    expect((await PUT(request("PUT", "organizer", { overrides: [] }), { params: { id: raceId } })).status).toBe(409);
  });
});

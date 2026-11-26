import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));

const raceId = "11111111-1111-4111-8111-111111111111";
const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;
const lonAt = (eastM: number) => 6 + eastM / (M_PER_DEG * Math.cos(Math.PI / 4));
const gpx = `<gpx><trk><trkseg>${Array.from({ length: 21 }, (_, i) => `<trkpt lat="45" lon="${lonAt(i * 100).toFixed(7)}"></trkpt>`).join("")}</trkseg></trk></gpx>`;

let row: Record<string, unknown>;
const patches: Array<Record<string, unknown>> = [];

beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  patches.length = 0;
  row = {
    race_id: raceId,
    gpx_storage_path: "races/course-v1.gpx",
    gpx_sha256: "sha",
    status: "pending",
    attempts: 0,
    next_attempt_at: "2020-01-01T08:00:00+00:00",
    organizer_overrides: [],
  };
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.startsWith("https://db.example.com/rest/v1/race_course_terrain")) {
      if (method === "PATCH") {
        const patch = JSON.parse(String(init?.body));
        patches.push(patch);
        row = { ...row, ...patch };
        return Response.json([row]);
      }
      const due = row.status === "pending" || row.status === "processing";
      return Response.json(due && Date.parse(String(row.next_attempt_at)) <= Date.now() ? [row] : []);
    }
    if (url.startsWith("https://db.example.com/storage/v1/object/race-gpx/")) return new Response(gpx);
    if (url.includes("/api/interpreter")) {
      return Response.json({
        elements: [
          { type: "way", id: 1, tags: { highway: "track", tracktype: "grade2" }, geometry: [{ lat: 45, lon: lonAt(0) }, { lat: 45, lon: lonAt(2_000) }] },
        ],
      });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  });
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

const call = (authorization?: string) =>
  POST(new Request("http://localhost/api/cron/course-terrain", { method: "POST", headers: authorization ? { authorization } : {} }));

describe("/api/cron/course-terrain", () => {
  it("requires the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(GET).toBe(POST);
  });

  it("computes the due race from its GPX and Overpass", async () => {
    const response = await call("Bearer secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, processed: [{ raceId, outcome: "ready" }] });
    expect(row.status).toBe("ready");
    expect(row.osm_segments).toEqual([{ fromKm: 0, toKm: row.distance_km, class: "track", surface: null, source: "osm" }]);
    expect(row.coverage).toEqual({ matchedPct: 100, surfaceTagPct: 0, sacScaleTagPct: 0 });
    const overpassCall = vi.mocked(fetch).mock.calls.find((entry) => String(entry[0]).includes("/api/interpreter"))!;
    expect((overpassCall[1]?.headers as Record<string, string>)["User-Agent"]).toBe("PaceYourself/1.0 (+https://pace-yourself.com)");
    // After the lease, every write targets the GPX the job read.
    const terrainPatches = vi
      .mocked(fetch)
      .mock.calls.filter((entry) => entry[1]?.method === "PATCH")
      .map((entry) => String(entry[0]));
    expect(terrainPatches.length).toBeGreaterThan(1);
    expect(terrainPatches.slice(1).every((url) => url.includes("gpx_storage_path=eq.races%2Fcourse-v1.gpx"))).toBe(true);
  });

  it("does nothing when no race is due", async () => {
    row.status = "ready";
    const response = await call("Bearer secret");
    expect(await response.json()).toEqual({ ok: true, processed: [] });
    expect(patches).toEqual([]);
  });
});

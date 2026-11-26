import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));

const raceId = "11111111-1111-4111-8111-111111111111";

const raceRow = (overrides: Record<string, unknown> = {}) => ({
  id: raceId,
  event_id: "22222222-2222-4222-8222-222222222222",
  edition_id: "33333333-3333-4333-8333-333333333333",
  gpx_storage_path: "races/course-v1.gpx",
  is_public: true,
  is_live: true,
  racebook_preview_is_visible: false,
  race_events: { is_live: true },
  ...overrides,
});

const terrainRow = (overrides: Record<string, unknown> = {}) => ({
  race_id: raceId,
  gpx_storage_path: "races/course-v1.gpx",
  gpx_sha256: "sha",
  status: "ready",
  attempts: 0,
  next_attempt_at: "2026-11-26T08:00:00+00:00",
  rules_version: 1,
  distance_km: 20,
  osm_segments: [
    { fromKm: 0, toKm: 5, class: "road", surface: "asphalt", source: "osm" },
    { fromKm: 5, toKm: 20, class: "trail", surface: "ground", source: "osm" },
  ],
  coverage: { matchedPct: 97, surfaceTagPct: 50, sacScaleTagPct: 20 },
  computed_at: "2026-11-26T08:10:00+00:00",
  organizer_overrides: [{ fromKm: 18, toKm: 20, class: "technical" }],
  overrides_gpx_sha256: "sha",
  overrides_updated_at: "2026-11-26T08:20:00+00:00",
  ...overrides,
});

type Routes = { race?: unknown[]; terrain?: unknown[]; edition?: unknown[] };

function mockFetch(routes: Routes) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/rest/v1/races?")) return Response.json(routes.race ?? [raceRow()]);
    if (url.includes("/rest/v1/race_course_terrain?")) return Response.json(routes.terrain ?? [terrainRow()]);
    if (url.includes("/rest/v1/race_event_editions?")) return Response.json(routes.edition ?? [{ is_visible: true }]);
    throw new Error(`Unexpected fetch ${url}`);
  });
}

let ip = 0;
const call = (id = raceId) =>
  GET(new NextRequest(`http://localhost/api/race-terrain?raceId=${id}`, { headers: { "x-forwarded-for": `198.51.100.${++ip}` } }));

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("GET /api/race-terrain", () => {
  it("returns ready terrain with overrides applied, CDN-cached under a race tag", async () => {
    mockFetch({});
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    expect(response.headers.get("Vercel-Cache-Tag")).toBe(`course-terrain:race:${raceId}`);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ready",
      raceId,
      distanceKm: 20,
      hasOrganizerOverrides: true,
      rulesVersion: 1,
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    });
    expect(body.segments.map((s: { class: string; source: string }) => [s.class, s.source])).toEqual([
      ["road", "osm"],
      ["trail", "osm"],
      ["technical", "organizer"],
    ]);
    expect(body.summary.technical).toEqual({ km: 2, pct: 10 });
    expect(body).not.toHaveProperty("progress");
  });

  it("answers pending while computing or when the row is not created yet", async () => {
    mockFetch({ terrain: [terrainRow({ status: "processing", osm_segments: null })] });
    const processing = await call();
    expect(await processing.json()).toEqual({ status: "pending", raceId });
    expect(processing.headers.get("Cache-Control")).toBe("public, s-maxage=60");

    vi.restoreAllMocks();
    mockFetch({ terrain: [] });
    expect(await (await call()).json()).toEqual({ status: "pending", raceId });
  });

  it("is unavailable without GPX or after a failure", async () => {
    mockFetch({ race: [raceRow({ gpx_storage_path: null })], terrain: [] });
    expect(await (await call()).json()).toEqual({ status: "unavailable", raceId, reason: "no_route" });
    vi.restoreAllMocks();
    mockFetch({ terrain: [terrainRow({ status: "failed" })] });
    expect(await (await call()).json()).toEqual({ status: "unavailable", raceId, reason: "failed" });
  });

  it("hides races that are not runner-visible, like /api/race-weather", async () => {
    mockFetch({ race: [raceRow({ is_public: false })] });
    expect((await call()).status).toBe(404);
    vi.restoreAllMocks();
    mockFetch({ race: [raceRow({ is_live: false, racebook_preview_is_visible: true })], edition: [{ is_visible: false }] });
    expect((await call()).status).toBe(404);
    vi.restoreAllMocks();
    mockFetch({ race: [raceRow({ is_live: false, racebook_preview_is_visible: true })] });
    expect((await call()).status).toBe(200);
    vi.restoreAllMocks();
    mockFetch({ race: [] });
    expect((await call()).status).toBe(404);
  });

  it("validates the race id and rate limits per client", async () => {
    mockFetch({});
    expect((await call("nope")).status).toBe(400);
    const fixed = () =>
      GET(new NextRequest(`http://localhost/api/race-terrain?raceId=${raceId}`, { headers: { "x-forwarded-for": "203.0.113.77" } }));
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await fixed()).status;
    expect(last).toBe(429);
  });
});

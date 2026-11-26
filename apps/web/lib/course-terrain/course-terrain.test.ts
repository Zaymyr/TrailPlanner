import { describe, expect, it, vi } from "vitest";

import { COURSE_TERRAIN_RULES_VERSION, classifyOsmWay } from "./classify";
import { buildTrackChunks, padBbox, resampleTrack, type TrackPoint } from "./geometry";
import {
  COURSE_TERRAIN_LEASE_MS,
  COURSE_TERRAIN_MAX_ATTEMPTS,
  processCourseTerrainRow,
  retryDelayMs,
  runCourseTerrainTick,
  type CourseTerrainJobDeps,
} from "./job";
import { matchSamples, type OsmWay } from "./matching";
import { buildOverpassQuery, fetchOverpassWays, OverpassError, parseOverpassWays, OVERPASS_USER_AGENT } from "./overpass";
import { buildTerrainSegments, computeTerrainCoverage, decodeMatches, encodeMatches } from "./segments";
import type { CourseTerrainRow, CourseTerrainRowPatch, CourseTerrainStore } from "./store";

// ---------- synthetic geometry: a straight course heading east at 45°N ----------
const LAT0 = 45;
const LON0 = 6;
const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;
const at = (eastM: number, northM = 0) => ({
  lat: LAT0 + northM / M_PER_DEG,
  lon: LON0 + eastM / (M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)),
});
const line = (fromM: number, toM: number, northM = 0, stepM = 50) => {
  const nodes = [];
  for (let x = fromM; x < toM; x += stepM) nodes.push(at(x, northM));
  nodes.push(at(toM, northM));
  return nodes;
};
const way = (id: number, tags: Record<string, string>, geometry: Array<{ lat: number; lon: number }>): OsmWay => ({ id, tags, geometry });
const track = (lengthM: number): TrackPoint[] =>
  Array.from({ length: Math.round(lengthM / 100) + 1 }, (_, index) => {
    const point = at(index * 100);
    return { lat: point.lat, lng: point.lon, distKmCum: (index * 100) / 1000 };
  });
const gpxXml = (lengthM: number) =>
  `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><trkseg>${track(lengthM)
    .map((point) => `<trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}"><ele>500</ele></trkpt>`)
    .join("")}</trkseg></trk></gpx>`;

describe("classifyOsmWay", () => {
  it.each([
    [{ highway: "path", sac_scale: "demanding_mountain_hiking" }, "technical"],
    [{ highway: "path", surface: "scree" }, "technical"],
    [{ highway: "path", trail_visibility: "bad" }, "technical"],
    [{ highway: "path", sac_scale: "mountain_hiking" }, "trail"],
    [{ highway: "path", sac_scale: "alpine_hiking", surface: "asphalt" }, "road"],
    [{ highway: "residential" }, "road"],
    [{ highway: "footway", surface: "paving_stones" }, "road"],
    [{ highway: "track", tracktype: "grade2" }, "track"],
    [{ highway: "track" }, "track"],
    [{ highway: "track", tracktype: "grade5" }, "trail"],
    [{ highway: "unclassified", surface: "gravel" }, "track"],
    [{ highway: "bridleway" }, "trail"],
    [{}, "trail"],
  ])("%j -> %s", (tags, expected) => {
    expect(classifyOsmWay(tags)).toBe(expected);
  });

  it("does not treat smoothness or slope as technical", () => {
    expect(classifyOsmWay({ highway: "path", smoothness: "horrible" })).toBe("trail");
    expect(COURSE_TERRAIN_RULES_VERSION).toBe(1);
  });
});

describe("geometry", () => {
  it("resamples every 25 m on the cumulative distance", () => {
    const samples = resampleTrack(track(1_000));
    expect(samples).toHaveLength(41);
    expect(samples[4]!.distM).toBe(100);
    expect(samples[4]!.lon).toBeCloseTo(at(100).lon, 9);
  });

  it("cuts chunks of at most 3.5 km side, contiguous and deterministic", () => {
    const samples = resampleTrack(track(10_000));
    const chunks = buildTrackChunks(samples);
    expect(chunks.length).toBe(3);
    expect(chunks[0]!.start).toBe(0);
    chunks.slice(1).forEach((chunk, index) => expect(chunk.start).toBe(chunks[index]!.end));
    expect(chunks.at(-1)!.end).toBe(samples.length);
    expect(buildTrackChunks(samples)).toEqual(chunks);
    const padded = padBbox(chunks[0]!.bbox);
    expect((chunks[0]!.bbox.south - padded.south) * M_PER_DEG).toBeCloseTo(100, 3);
  });
});

describe("matchSamples", () => {
  const samples = resampleTrack(track(3_500));
  const ways = [
    way(1, { highway: "path" }, line(0, 1_500, 8)),
    // parallel road closer to the GPX: continuity keeps the path
    way(2, { highway: "residential" }, line(500, 800, -2)),
    // crossing road
    way(3, { highway: "primary" }, [at(1_000, -200), at(1_000, 200)]),
    way(4, { highway: "track", surface: "gravel" }, line(1_500, 3_000)),
  ];

  it("keeps the previous way within the continuity bonus and leaves unmapped samples off_path", () => {
    const { matches, lastWayId } = matchSamples(samples, ways);
    const classAt = (m: number) => matches[m / 25]!.class;
    expect(classAt(100)).toBe("trail");
    expect(classAt(650)).toBe("trail");
    expect(classAt(1_000)).toBe("trail");
    expect(classAt(2_000)).toBe("track");
    expect(matches[2_000 / 25]!.surface).toBe("gravel");
    expect(classAt(3_300)).toBe("off_path");
    expect(lastWayId).toBe(4);
  });

  it("carries continuity across chunks", () => {
    const sub = samples.slice(26, 30); // 650-725 m, between the path and the parallel road
    expect(matchSamples(sub, ways, null).matches[0]!.class).toBe("road");
    expect(matchSamples(sub, ways, 1).matches[0]!.class).toBe("trail");
  });
});

describe("segments and coverage", () => {
  const m = (terrainClass: "road" | "trail" | "off_path", count: number, surface: string | null = null, sac = false) =>
    Array.from({ length: count }, () => ({ class: terrainClass, surface, hasSurfaceTag: Boolean(surface), hasSacScaleTag: sac }));

  it("absorbs runs shorter than 200 m into the longer neighbour and stays contiguous", () => {
    const matches = [...m("trail", 40, "ground"), ...m("road", 4, "asphalt"), ...m("trail", 20), ...m("off_path", 30)];
    const segments = buildTerrainSegments(matches, 2.31);
    expect(segments).toEqual([
      { fromKm: 0, toKm: 1.6, class: "trail", surface: "ground", source: "osm" },
      { fromKm: 1.6, toKm: 2.31, class: "off_path", surface: null, source: "osm" },
    ]);
  });

  it("keeps a single short course as one segment", () => {
    expect(buildTerrainSegments(m("road", 3), 0.07)).toEqual([{ fromKm: 0, toKm: 0.07, class: "road", surface: null, source: "osm" }]);
  });

  it("computes coverage on samples", () => {
    expect(computeTerrainCoverage([...m("trail", 2, "ground", true), ...m("road", 1), ...m("off_path", 1)])).toEqual({
      matchedPct: 75,
      surfaceTagPct: 50,
      sacScaleTagPct: 50,
    });
  });

  it("round-trips the compact run encoding", () => {
    const matches = [...m("trail", 3, "ground", true), ...m("road", 2, "asphalt"), ...m("off_path", 1)];
    const encoded = encodeMatches(matches);
    expect(encoded).toEqual([[3, "trail", "ground", 3], [2, "road", "asphalt", 1], [1, "off_path", null, 0]]);
    expect(decodeMatches(encoded)).toEqual(matches);
  });
});

describe("overpass client", () => {
  const bbox = { south: 45, west: 6, north: 45.01, east: 6.01 };

  it("asks the server for less time than the client waits and identifies itself", async () => {
    expect(buildOverpassQuery(bbox)).toContain("[timeout:25]");
    const fetchImpl = vi.fn(async () => Response.json({ elements: [{ type: "way", id: 7, tags: { highway: "path" }, geometry: [at(0), at(10)] }] }));
    const ways = await fetchOverpassWays(bbox, { fetchImpl, deadline: Date.now() + 120_000, sleep: async () => {} });
    expect(ways).toHaveLength(1);
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(OVERPASS_USER_AGENT);
  });

  it("treats a 200 with a runtime remark as a failure and switches endpoint", async () => {
    expect(() => parseOverpassWays({ elements: [], remark: "runtime error: Query timed out in \"query\"" })).toThrow(OverpassError);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ elements: [], remark: "runtime error: out of memory" }))
      .mockResolvedValueOnce(new Response("busy", { status: 504 }))
      .mockResolvedValueOnce(Response.json({ elements: [] }));
    const ways = await fetchOverpassWays(bbox, { fetchImpl, deadline: Date.now() + 120_000, sleep: async () => {} });
    expect(ways).toEqual([]);
    expect(fetchImpl.mock.calls.map((call) => new URL(call[0] as string).host)).toEqual([
      "overpass-api.de",
      "overpass.kumi.systems",
      "overpass-api.de",
    ]);
  });

  it("never starts a request that could outlive the deadline", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchOverpassWays(bbox, { fetchImpl, deadline: Date.now() + 10_000, sleep: async () => {} })).rejects.toThrow(OverpassError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ---------- resumable job with an in-memory store ----------
const RACE_ID = "11111111-1111-4111-8111-111111111111";

const baseRow = (overrides: Partial<CourseTerrainRow> = {}): CourseTerrainRow => ({
  race_id: RACE_ID,
  gpx_storage_path: "races/a/course-v1.gpx",
  gpx_sha256: "sha-1",
  status: "pending",
  attempts: 0,
  next_attempt_at: "2026-11-26T08:00:00.000Z",
  last_error: null,
  rules_version: null,
  distance_km: null,
  osm_segments: null,
  coverage: null,
  computed_at: null,
  progress: null,
  organizer_overrides: [],
  overrides_gpx_sha256: null,
  overrides_updated_at: null,
  ...overrides,
});

function memoryStore(initial: CourseTerrainRow) {
  let row: CourseTerrainRow = initial;
  const patches: CourseTerrainRowPatch[] = [];
  const store: CourseTerrainStore = {
    getRow: async () => row,
    findDueRow: async (nowIso) =>
      Date.parse(row.next_attempt_at) <= Date.parse(nowIso) &&
      (row.status === "pending" || row.status === "processing" || (row.status === "ready" && (row.rules_version ?? 0) < COURSE_TERRAIN_RULES_VERSION))
        ? row
        : null,
    claimRow: async (due, lease) => {
      if (due.next_attempt_at !== row.next_attempt_at) return null;
      row = { ...row, next_attempt_at: lease };
      return row;
    },
    updateRow: async (_raceId, path, patch) => {
      if (row.gpx_storage_path !== path) return false;
      patches.push(JSON.parse(JSON.stringify(patch)));
      row = { ...row, ...(JSON.parse(JSON.stringify(patch)) as Partial<CourseTerrainRow>) };
      return true;
    },
    insertRow: async () => false,
    updateOverrides: async () => row,
  };
  return { store, patches, get row() { return row; }, set row(value: CourseTerrainRow) { row = value; } };
}

function deps(store: CourseTerrainStore, clock: { t: number }, fetchWays: CourseTerrainJobDeps["fetchWays"]): CourseTerrainJobDeps {
  return {
    store,
    loadGpx: async () => gpxXml(10_000),
    fetchWays,
    now: () => clock.t,
    sleep: async (ms) => {
      clock.t += ms;
    },
    onReady: vi.fn(async () => {}),
  };
}

const allWays = [way(1, { highway: "path", sac_scale: "hiking" }, line(0, 6_000, 3)), way(2, { highway: "residential" }, line(6_000, 10_000, 3))];

describe("course terrain job", () => {
  it("computes a whole course in one tick when the budget allows", async () => {
    const memory = memoryStore(baseRow());
    const clock = { t: Date.parse("2026-11-26T09:00:00Z") };
    const job = deps(memory.store, clock, async () => allWays);
    const result = await runCourseTerrainTick(job);
    expect(result.processed).toEqual([{ raceId: RACE_ID, outcome: "ready" }]);
    expect(memory.row.status).toBe("ready");
    expect(memory.row.progress).toBeNull();
    expect(memory.row.distance_km).toBeCloseTo(10, 2);
    const segments = memory.row.osm_segments!;
    expect(segments.map((s) => s.class)).toEqual(["trail", "road"]);
    expect(segments[0]!.fromKm).toBe(0);
    expect(segments[0]!.toKm).toBeCloseTo(6, 1);
    expect(segments[1]!.fromKm).toBe(segments[0]!.toKm);
    expect(segments[1]!.toKm).toBe(memory.row.distance_km);
    expect(memory.row.coverage!.matchedPct).toBe(100);
    expect(memory.row.coverage!.surfaceTagPct).toBe(0);
    expect(memory.row.coverage!.sacScaleTagPct).toBeCloseTo(60, 0);
    expect(job.onReady).toHaveBeenCalledWith(RACE_ID);
  });

  it("persists chunk progress when out of budget and resumes on the next tick with the same result", async () => {
    const single = memoryStore(baseRow());
    await runCourseTerrainTick(deps(single.store, { t: Date.parse("2026-11-26T09:00:00Z") }, async () => allWays));

    const memory = memoryStore(baseRow());
    const clock = { t: Date.parse("2026-11-26T09:00:00Z") };
    // Each Overpass call takes 100 s: only one chunk fits a 240 s tick.
    const slow: CourseTerrainJobDeps["fetchWays"] = async () => {
      clock.t += 100_000;
      return allWays;
    };
    const first = await runCourseTerrainTick(deps(memory.store, clock, slow));
    expect(first.processed).toEqual([{ raceId: RACE_ID, outcome: "in_progress" }]);
    expect(memory.row.status).toBe("processing");
    expect((memory.row.progress as { nextChunk: number }).nextChunk).toBeGreaterThan(0);
    expect(Date.parse(memory.row.next_attempt_at)).toBeLessThanOrEqual(clock.t);

    let ticks = 1;
    while (memory.row.status !== "ready" && ticks < 10) {
      clock.t += 600_000;
      await runCourseTerrainTick(deps(memory.store, clock, slow));
      ticks++;
    }
    expect(ticks).toBeGreaterThan(1);
    expect(memory.row.osm_segments).toEqual(single.row.osm_segments);
    expect(memory.row.coverage).toEqual(single.row.coverage);
  });

  it("discards progress computed for another GPX", async () => {
    const memory = memoryStore(baseRow({ status: "processing", progress: { v: 1, path: "races/a/old.gpx", nextChunk: 2, runs: [] } }));
    const fetchWays = vi.fn(async () => allWays);
    await runCourseTerrainTick(deps(memory.store, { t: Date.parse("2026-11-26T09:00:00Z") }, fetchWays));
    expect(memory.row.status).toBe("ready");
    expect(fetchWays).toHaveBeenCalledTimes(3);
  });

  it("backs off on Overpass failures and fails after 5 attempts with the last error", async () => {
    const memory = memoryStore(baseRow());
    const clock = { t: Date.parse("2026-11-26T09:00:00Z") };
    const failing = async () => {
      throw new OverpassError("overpass-api.de HTTP 504");
    };
    for (let attempt = 1; attempt <= COURSE_TERRAIN_MAX_ATTEMPTS; attempt++) {
      await runCourseTerrainTick(deps(memory.store, clock, failing));
      expect(memory.row.attempts).toBe(attempt);
      expect(memory.row.last_error).toBe("overpass-api.de HTTP 504");
      if (attempt < COURSE_TERRAIN_MAX_ATTEMPTS) {
        expect(Date.parse(memory.row.next_attempt_at) - clock.t).toBe(retryDelayMs(attempt));
        clock.t = Date.parse(memory.row.next_attempt_at);
      }
    }
    expect(memory.row.status).toBe("failed");
  });

  it("fails at once on an invalid GPX and marks a removed GPX as no_route", async () => {
    const memory = memoryStore(baseRow());
    const job = { ...deps(memory.store, { t: Date.parse("2026-11-26T09:00:00Z") }, async () => allWays), loadGpx: async () => "not a gpx" };
    expect(await processCourseTerrainRow(memory.row, job, Date.now() + 240_000)).toBe("failed");
    expect(memory.row.status).toBe("failed");

    const removed = memoryStore(baseRow({ gpx_storage_path: null }));
    expect(await processCourseTerrainRow(removed.row, deps(removed.store, { t: 0 }, async () => []), 240_000)).toBe("no_route");
    expect(removed.row.status).toBe("no_route");
  });

  it("stops writing when the GPX changed during the run", async () => {
    const memory = memoryStore(baseRow());
    const clock = { t: Date.parse("2026-11-26T09:00:00Z") };
    const fetchWays = async () => {
      memory.row = { ...memory.row, gpx_storage_path: "races/a/course-v2.gpx", status: "pending", progress: null };
      return allWays;
    };
    const result = await runCourseTerrainTick(deps(memory.store, clock, fetchWays));
    expect(result.processed[0]!.outcome).toBe("superseded");
    expect(memory.row.status).toBe("pending");
    expect(memory.row.progress).toBeNull();
  });

  it("does not pick a row leased by another tick", async () => {
    const memory = memoryStore(baseRow({ status: "processing", next_attempt_at: new Date(Date.parse("2026-11-26T09:00:00Z") + COURSE_TERRAIN_LEASE_MS).toISOString() }));
    const fetchWays = vi.fn(async () => allWays);
    const result = await runCourseTerrainTick(deps(memory.store, { t: Date.parse("2026-11-26T09:00:00Z") }, fetchWays));
    expect(result.processed).toEqual([]);
    expect(fetchWays).not.toHaveBeenCalled();
  });
});

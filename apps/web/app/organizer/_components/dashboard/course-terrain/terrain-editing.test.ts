import { describe, expect, it } from "vitest";
import { COURSE_TERRAIN_MAX_OVERRIDES, type CourseTerrainSegment, type OrganizerCourseTerrain } from "@trailplanner/shared";
import {
  TerrainEditError,
  addRangeOverride,
  canonicalizeOverrides,
  changeSegmentClass,
  previewTerrain,
  revertOverrideRange,
  selectTerrainViewState,
  splitSegment,
  validateOverrides,
} from "./terrain-editing";

const osm: CourseTerrainSegment[] = [
  { fromKm: 0, toKm: 4, class: "road", surface: "asphalt", source: "osm" },
  { fromKm: 4, toKm: 10, class: "trail", surface: null, source: "osm" },
];
const base = { osmSegments: osm, overrides: [], distanceKm: 10 };

describe("terrain override editing", () => {
  it("changes the class of a whole segment", () => {
    const next = changeSegmentClass(base, osm[1], "technical");
    expect(next).toEqual([{ fromKm: 4, toKm: 10, class: "technical" }]);
  });

  it("drops a correction that restates OpenStreetMap", () => {
    expect(changeSegmentClass(base, osm[1], "trail")).toEqual([]);
  });

  it("splits a segment: the part after the split takes the new class", () => {
    const next = splitSegment(base, osm[1], 7, "technical");
    expect(next).toEqual([{ fromKm: 7, toKm: 10, class: "technical" }]);
    const { segments } = previewTerrain(osm, next, 10);
    expect(segments.map((s) => [s.fromKm, s.toKm, s.class, s.source])).toEqual([
      [0, 4, "road", "osm"],
      [4, 7, "trail", "osm"],
      [7, 10, "technical", "organizer"],
    ]);
  });

  it("rejects a split outside the segment", () => {
    expect(() => splitSegment(base, osm[1], 4, "road")).toThrow(TerrainEditError);
    expect(() => splitSegment(base, osm[1], 11, "road")).toThrow(TerrainEditError);
  });

  it("adds a range override across segments and lets later ranges win", () => {
    const first = addRangeOverride(base, 3, 6, "track");
    expect(first).toEqual([{ fromKm: 3, toKm: 6, class: "track" }]);
    const second = addRangeOverride({ ...base, overrides: first }, 5, 8, "off_path");
    expect(second).toEqual([
      { fromKm: 3, toKm: 5, class: "track" },
      { fromKm: 5, toKm: 8, class: "off_path" },
    ]);
  });

  it("reverts an override range and keeps the rest", () => {
    const overrides = [{ fromKm: 2, toKm: 8, class: "technical" as const }];
    const next = revertOverrideRange({ ...base, overrides }, 4, 6);
    expect(next).toEqual([
      { fromKm: 2, toKm: 4, class: "technical" },
      { fromKm: 6, toKm: 8, class: "technical" },
    ]);
    expect(revertOverrideRange({ ...base, overrides }, 0, 10)).toEqual([]);
  });

  it("computes the preview summary with overrides applied", () => {
    const { summary } = previewTerrain(osm, [{ fromKm: 4, toKm: 6, class: "technical" }], 10);
    expect(summary.technical).toEqual({ km: 2, pct: 20 });
    expect(summary.trail).toEqual({ km: 4, pct: 40 });
    expect(summary.road).toEqual({ km: 4, pct: 40 });
  });

  it("canonicalizes overlapping overrides", () => {
    const next = canonicalizeOverrides(
      osm,
      [
        { fromKm: 5, toKm: 8, class: "technical" },
        { fromKm: 6, toKm: 9, class: "technical" },
      ],
      10,
    );
    expect(next).toEqual([{ fromKm: 5, toKm: 9, class: "technical" }]);
  });
});

describe("terrain override validation", () => {
  it("accepts valid overrides", () => {
    expect(validateOverrides([{ fromKm: 0, toKm: 10, class: "road" }], 10).ok).toBe(true);
  });

  it("rejects out-of-bounds and inverted ranges", () => {
    expect(validateOverrides([{ fromKm: -1, toKm: 3, class: "road" }], 10).ok).toBe(false);
    expect(validateOverrides([{ fromKm: 2, toKm: 10.5, class: "road" }], 10).ok).toBe(false);
    expect(validateOverrides([{ fromKm: 5, toKm: 5, class: "road" }], 10).ok).toBe(false);
    expect(validateOverrides([{ fromKm: 6, toKm: 5, class: "road" }], 10).ok).toBe(false);
    expect(validateOverrides([{ fromKm: Number.NaN, toKm: 5, class: "road" }], 10).ok).toBe(false);
  });

  it("rejects an unknown class", () => {
    expect(validateOverrides([{ fromKm: 1, toKm: 2, class: "sand" as never }], 10).ok).toBe(false);
  });

  it("rejects more than the maximum number of overrides", () => {
    const many = Array.from({ length: COURSE_TERRAIN_MAX_OVERRIDES + 1 }, (_, index) => ({ fromKm: index * 0.01, toKm: index * 0.01 + 0.005, class: "track" as const }));
    expect(validateOverrides(many, 10).ok).toBe(false);
  });

  it("refuses edits outside the course", () => {
    expect(() => addRangeOverride(base, 8, 12, "track")).toThrow(TerrainEditError);
    expect(() => addRangeOverride(base, 5, 5, "track")).toThrow(TerrainEditError);
  });
});

describe("terrain view state selection", () => {
  const ready = { terrain: { status: "ready" }, osmSegments: [], overrides: [], overridesNeedReview: false } as unknown as OrganizerCourseTerrain;
  const wrap = (terrain: OrganizerCourseTerrain["terrain"]): OrganizerCourseTerrain => ({ ...ready, terrain });

  it("maps loading and error without data", () => {
    expect(selectTerrainViewState(null, "loading")).toBe("loading");
    expect(selectTerrainViewState(null, "error")).toBe("error");
  });

  it("maps every terrain status", () => {
    expect(selectTerrainViewState(wrap({ status: "pending", raceId: "r" }), "idle")).toBe("pending");
    expect(selectTerrainViewState(wrap({ status: "unavailable", raceId: "r", reason: "no_route" }), "idle")).toBe("no_route");
    expect(selectTerrainViewState(wrap({ status: "unavailable", raceId: "r", reason: "failed" }), "idle")).toBe("failed");
    expect(selectTerrainViewState(ready, "idle")).toBe("ready");
  });
});

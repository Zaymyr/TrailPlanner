import { describe, expect, it } from "vitest";
import {
  COURSE_TERRAIN_ATTRIBUTION,
  COURSE_TERRAIN_ATTRIBUTION_URL,
  COURSE_TERRAIN_CLASS_COLORS,
  summarizeCourseTerrain,
  type CourseTerrain,
  type CourseTerrainSegment,
} from "@trailplanner/shared";

import { courseTerrainCopy } from "./copy";
import {
  buildCourseTerrainBandRects,
  buildCourseTerrainChips,
  courseTerrainSegmentTitle,
  courseTerrainSurfaceLabel,
  selectCourseTerrainView,
} from "./course-terrain-model";

const seg = (fromKm: number, toKm: number, terrainClass: CourseTerrainSegment["class"], surface: string | null = null): CourseTerrainSegment => ({
  fromKm,
  toKm,
  class: terrainClass,
  surface,
  source: "osm",
});

const segments = [seg(0, 10, "trail"), seg(10, 15, "off_path"), seg(15, 20, "road", "asphalt")];

const ready = (overrides: Partial<CourseTerrain> = {}): CourseTerrain => ({
  status: "ready",
  raceId: "race-1",
  distanceKm: 20,
  segments,
  summary: summarizeCourseTerrain(segments, 20),
  coverage: { matchedPct: 80, surfaceTagPct: 20, sacScaleTagPct: 0 },
  hasOrganizerOverrides: false,
  computedAt: "2026-11-25T00:00:00Z",
  rulesVersion: 1,
  attribution: COURSE_TERRAIN_ATTRIBUTION,
  attributionUrl: COURSE_TERRAIN_ATTRIBUTION_URL,
  ...overrides,
});

describe("buildCourseTerrainBandRects", () => {
  it("maps segments to percent positions of the axis with contract colors", () => {
    const rects = buildCourseTerrainBandRects(segments, 20, 20);
    expect(rects.map((r) => [r.leftPct, r.widthPct])).toEqual([
      [0, 50],
      [50, 25],
      [75, 25],
    ]);
    expect(rects[0]?.color).toBe(COURSE_TERRAIN_CLASS_COLORS.trail);
  });

  it("hatches only off_path", () => {
    expect(buildCourseTerrainBandRects(segments, 20, 20).map((r) => r.hatched)).toEqual([false, true, false]);
  });

  it("rescales GPX distance to the chart axis (km shown in the tooltip follow the axis)", () => {
    const rects = buildCourseTerrainBandRects(segments, 20, 40);
    expect(rects[1]).toMatchObject({ leftPct: 50, widthPct: 25, fromKm: 20, toKm: 30 });
  });

  it("clips segments beyond the axis and drops empty ones", () => {
    const rects = buildCourseTerrainBandRects([seg(0, 12, "trail"), seg(12, 30, "road"), seg(25, 30, "track")], 20, 20);
    expect(rects).toHaveLength(2);
    expect(rects[1]).toMatchObject({ leftPct: 60, widthPct: 40, toKm: 20 });
    expect(buildCourseTerrainBandRects([seg(5, 5, "trail")], 20, 20)).toEqual([]);
    expect(buildCourseTerrainBandRects(segments, 20, 0)).toEqual([]);
  });
});

describe("surface and tooltip labels", () => {
  it("translates common surfaces and hides unknown ones", () => {
    expect(courseTerrainSurfaceLabel("rock", "fr")).toBe("roche");
    expect(courseTerrainSurfaceLabel("Gravel", "en")).toBe("gravel");
    expect(courseTerrainSurfaceLabel("weird_tag", "fr")).toBeNull();
    expect(courseTerrainSurfaceLabel(null, "fr")).toBeNull();
  });

  it("builds the French tooltip with decimal comma and optional surface", () => {
    expect(courseTerrainSegmentTitle({ class: "trail", fromKm: 12.3, toKm: 14.8, surface: "rock" }, "fr")).toBe(
      "Sentier · km 12,3 → 14,8 · surface : roche",
    );
    expect(courseTerrainSegmentTitle({ class: "track", fromKm: 1, toKm: 2, surface: "weird_tag" }, "fr")).toBe("Piste · km 1,0 → 2,0");
  });

  it("explains off_path in its tooltip", () => {
    const title = courseTerrainSegmentTitle({ class: "off_path", fromKm: 3, toKm: 4, surface: null }, "fr");
    expect(title).toContain("Hors chemin");
    expect(title).toContain(courseTerrainCopy.fr.offPathHint);
  });
});

describe("buildCourseTerrainChips", () => {
  it("lists classes by decreasing share and skips 0 %", () => {
    const chips = buildCourseTerrainChips(summarizeCourseTerrain(segments, 20), "fr");
    expect(chips.map((c) => c.label)).toEqual(["50 % sentier", "25 % route", "25 % hors chemin"]);
    expect(chips.find((c) => c.class === "off_path")?.hatched).toBe(true);
  });

  it("skips classes that round to 0 %", () => {
    const tiny = [seg(0, 99.8, "trail"), seg(99.8, 100, "road")];
    expect(buildCourseTerrainChips(summarizeCourseTerrain(tiny, 100), "en").map((c) => c.class)).toEqual(["trail"]);
  });
});

describe("selectCourseTerrainView", () => {
  it("selects pending, ready and none states", () => {
    expect(selectCourseTerrainView({ status: "ready", data: { status: "pending", raceId: "r" } })).toEqual({ kind: "pending" });
    expect(selectCourseTerrainView({ status: "ready", data: ready() }).kind).toBe("ready");
    expect(selectCourseTerrainView({ status: "ready", data: { status: "unavailable", raceId: "r", reason: "no_route" } })).toEqual({ kind: "none" });
    expect(selectCourseTerrainView({ status: "ready", data: ready({ segments: [] }) })).toEqual({ kind: "none" });
    expect(selectCourseTerrainView({ status: "loading", data: null })).toEqual({ kind: "none" });
    expect(selectCourseTerrainView({ status: "error", data: null })).toEqual({ kind: "none" });
  });
});

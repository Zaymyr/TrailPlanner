// Per-sample matches -> merged terrain segments, coverage, and the compact run encoding stored as
// resumable progress between cron ticks.

import {
  isCourseTerrainClass,
  type CourseTerrainClass,
  type CourseTerrainCoverage,
  type CourseTerrainSegment,
} from "@trailplanner/shared";

import { COURSE_TERRAIN_SAMPLE_STEP_M } from "./geometry";
import type { SampleMatch } from "./matching";

/** Runs shorter than this are absorbed into their longer neighbour. */
export const COURSE_TERRAIN_MIN_SEGMENT_M = 200;

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

type Run = { class: CourseTerrainClass; start: number; count: number; surfaces: Map<string, number> };

const addSurfaces = (target: Map<string, number>, source: Map<string, number>) => {
  for (const [surface, count] of source) target.set(surface, (target.get(surface) ?? 0) + count);
};

const mostFrequent = (surfaces: Map<string, number>): string | null => {
  let best: string | null = null;
  let bestCount = 0;
  for (const [surface, count] of surfaces) {
    if (count > bestCount) {
      best = surface;
      bestCount = count;
    }
  }
  return best;
};

/** Merges `runs[index]` into the previous run when both share a class (in place). */
const mergeWithPrevious = (runs: Run[], index: number) => {
  const previous = runs[index - 1];
  const run = runs[index];
  if (!previous || !run || previous.class !== run.class) return false;
  previous.count += run.count;
  addSurfaces(previous.surfaces, run.surfaces);
  runs.splice(index, 1);
  return true;
};

/**
 * Consecutive samples of one class become a run; runs shorter than 200 m are absorbed into the
 * longer neighbour (left on ties) and equal neighbours merge, until stable. Segments are
 * contiguous from 0 to `distanceKm`, `source: 'osm'`, with the most frequent OSM surface.
 */
export function buildTerrainSegments(
  matches: SampleMatch[],
  distanceKm: number,
  stepM = COURSE_TERRAIN_SAMPLE_STEP_M,
): CourseTerrainSegment[] {
  if (matches.length === 0 || !(distanceKm > 0)) return [];
  const runs: Run[] = [];
  matches.forEach((match, index) => {
    const last = runs.at(-1);
    const surfaces = new Map<string, number>(match.surface ? [[match.surface, 1]] : []);
    if (last && last.class === match.class) {
      last.count += 1;
      addSurfaces(last.surfaces, surfaces);
    } else {
      runs.push({ class: match.class, start: index, count: 1, surfaces });
    }
  });

  const minCount = Math.ceil(COURSE_TERRAIN_MIN_SEGMENT_M / stepM);
  let index = 0;
  while (index < runs.length) {
    const run = runs[index]!;
    if (run.count >= minCount || runs.length === 1) {
      index++;
      continue;
    }
    const left = runs[index - 1];
    const right = runs[index + 1];
    const target = !left ? right! : !right ? left : left.count >= right.count ? left : right;
    target.count += run.count;
    addSurfaces(target.surfaces, run.surfaces);
    if (target === right) right.start = run.start;
    runs.splice(index, 1);
    // The target may now touch a run of its own class: merge, then re-check from the left.
    const targetIndex = target === left ? index - 1 : index;
    mergeWithPrevious(runs, targetIndex + 1);
    mergeWithPrevious(runs, targetIndex);
    index = Math.max(0, targetIndex - 1);
  }

  const totalKm = round(distanceKm, 3);
  return runs.map((run, runIndex) => {
    const next = runs[runIndex + 1];
    return {
      fromKm: runIndex === 0 ? 0 : round((run.start * stepM) / 1000, 3),
      toKm: next ? round((next.start * stepM) / 1000, 3) : totalKm,
      class: run.class,
      surface: run.class === "off_path" ? null : mostFrequent(run.surfaces),
      source: "osm" as const,
    };
  }).filter((segment) => segment.toKm > segment.fromKm);
}

export function computeTerrainCoverage(matches: SampleMatch[]): CourseTerrainCoverage {
  const total = matches.length;
  if (total === 0) return { matchedPct: 0, surfaceTagPct: 0, sacScaleTagPct: 0 };
  let matched = 0;
  let surface = 0;
  let sacScale = 0;
  for (const match of matches) {
    if (match.class !== "off_path") matched++;
    if (match.hasSurfaceTag) surface++;
    if (match.hasSacScaleTag) sacScale++;
  }
  const pct = (count: number) => round((100 * count) / total, 1);
  return { matchedPct: pct(matched), surfaceTagPct: pct(surface), sacScaleTagPct: pct(sacScale) };
}

/** Compact run: [sampleCount, class, surface, flags] with flags bit 1 = surface tag, bit 2 = sac_scale tag. */
export type EncodedMatchRun = [number, CourseTerrainClass, string | null, number];

export function encodeMatches(matches: SampleMatch[], into: EncodedMatchRun[] = []): EncodedMatchRun[] {
  for (const match of matches) {
    const flags = (match.hasSurfaceTag ? 1 : 0) | (match.hasSacScaleTag ? 2 : 0);
    const last = into.at(-1);
    if (last && last[1] === match.class && last[2] === match.surface && last[3] === flags) last[0] += 1;
    else into.push([1, match.class, match.surface, flags]);
  }
  return into;
}

export function decodeMatches(runs: EncodedMatchRun[]): SampleMatch[] {
  const out: SampleMatch[] = [];
  for (const [count, terrainClass, surface, flags] of runs) {
    const match: SampleMatch = { class: terrainClass, surface, hasSurfaceTag: (flags & 1) === 1, hasSacScaleTag: (flags & 2) === 2 };
    for (let i = 0; i < count; i++) out.push(match);
  }
  return out;
}

export function isEncodedMatchRun(value: unknown): value is EncodedMatchRun {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    Number.isInteger(value[0]) &&
    (value[0] as number) > 0 &&
    isCourseTerrainClass(value[1]) &&
    (value[2] === null || typeof value[2] === "string") &&
    Number.isInteger(value[3])
  );
}

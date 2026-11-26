// Pure helpers over the course terrain contract. Display-only: nothing here feeds pacing/nutrition.

import {
  COURSE_TERRAIN_CLASSES,
  type CourseTerrainClass,
  type CourseTerrainOverride,
  type CourseTerrainSegment,
  type CourseTerrainSummary,
} from './types';

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function isCourseTerrainClass(value: unknown): value is CourseTerrainClass {
  return typeof value === 'string' && (COURSE_TERRAIN_CLASSES as readonly string[]).includes(value);
}

/** Merges touching segments of the same class and source; drops empty ones. Input need not be sorted. */
export function normalizeCourseTerrainSegments(segments: CourseTerrainSegment[]): CourseTerrainSegment[] {
  const sorted = segments
    .filter((segment) => Number.isFinite(segment.fromKm) && Number.isFinite(segment.toKm) && segment.toKm > segment.fromKm)
    .sort((a, b) => a.fromKm - b.fromKm);
  const out: CourseTerrainSegment[] = [];
  for (const segment of sorted) {
    const last = out.at(-1);
    if (last && last.class === segment.class && last.source === segment.source && segment.fromKm <= last.toKm + 1e-6) {
      last.toKm = Math.max(last.toKm, segment.toKm);
      if (!last.surface) last.surface = segment.surface;
    } else {
      out.push({ ...segment });
    }
  }
  return out;
}

/**
 * Applies organizer overrides on top of OSM segments: every overridden km range takes the
 * override class (`source: 'organizer'`, `surface: null`); later overrides win over earlier ones.
 * Ranges are clamped to `[0, distanceKm]`.
 */
export function applyCourseTerrainOverrides(
  osmSegments: CourseTerrainSegment[],
  overrides: CourseTerrainOverride[],
  distanceKm: number,
): CourseTerrainSegment[] {
  let segments = osmSegments.map((segment) => ({ ...segment }));
  for (const override of overrides) {
    const from = Math.max(0, Math.min(override.fromKm, override.toKm));
    const to = Math.min(distanceKm, Math.max(override.fromKm, override.toKm));
    if (!(to > from) || !isCourseTerrainClass(override.class)) continue;
    const next: CourseTerrainSegment[] = [];
    for (const segment of segments) {
      if (segment.toKm <= from || segment.fromKm >= to) {
        next.push(segment);
        continue;
      }
      if (segment.fromKm < from) next.push({ ...segment, toKm: from });
      if (segment.toKm > to) next.push({ ...segment, fromKm: to });
    }
    next.push({ fromKm: from, toKm: to, class: override.class, surface: null, source: 'organizer' });
    segments = next;
  }
  return normalizeCourseTerrainSegments(segments);
}

/** Km and % of each class over `distanceKm` (missing ranges are not counted). */
export function summarizeCourseTerrain(segments: CourseTerrainSegment[], distanceKm: number): CourseTerrainSummary {
  const summary = Object.fromEntries(
    COURSE_TERRAIN_CLASSES.map((terrainClass) => [terrainClass, { km: 0, pct: 0 }]),
  ) as CourseTerrainSummary;
  for (const segment of segments) {
    summary[segment.class].km += Math.max(0, segment.toKm - segment.fromKm);
  }
  for (const terrainClass of COURSE_TERRAIN_CLASSES) {
    const share = summary[terrainClass];
    share.pct = distanceKm > 0 ? round((share.km / distanceKm) * 100, 1) : 0;
    share.km = round(share.km, 2);
  }
  return summary;
}

/** Segment covering `km`, or `null`. */
export function courseTerrainAtKm(segments: CourseTerrainSegment[], km: number): CourseTerrainSegment | null {
  return segments.find((segment) => km >= segment.fromKm && km < segment.toKm) ?? (segments.at(-1)?.toKm === km ? segments.at(-1)! : null);
}

/**
 * Rescales segments from the GPX distance to another axis (e.g. the official distance of a
 * profile chart): `fromKm`/`toKm` are multiplied by `targetKm / sourceKm`.
 */
export function scaleCourseTerrainSegments(
  segments: CourseTerrainSegment[],
  sourceKm: number,
  targetKm: number,
): CourseTerrainSegment[] {
  if (!(sourceKm > 0) || !(targetKm > 0) || sourceKm === targetKm) return segments;
  const ratio = targetKm / sourceKm;
  return segments.map((segment) => ({ ...segment, fromKm: segment.fromKm * ratio, toKm: segment.toKm * ratio }));
}

/** Class shares of a km range (e.g. one plan section), in km, sorted by decreasing length. */
export function courseTerrainBetween(
  segments: CourseTerrainSegment[],
  fromKm: number,
  toKm: number,
): Array<{ class: CourseTerrainClass; km: number }> {
  const totals = new Map<CourseTerrainClass, number>();
  for (const segment of segments) {
    const overlap = Math.min(toKm, segment.toKm) - Math.max(fromKm, segment.fromKm);
    if (overlap > 0) totals.set(segment.class, (totals.get(segment.class) ?? 0) + overlap);
  }
  return [...totals.entries()]
    .map(([terrainClass, km]) => ({ class: terrainClass, km: round(km, 2) }))
    .sort((a, b) => b.km - a.km);
}

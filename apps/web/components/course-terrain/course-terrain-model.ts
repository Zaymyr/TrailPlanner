import {
  COURSE_TERRAIN_CLASSES,
  COURSE_TERRAIN_CLASS_COLORS,
  scaleCourseTerrainSegments,
  type CourseTerrain,
  type CourseTerrainClass,
  type CourseTerrainResponse,
  type CourseTerrainSegment,
  type CourseTerrainSummary,
} from "@trailplanner/shared";

import type { CourseTerrainLocale } from "./copy";
import { courseTerrainCopy } from "./copy";

// Pure logic of the course terrain block (display-only, never feeds pacing or nutrition).

export type CourseTerrainView =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "ready"; terrain: CourseTerrain };

export type CourseTerrainQueryLike =
  | { status: "idle" | "loading" | "error"; data: null }
  | { status: "ready"; data: CourseTerrainResponse };

/** `unavailable`, loading, idle and fetch errors render nothing; `pending` shows a discreet note. */
export function selectCourseTerrainView(query: CourseTerrainQueryLike): CourseTerrainView {
  if (query.status !== "ready") return { kind: "none" };
  const data = query.data;
  if (data.status === "pending") return { kind: "pending" };
  if (data.status === "ready" && data.segments.length > 0) return { kind: "ready", terrain: data };
  return { kind: "none" };
}

export type CourseTerrainBandRect = {
  /** Position on the axis, in % of the axis width (usable as SVG percent lengths). */
  leftPct: number;
  widthPct: number;
  class: CourseTerrainClass;
  color: string;
  hatched: boolean;
  fromKm: number;
  toKm: number;
  surface: string | null;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Rects of the band on an axis of `axisKm`. Segments are expressed on the GPX distance
 * (`sourceKm`) and rescaled to the chart axis, then clipped to `[0, axisKm]`.
 */
export function buildCourseTerrainBandRects(
  segments: CourseTerrainSegment[],
  sourceKm: number,
  axisKm: number,
): CourseTerrainBandRect[] {
  if (!(axisKm > 0)) return [];
  const rects: CourseTerrainBandRect[] = [];
  for (const segment of scaleCourseTerrainSegments(segments, sourceKm, axisKm)) {
    const fromKm = Math.max(0, segment.fromKm);
    const toKm = Math.min(axisKm, segment.toKm);
    if (!(toKm > fromKm)) continue;
    rects.push({
      leftPct: round3((fromKm / axisKm) * 100),
      widthPct: round3(((toKm - fromKm) / axisKm) * 100),
      class: segment.class,
      color: COURSE_TERRAIN_CLASS_COLORS[segment.class],
      hatched: segment.class === "off_path",
      fromKm,
      toKm,
      surface: segment.surface,
    });
  }
  return rects;
}

/** Localised surface for common OSM values; unknown raw values return null (hidden). */
export function courseTerrainSurfaceLabel(surface: string | null | undefined, locale: CourseTerrainLocale): string | null {
  if (!surface) return null;
  return courseTerrainCopy[locale].surfaceLabel[surface.trim().toLowerCase()] ?? null;
}

export function formatTerrainKm(km: number, locale: CourseTerrainLocale): string {
  const rounded = (Math.round(km * 10) / 10).toFixed(1);
  return locale === "fr" ? rounded.replace(".", ",") : rounded;
}

/** « Sentier · km 12,3 → 14,8 · surface : roche ». */
export function courseTerrainSegmentTitle(
  rect: Pick<CourseTerrainBandRect, "class" | "fromKm" | "toKm" | "surface">,
  locale: CourseTerrainLocale,
): string {
  const copy = courseTerrainCopy[locale];
  const parts = [
    copy.classLabel[rect.class],
    `${copy.kmUnit} ${formatTerrainKm(rect.fromKm, locale)} → ${formatTerrainKm(rect.toKm, locale)}`,
  ];
  const surface = courseTerrainSurfaceLabel(rect.surface, locale);
  if (surface) parts.push(`${copy.surface}${locale === "fr" ? " :" : ":"} ${surface}`);
  if (rect.class === "off_path") parts.push(copy.offPathHint);
  return parts.join(" · ");
}

export type CourseTerrainChip = { class: CourseTerrainClass; pct: number; label: string; color: string; hatched: boolean };

/** Legend chips sorted by decreasing share; classes rounding to 0 % are skipped. */
export function buildCourseTerrainChips(summary: CourseTerrainSummary, locale: CourseTerrainLocale): CourseTerrainChip[] {
  const copy = courseTerrainCopy[locale];
  return COURSE_TERRAIN_CLASSES.map((terrainClass) => ({ terrainClass, pct: Math.round(summary[terrainClass]?.pct ?? 0) }))
    .filter((entry) => entry.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .map(({ terrainClass, pct }) => ({
      class: terrainClass,
      pct,
      label: `${pct} % ${copy.classLabel[terrainClass].toLowerCase()}`,
      color: COURSE_TERRAIN_CLASS_COLORS[terrainClass],
      hatched: terrainClass === "off_path",
    }));
}

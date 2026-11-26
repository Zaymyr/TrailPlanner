"use client";

import React, { useId } from "react";
import type { CourseTerrainSegment } from "@trailplanner/shared";

import type { CourseTerrainLocale } from "./copy";
import { courseTerrainCopy } from "./copy";
import { buildCourseTerrainBandRects, courseTerrainSegmentTitle } from "./course-terrain-model";

export type CourseTerrainBandProps = {
  segments: CourseTerrainSegment[];
  /** GPX distance the segments are expressed on, km. */
  sourceKm: number;
  /** Distance of the chart x axis the band must align with (0 -> axisKm), km. */
  axisKm: number;
  /** Plot-area insets of the chart, as CSS lengths, so the band lines up with its x axis. */
  insetLeft?: string;
  insetRight?: string;
  locale: CourseTerrainLocale;
  className?: string;
};

/**
 * Thin terrain band aligned under an elevation chart. Rects use SVG percent lengths, so the band
 * follows the chart width without measuring it; `off_path` is hatched so it never reads as a surface.
 */
export function CourseTerrainBand({ segments, sourceKm, axisKm, insetLeft = "0px", insetRight = "0px", locale, className }: CourseTerrainBandProps) {
  const patternId = `terrain-hatch-${useId().replace(/:/g, "")}`;
  const rects = buildCourseTerrainBandRects(segments, sourceKm, axisKm);
  if (rects.length === 0) return null;
  return (
    <div className={className} style={{ marginLeft: insetLeft, marginRight: insetRight }}>
      <svg role="img" aria-label={courseTerrainCopy[locale].bandLabel} width="100%" height="10" className="block overflow-hidden rounded-[2px]">
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#F3F1EA" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#8A917E" strokeWidth="2.5" />
          </pattern>
        </defs>
        {rects.map((rect, index) => (
          <rect
            key={`${rect.fromKm}-${index}`}
            x={`${rect.leftPct}%`}
            y="0"
            width={`${rect.widthPct}%`}
            height="10"
            fill={rect.hatched ? `url(#${patternId})` : rect.color}
          >
            <title>{courseTerrainSegmentTitle(rect, locale)}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

"use client";

import React, { useMemo } from "react";

import { useCourseTerrain } from "../../lib/course-terrain-client";
import type { CourseTerrainLocale } from "./copy";
import { courseTerrainCopy } from "./copy";
import { CourseTerrainBand } from "./CourseTerrainBand";
import { CourseTerrainSummary } from "./CourseTerrainSummary";
import { selectCourseTerrainView } from "./course-terrain-model";

export type CourseTerrainBlockProps = {
  /** Catalog race; nothing is rendered without it. */
  raceId: string | null | undefined;
  /** Distance of the chart x axis, km (0 -> axisKm). */
  axisKm: number;
  insetLeft?: string;
  insetRight?: string;
  locale: CourseTerrainLocale;
  className?: string;
};

/** Band + summary under an elevation chart. Display-only, free (not part of the paid plan). */
export function CourseTerrainBlock({ raceId, axisKm, insetLeft, insetRight, locale, className }: CourseTerrainBlockProps) {
  const query = useCourseTerrain(raceId);
  const state = useMemo(() => selectCourseTerrainView(query), [query]);
  if (!raceId || state.kind === "none") return null;
  return (
    <section aria-label={courseTerrainCopy[locale].title} className={`space-y-2 ${className ?? ""}`}>
      {state.kind === "ready" ? (
        <CourseTerrainBand
          segments={state.terrain.segments}
          sourceKm={state.terrain.distanceKm}
          axisKm={axisKm}
          insetLeft={insetLeft}
          insetRight={insetRight}
          locale={locale}
        />
      ) : null}
      <CourseTerrainSummary state={state} locale={locale} />
    </section>
  );
}

"use client";

import React, { useMemo } from "react";

import { useCourseWeather } from "../../lib/course-weather-client";
import type { CourseWeatherLocale } from "./copy";
import { courseWeatherCopy } from "./copy";
import { CourseWeatherPanel } from "./CourseWeatherPanel";
import { buildPassageRows, buildRaceDayRows, passagesFromPlanSegments, selectCourseWeatherView, type PlanSegmentLike } from "./course-weather-model";

export type CoursePlanWeatherProps = {
  /** Catalog race the plan is linked to; nothing is rendered without it. */
  raceId: string | null | undefined;
  /** Planner sections: the passages are Départ (0 km, 0 min) then every section end at its plan ETA. */
  segments: PlanSegmentLike[];
  locale: CourseWeatherLocale;
  className?: string;
};

/** Planner mount: forecast weather at each planned passage. Display-only, free (not part of the paid plan). */
export function CoursePlanWeather({ raceId, segments, locale, className }: CoursePlanWeatherProps) {
  const query = useCourseWeather(raceId);
  const state = selectCourseWeatherView(query);
  const passages = useMemo(() => passagesFromPlanSegments(segments), [segments]);
  const rows = useMemo(() => {
    if (state.kind !== "forecast") return [];
    return state.forecast.startAt ? buildPassageRows(state.forecast, passages, locale) : buildRaceDayRows(state.forecast, locale);
  }, [state, passages, locale]);

  if (!raceId) return null;
  return <CourseWeatherPanel title={courseWeatherCopy[locale].planTitle} state={state} rows={rows} locale={locale} className={className} />;
}

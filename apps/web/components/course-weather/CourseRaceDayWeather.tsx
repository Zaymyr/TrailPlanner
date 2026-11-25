"use client";

import React, { useMemo } from "react";

import { useCourseWeather } from "../../lib/course-weather-client";
import type { CourseWeatherLocale } from "./copy";
import { courseWeatherCopy } from "./copy";
import { CourseWeatherPanel } from "./CourseWeatherPanel";
import { buildRaceDayRows, selectCourseWeatherView } from "./course-weather-model";

export type CourseRaceDayWeatherProps = {
  raceId: string;
  /** Race day (`YYYY-MM-DD`); past races never call the endpoint. */
  raceDate: string | null | undefined;
  locale?: CourseWeatherLocale;
  className?: string;
};

/** Public race page mount: per-point summary of the race window, fetched client-side so the ISR page is unchanged. */
export function CourseRaceDayWeather({ raceId, raceDate, locale = "fr", className }: CourseRaceDayWeatherProps) {
  const isUpcoming = useMemo(() => {
    if (!raceDate) return false;
    const day = Date.parse(`${raceDate.slice(0, 10)}T23:59:59Z`);
    return Number.isFinite(day) && day >= Date.now();
  }, [raceDate]);
  const query = useCourseWeather(isUpcoming ? raceId : null);
  const state = selectCourseWeatherView(query);
  const rows = useMemo(() => (state.kind === "forecast" ? buildRaceDayRows(state.forecast, locale) : []), [state, locale]);

  if (!isUpcoming) return null;
  return <CourseWeatherPanel title={courseWeatherCopy[locale].raceDayTitle} state={state} rows={rows} locale={locale} className={className} />;
}

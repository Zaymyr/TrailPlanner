import {
  courseWeatherAtPassages,
  courseWeatherFeelsLikeC,
  courseWeatherHourAlerts,
  courseWeatherLikelyPassageHours,
  summarizeCourseWeatherHours,
  type CourseWeatherAlert,
  type CourseWeatherForecast,
  type CourseWeatherPassage,
  type CourseWeatherPoint,
  type CourseWeatherResponse,
} from "@trailplanner/shared";

import { courseWeatherCopy, type CourseWeatherCopy, type CourseWeatherLocale, type WeatherGlyphKind } from "./copy";

// Pure display logic of the course weather block. Display-only: nothing here feeds pacing/nutrition.

const intlLocale = (locale: CourseWeatherLocale) => (locale === "fr" ? "fr-FR" : "en-US");

const round = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;

/** MET Norway `symbol_code` to one of the few glyph families the UI draws. */
export function weatherGlyphForSymbol(symbol: string | null | undefined): WeatherGlyphKind {
  if (!symbol) return "unknown";
  if (symbol.includes("thunder")) return "storm";
  if (symbol.includes("snow") || symbol.includes("sleet")) return "snow";
  if (symbol.includes("rain") || symbol.includes("showers")) return "rain";
  if (symbol.startsWith("fog")) return "fog";
  const night = symbol.endsWith("_night") || symbol.endsWith("_polartwilight");
  if (symbol.startsWith("clearsky")) return night ? "clear_night" : "clear";
  if (symbol.startsWith("fair") || symbol.startsWith("partlycloudy")) return night ? "partly_night" : "partly";
  if (symbol.startsWith("cloudy")) return "cloudy";
  return "unknown";
}

export type CourseWeatherQueryLike =
  | { status: "idle"; data: null }
  | { status: "loading"; data: null }
  | { status: "error"; data: null }
  | { status: "ready"; data: CourseWeatherResponse };

export type CourseWeatherViewState =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "too_early"; availableFrom: string }
  | { kind: "forecast"; forecast: CourseWeatherForecast };

/** `unavailable` renders nothing, except a provider error which shows a discreet line. */
export function selectCourseWeatherView(query: CourseWeatherQueryLike): CourseWeatherViewState {
  if (query.status === "idle") return { kind: "hidden" };
  if (query.status === "loading") return { kind: "loading" };
  if (query.status === "error") return { kind: "error" };
  const response = query.data;
  if (response.status === "forecast") return { kind: "forecast", forecast: response };
  if (response.status === "too_early") return { kind: "too_early", availableFrom: response.availableFrom };
  return response.reason === "provider_error" ? { kind: "error" } : { kind: "hidden" };
}

/** `2026-11-29T06:30:00Z` to « 07:30 » in the race time zone. */
export function formatLocalTime(iso: string, timeZone: string, locale: CourseWeatherLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** `YYYY-MM-DD` to « dimanche 29 novembre » (a calendar day, no time zone shift). */
export function formatLocalDay(day: string, locale: CourseWeatherLocale): string {
  const date = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(date);
}

/** Forecast fetch instant, e.g. « 23 nov., 14:05 », in the race time zone. */
export function formatFetchedAt(iso: string, timeZone: string, locale: CourseWeatherLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function courseWeatherPointLabel(point: Pick<CourseWeatherPoint, "kind" | "name">, copy: CourseWeatherCopy): string {
  if (point.kind === "aid_station" && point.name) return point.name;
  return copy.pointKind[point.kind];
}

export function formatKm(distanceKm: number, locale: CourseWeatherLocale): string {
  return `${distanceKm.toLocaleString(intlLocale(locale), { maximumFractionDigits: 1 })} km`;
}

/** « Heure de départ estimée à 7h » when the organizer gave no start time. */
export function startEstimateNote(forecast: CourseWeatherForecast, locale: CourseWeatherLocale): string | null {
  if (!forecast.startTimeIsEstimated || !forecast.startAt) return null;
  const time = formatLocalTime(forecast.startAt, forecast.timeZone, locale);
  if (!time) return null;
  const [hours, minutes] = time.split(":");
  const short = minutes === "00" ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`;
  return courseWeatherCopy[locale].startEstimated.replace("{time}", short);
}

export type CourseWeatherRow = {
  key: string;
  label: string;
  distanceKm: number;
  /** Local passage time (plan ETA); `null` for a race-day summary. */
  timeLabel: string | null;
  glyph: WeatherGlyphKind;
  glyphLabel: string;
  /** Air temperature (passage) or minimum temperature (race-day summary). */
  temperatureC: number | null;
  /** Race-day summary only. */
  maxTemperatureC: number | null;
  /** Set only when it differs from the air temperature by at least 1 degree. */
  feelsLikeC: number | null;
  windKph: number | null;
  gustKph: number | null;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  alerts: CourseWeatherAlert[];
  hasData: boolean;
};

export type PlanPassageInput = CourseWeatherPassage & { label: string };

/** Structural subset of the planner `Segment` used to derive passages. */
export type PlanSegmentLike = { from: string; checkpoint: string; distanceKm: number; etaMinutes: number };

/** Depart at 0 km / 0 min, then each section end at its planned ETA (read from the plan, never written back). */
export function passagesFromPlanSegments(segments: PlanSegmentLike[]): PlanPassageInput[] {
  if (segments.length === 0) return [];
  return [
    { label: segments[0].from, distanceKm: 0, elapsedMinutes: 0 },
    ...segments.map((segment) => ({ label: segment.checkpoint, distanceKm: segment.distanceKm, elapsedMinutes: segment.etaMinutes })),
  ];
}

/** One row per planned passage: forecast hour at `startAt + elapsedMinutes`. */
export function buildPassageRows(
  forecast: CourseWeatherForecast,
  passages: PlanPassageInput[],
  locale: CourseWeatherLocale,
): CourseWeatherRow[] {
  const copy = courseWeatherCopy[locale];
  const valid = passages.filter((passage) => Number.isFinite(passage.elapsedMinutes) && Number.isFinite(passage.distanceKm));
  return courseWeatherAtPassages(forecast, valid).map((entry, index) => {
    const hour = entry.hour;
    const glyph = weatherGlyphForSymbol(hour?.symbol);
    const temperature = round(hour?.temperatureC);
    const feelsLike = round(entry.feelsLikeC);
    return {
      key: `${entry.point.id}-${index}`,
      label: valid[index]?.label || courseWeatherPointLabel(entry.point, copy),
      distanceKm: entry.passage.distanceKm,
      timeLabel: formatLocalTime(entry.at, forecast.timeZone, locale),
      glyph,
      glyphLabel: copy.glyph[glyph],
      temperatureC: temperature,
      maxTemperatureC: null,
      feelsLikeC: feelsLike !== null && temperature !== null && Math.abs(feelsLike - temperature) >= 1 ? feelsLike : null,
      windKph: round(hour?.windSpeedKph),
      gustKph: round(hour?.windGustKph),
      precipitationMm: hour?.precipitationMm ?? null,
      precipitationProbability: round(hour?.precipitationProbability),
      alerts: entry.alerts,
      hasData: hour !== null,
    };
  });
}

/** One row per course point summarising the hours the field is likely to pass it (public race page). */
export function buildRaceDayRows(forecast: CourseWeatherForecast, locale: CourseWeatherLocale): CourseWeatherRow[] {
  const copy = courseWeatherCopy[locale];
  return forecast.points.map((point) => {
    // Likely passage hours of the field, not the whole 48 h forecast window.
    const hours = courseWeatherLikelyPassageHours(point, forecast.startAt);
    const summary = summarizeCourseWeatherHours(hours);
    const glyph = weatherGlyphForSymbol(summary.dominantSymbol);
    const alerts = new Set<CourseWeatherAlert>();
    let coldestFeelsLike: number | null = null;
    for (const hour of hours) {
      for (const alert of courseWeatherHourAlerts(hour)) alerts.add(alert);
      const feels = courseWeatherFeelsLikeC(hour);
      if (feels !== null && (coldestFeelsLike === null || feels < coldestFeelsLike)) coldestFeelsLike = feels;
    }
    const speeds = hours.map((hour) => hour.windSpeedKph).filter((v): v is number => typeof v === "number");
    const gusts = hours.map((hour) => hour.windGustKph).filter((v): v is number => typeof v === "number");
    const min = round(summary.minTemperatureC);
    const feelsLike = round(coldestFeelsLike);
    return {
      key: point.id,
      label: courseWeatherPointLabel(point, copy),
      distanceKm: point.distanceKm,
      timeLabel: null,
      glyph,
      glyphLabel: copy.glyph[glyph],
      temperatureC: min,
      maxTemperatureC: round(summary.maxTemperatureC),
      feelsLikeC: feelsLike !== null && min !== null && feelsLike <= min - 1 ? feelsLike : null,
      // Gusts and probabilities can be null for a whole region: keep sustained wind and gusts apart.
      windKph: speeds.length ? round(Math.max(...speeds)) : null,
      gustKph: gusts.length ? round(Math.max(...gusts)) : null,
      precipitationMm: summary.totalPrecipitationMm,
      precipitationProbability: round(summary.maxPrecipitationProbability),
      alerts: Array.from(alerts),
      hasData: hours.length > 0,
    };
  });
}

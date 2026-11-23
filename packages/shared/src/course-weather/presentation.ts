// Pure presentation helpers over the race-weather contract. Display-only: nothing here feeds
// pacing or nutrition. Thresholds are deliberately simple and documented in
// docs/05-integrations/met-norway-weather.md.

import type {
  CourseWeatherAlert,
  CourseWeatherAtPassage,
  CourseWeatherForecast,
  CourseWeatherHour,
  CourseWeatherPassage,
  CourseWeatherPoint,
  CourseWeatherSummary,
} from './types';

const MINUTE_MS = 60_000;

export const COURSE_WEATHER_THRESHOLDS = {
  /** Feels-like temperature (°C) at or above which heat is flagged. */
  heatFeelsLikeC: 27,
  /** Feels-like temperature (°C) at or below which cold is flagged. */
  coldFeelsLikeC: 0,
  /** Gust (km/h) at or above which wind is flagged. */
  windGustKph: 60,
  /** Hourly precipitation (mm) at or above which rain is flagged. */
  rainMmPerHour: 1,
} as const;

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Severity rank of a MET Norway symbol code, used to pick the "worst" sky of a period. */
export function courseWeatherSymbolSeverity(symbol: string | null | undefined): number {
  if (!symbol) return -1;
  if (symbol.includes('thunder')) return 6;
  if (symbol.includes('snow') || symbol.includes('sleet')) return 5;
  if (symbol.includes('rain')) return symbol.includes('heavy') ? 4.5 : symbol.includes('light') ? 3.5 : 4;
  if (symbol.startsWith('fog')) return 3;
  if (symbol.startsWith('cloudy')) return 2;
  if (symbol.startsWith('partlycloudy')) return 1;
  if (symbol.startsWith('fair')) return 0.5;
  return 0;
}

/** Forecast hour covering `instant`, or the closest one within `toleranceMinutes`. */
export function courseWeatherHourAt(
  point: Pick<CourseWeatherPoint, 'hours'>,
  instant: string | Date,
  toleranceMinutes = 90,
): CourseWeatherHour | null {
  const target = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  if (!Number.isFinite(target)) return null;
  let best: CourseWeatherHour | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hour of point.hours) {
    const start = Date.parse(hour.time);
    if (!Number.isFinite(start)) continue;
    if (target >= start && target < start + 60 * MINUTE_MS) return hour;
    const distance = Math.min(Math.abs(target - start), Math.abs(target - (start + 60 * MINUTE_MS)));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hour;
    }
  }
  return bestDistance <= toleranceMinutes * MINUTE_MS ? best : null;
}

/** Course point closest to `distanceKm`. */
export function nearestCourseWeatherPoint(
  points: CourseWeatherPoint[],
  distanceKm: number,
): CourseWeatherPoint | null {
  let best: CourseWeatherPoint | null = null;
  for (const point of points) {
    if (!best || Math.abs(point.distanceKm - distanceKm) < Math.abs(best.distanceKm - distanceKm)) best = point;
  }
  return best;
}

/**
 * Apparent temperature: wind chill (Environment Canada) when cold and windy, heat index
 * (Rothfusz, NOAA) when hot and humid, otherwise the air temperature.
 */
export function courseWeatherFeelsLikeC(
  hour: Pick<CourseWeatherHour, 'temperatureC' | 'windSpeedKph' | 'relativeHumidity'>,
): number | null {
  const t = hour.temperatureC;
  if (!isNumber(t)) return null;
  const wind = hour.windSpeedKph;
  if (t <= 10 && isNumber(wind) && wind > 4.8) {
    const v = Math.pow(wind, 0.16);
    return Math.round((13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v) * 10) / 10;
  }
  const rh = hour.relativeHumidity;
  if (t >= 27 && isNumber(rh)) {
    const f = (t * 9) / 5 + 32;
    const hi =
      -42.379 + 2.04901523 * f + 10.14333127 * rh - 0.22475541 * f * rh - 0.00683783 * f * f -
      0.05481717 * rh * rh + 0.00122874 * f * f * rh + 0.00085282 * f * rh * rh - 0.00000199 * f * f * rh * rh;
    return Math.round((((hi - 32) * 5) / 9) * 10) / 10;
  }
  return t;
}

/** Alerts raised by one hour. */
export function courseWeatherHourAlerts(hour: CourseWeatherHour | null): CourseWeatherAlert[] {
  if (!hour) return [];
  const alerts: CourseWeatherAlert[] = [];
  const feelsLike = courseWeatherFeelsLikeC(hour);
  if (isNumber(feelsLike) && feelsLike >= COURSE_WEATHER_THRESHOLDS.heatFeelsLikeC) alerts.push('heat');
  if (isNumber(feelsLike) && feelsLike <= COURSE_WEATHER_THRESHOLDS.coldFeelsLikeC) alerts.push('cold');
  if (isNumber(hour.windGustKph) && hour.windGustKph >= COURSE_WEATHER_THRESHOLDS.windGustKph) alerts.push('wind');
  const symbol = hour.symbol ?? '';
  if (symbol.includes('thunder')) alerts.push('storm');
  if (symbol.includes('snow') || symbol.includes('sleet')) alerts.push('snow');
  else if (
    (isNumber(hour.precipitationMm) && hour.precipitationMm >= COURSE_WEATHER_THRESHOLDS.rainMmPerHour) ||
    symbol.includes('rain')
  ) {
    alerts.push('rain');
  }
  return alerts;
}

/** Aggregates a set of hours (e.g. one point over the race day, or every point). */
export function summarizeCourseWeatherHours(hours: CourseWeatherHour[]): CourseWeatherSummary {
  const temps = hours.map((hour) => hour.temperatureC).filter(isNumber);
  const gusts = hours.map((hour) => hour.windGustKph ?? hour.windSpeedKph).filter(isNumber);
  const precipitation = hours.map((hour) => hour.precipitationMm).filter(isNumber);
  const probabilities = hours.map((hour) => hour.precipitationProbability).filter(isNumber);
  let dominantSymbol: string | null = null;
  for (const hour of hours) {
    if (courseWeatherSymbolSeverity(hour.symbol) > courseWeatherSymbolSeverity(dominantSymbol)) dominantSymbol = hour.symbol;
  }
  return {
    minTemperatureC: temps.length ? Math.min(...temps) : null,
    maxTemperatureC: temps.length ? Math.max(...temps) : null,
    maxWindGustKph: gusts.length ? Math.max(...gusts) : null,
    totalPrecipitationMm: precipitation.length
      ? Math.round(precipitation.reduce((sum, value) => sum + value, 0) * 10) / 10
      : null,
    maxPrecipitationProbability: probabilities.length ? Math.max(...probabilities) : null,
    dominantSymbol,
  };
}

/** Hours of a point between two instants (inclusive of the hour containing `from`). */
export function courseWeatherHoursBetween(
  point: Pick<CourseWeatherPoint, 'hours'>,
  from: string | Date,
  to: string | Date,
): CourseWeatherHour[] {
  const start = typeof from === 'string' ? Date.parse(from) : from.getTime();
  const end = typeof to === 'string' ? Date.parse(to) : to.getTime();
  return point.hours.filter((hour) => {
    const time = Date.parse(hour.time);
    return time + 60 * MINUTE_MS > start && time <= end;
  });
}

/**
 * Weather the runner should meet at each planned passage: nearest forecast point by distance,
 * forecast hour at `startAt + elapsedMinutes`. Empty when the race has no start instant.
 */
export function courseWeatherAtPassages(
  forecast: Pick<CourseWeatherForecast, 'startAt' | 'points'>,
  passages: CourseWeatherPassage[],
): CourseWeatherAtPassage[] {
  if (!forecast.startAt) return [];
  const start = Date.parse(forecast.startAt);
  if (!Number.isFinite(start)) return [];
  return passages.flatMap((passage) => {
    const point = nearestCourseWeatherPoint(forecast.points, passage.distanceKm);
    if (!point || !Number.isFinite(passage.elapsedMinutes)) return [];
    const at = new Date(start + passage.elapsedMinutes * MINUTE_MS);
    const hour = courseWeatherHourAt(point, at);
    return [{
      passage,
      point,
      at: at.toISOString(),
      hour,
      feelsLikeC: hour ? courseWeatherFeelsLikeC(hour) : null,
      alerts: courseWeatherHourAlerts(hour),
    }];
  });
}

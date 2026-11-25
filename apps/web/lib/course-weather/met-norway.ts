// MET Norway Locationforecast 2.0 client and parser (docs/05-integrations/met-norway-weather.md).
// Terms: CC BY 4.0 with attribution, an identifying User-Agent, and caching that honours `Expires`.

import type { CourseWeatherHour, CourseWeatherSource } from "@trailplanner/shared";

export const MET_NORWAY_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
/** Identifies the application, as MET Norway requires. Never a personal e-mail address. */
export const MET_NORWAY_USER_AGENT = "PaceYourself/1.0 (+https://pace-yourself.com)";
/** Next.js data-cache lifetime of one point forecast (MET refreshes about hourly). */
export const MET_NORWAY_REVALIDATE_SECONDS = 3600;

export const COURSE_WEATHER_SOURCE: CourseWeatherSource = {
  provider: "met_norway",
  attribution: "Données météo : MET Norway (CC BY 4.0)",
  url: "https://api.met.no/",
};

const HOUR_MS = 3_600_000;

type MetDetails = Record<string, number | undefined>;
type MetPeriod = { summary?: { symbol_code?: string }; details?: MetDetails };
export type MetTimeseriesStep = {
  time: string;
  data?: {
    instant?: { details?: MetDetails };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
    next_12_hours?: MetPeriod;
  };
};
export type MetForecastBody = { properties?: { timeseries?: MetTimeseriesStep[] } };

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const round = (value: number | null, decimals = 1): number | null => {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
const toKph = (metresPerSecond: number | null) => (metresPerSecond === null ? null : metresPerSecond * 3.6);

const lerp = (a: number | null, b: number | null, ratio: number): number | null => {
  if (a === null) return b === null ? null : ratio >= 0.5 ? b : null;
  if (b === null) return ratio < 0.5 ? a : null;
  return a + (b - a) * ratio;
};

/** Interpolates a direction along the shortest arc. */
const lerpDegrees = (a: number | null, b: number | null, ratio: number): number | null => {
  if (a === null || b === null) return lerp(a, b, ratio);
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * ratio + 360) % 360;
};

type Instant = {
  temperatureC: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  windFromDeg: number | null;
  relativeHumidity: number | null;
  cloudCover: number | null;
};

const instantOf = (step: MetTimeseriesStep): Instant => {
  const details = step.data?.instant?.details ?? {};
  return {
    temperatureC: num(details.air_temperature),
    windSpeedKph: toKph(num(details.wind_speed)),
    windGustKph: toKph(num(details.wind_speed_of_gust)),
    windFromDeg: num(details.wind_from_direction),
    relativeHumidity: num(details.relative_humidity),
    cloudCover: num(details.cloud_area_fraction),
  };
};

const interpolateInstant = (from: Instant, to: Instant | null, ratio: number): Instant => {
  if (!to || ratio === 0) return from;
  return {
    temperatureC: lerp(from.temperatureC, to.temperatureC, ratio),
    windSpeedKph: lerp(from.windSpeedKph, to.windSpeedKph, ratio),
    windGustKph: lerp(from.windGustKph, to.windGustKph, ratio),
    windFromDeg: lerpDegrees(from.windFromDeg, to.windFromDeg, ratio),
    relativeHumidity: lerp(from.relativeHumidity, to.relativeHumidity, ratio),
    cloudCover: lerp(from.cloudCover, to.cloudCover, ratio),
  };
};

const toHour = (
  timeMs: number,
  instant: Instant,
  period: { symbol: string | null; precipitationMm: number | null; probability: number | null },
): CourseWeatherHour => ({
  time: new Date(timeMs).toISOString().replace(".000Z", "Z"),
  temperatureC: round(instant.temperatureC),
  windSpeedKph: round(instant.windSpeedKph),
  windGustKph: round(instant.windGustKph),
  windFromDeg: instant.windFromDeg === null ? null : Math.round(instant.windFromDeg),
  precipitationMm: round(period.precipitationMm),
  precipitationProbability: period.probability === null ? null : Math.round(period.probability),
  relativeHumidity: instant.relativeHumidity === null ? null : Math.round(instant.relativeHumidity),
  cloudCover: instant.cloudCover === null ? null : Math.round(instant.cloudCover),
  symbol: period.symbol,
});

/**
 * Converts a MET Norway timeseries to hourly `CourseWeatherHour`s. Hourly steps map directly
 * (`next_1_hours`). Beyond ~2.5 days MET switches to 6-hour steps: each is expanded to hourly
 * entries with instant values interpolated linearly towards the next step, precipitation spread
 * evenly (`next_6_hours` amount / 6) and the 6-hour symbol and probability repeated.
 * Only hours inside `[windowStart, windowEnd]` are kept.
 */
export function parseMetNorwayTimeseries(
  body: MetForecastBody,
  window: { start: Date; end: Date },
): CourseWeatherHour[] {
  const steps = (body.properties?.timeseries ?? [])
    .map((step) => ({ step, timeMs: Date.parse(step.time) }))
    .filter((entry) => Number.isFinite(entry.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs);
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();
  const hours: CourseWeatherHour[] = [];

  steps.forEach(({ step, timeMs }, index) => {
    const next = steps[index + 1] ?? null;
    const oneHour = step.data?.next_1_hours;
    const sixHours = step.data?.next_6_hours;
    const usesHourlyPeriod = Boolean(oneHour) && (!next || next.timeMs - timeMs <= HOUR_MS);
    const span = next ? Math.max(1, Math.round((next.timeMs - timeMs) / HOUR_MS)) : 1;
    const hoursInStep = usesHourlyPeriod ? 1 : Math.min(span, 6);
    const from = instantOf(step);
    const to = next ? instantOf(next.step) : null;

    const period = usesHourlyPeriod
      ? {
          symbol: oneHour?.summary?.symbol_code ?? null,
          precipitationMm: num(oneHour?.details?.precipitation_amount),
          probability: num(oneHour?.details?.probability_of_precipitation),
        }
      : {
          symbol: sixHours?.summary?.symbol_code ?? step.data?.next_12_hours?.summary?.symbol_code ?? oneHour?.summary?.symbol_code ?? null,
          precipitationMm: (() => {
            const total = num(sixHours?.details?.precipitation_amount);
            if (total !== null) return total / 6;
            return num(oneHour?.details?.precipitation_amount);
          })(),
          probability: num(sixHours?.details?.probability_of_precipitation) ?? num(oneHour?.details?.probability_of_precipitation),
        };

    for (let offset = 0; offset < hoursInStep; offset += 1) {
      const hourMs = timeMs + offset * HOUR_MS;
      if (hourMs < startMs || hourMs > endMs) continue;
      const ratio = next ? (offset * HOUR_MS) / (next.timeMs - timeMs) : 0;
      hours.push(toHour(hourMs, interpolateInstant(from, to, ratio), period));
    }
  });

  return hours;
}

export type MetPointForecast = { hours: CourseWeatherHour[]; expiresAt: number | null };

/** Point URL; MET requires at most 4 decimals and an integer altitude. */
export function metNorwayForecastUrl(point: { latitude: number; longitude: number; altitudeM: number | null }): string {
  const params = new URLSearchParams({ lat: point.latitude.toFixed(4), lon: point.longitude.toFixed(4) });
  if (point.altitudeM !== null) params.set("altitude", String(Math.round(point.altitudeM)));
  return `${MET_NORWAY_FORECAST_URL}?${params.toString()}`;
}

/** Fetches one point through the Next.js data cache. Returns `null` on any failure. */
export async function fetchMetNorwayPointForecast(
  point: { latitude: number; longitude: number; altitudeM: number | null },
  window: { start: Date; end: Date },
): Promise<MetPointForecast | null> {
  try {
    const response = await fetch(metNorwayForecastUrl(point), {
      headers: { "User-Agent": MET_NORWAY_USER_AGENT, Accept: "application/json" },
      next: { revalidate: MET_NORWAY_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      console.warn("MET Norway forecast failed", response.status);
      return null;
    }
    const expires = Date.parse(response.headers.get("expires") ?? "");
    const body = (await response.json()) as MetForecastBody;
    return { hours: parseMetNorwayTimeseries(body, window), expiresAt: Number.isFinite(expires) ? expires : null };
  } catch (cause) {
    console.warn("MET Norway forecast failed", cause);
    return null;
  }
}

/** Runs `task` over `items` with at most `limit` in flight, preserving order. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

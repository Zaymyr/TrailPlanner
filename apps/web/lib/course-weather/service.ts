// Builds the `GET /api/race-weather` response. Display-only: nothing here feeds pacing or
// nutrition (docs/05-integrations/met-norway-weather.md).

import {
  COURSE_WEATHER_HORIZON_DAYS,
  type CourseWeatherPoint,
  type CourseWeatherResponse,
} from "@trailplanner/shared";
import { z } from "zod";

import { parseGpx } from "../gpx/parseGpx";
import type { SupabaseServiceConfig } from "../supabase";
import { COURSE_WEATHER_SOURCE, fetchMetNorwayPointForecast, mapWithConcurrency } from "./met-norway";
import { selectCourseWeatherPoints, startOnlyCourseWeatherPoint, type CourseWeatherPointSpec } from "./points";
import {
  DEFAULT_COURSE_WEATHER_START_TIME,
  addCalendarDays,
  courseWeatherTimeZone,
  normalizeCourseWeatherClock,
  zonedLocalDate,
  zonedLocalTimeToUtc,
} from "./time-zone";

const HOUR_MS = 3_600_000;
/** Forecast window around the start instant. */
export const COURSE_WEATHER_WINDOW_BEFORE_MS = 2 * HOUR_MS;
export const COURSE_WEATHER_WINDOW_AFTER_MS = 48 * HOUR_MS;
const MET_CONCURRENCY = 4;

const eventSchema = z.object({
  is_live: z.boolean().nullable().optional(),
  location_country_code: z.string().nullable().optional(),
  location_region_code: z.string().nullable().optional(),
});

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable().optional(),
  race_date: z.string().nullable().optional(),
  distance_km: z.coerce.number().nullable().optional(),
  start_lat: z.number().nullable().optional(),
  start_lng: z.number().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  is_public: z.boolean().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
  racebook_preview_is_visible: z.boolean().nullable().optional(),
  race_events: z.union([eventSchema, z.array(eventSchema)]).nullable().optional(),
});

const aidStationSchema = z.object({
  name: z.string(),
  km: z.coerce.number(),
  order_index: z.number().nullable().optional(),
});

const startWaveSchema = z.object({ start_time: z.string() });
const editionSchema = z.object({ is_visible: z.boolean().nullable().optional() });

const RACE_COLUMNS = [
  "id", "event_id", "edition_id", "race_date", "distance_km", "start_lat", "start_lng", "gpx_storage_path",
  "organizer_details", "is_public", "is_live", "racebook_preview_is_visible",
  "race_events(is_live,location_country_code,location_region_code)",
].join(",");

const serviceHeaders = (config: SupabaseServiceConfig) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
});

async function fetchRows<T>(config: SupabaseServiceConfig, path: string, schema: z.ZodType<T>): Promise<T[]> {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { headers: serviceHeaders(config), cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase read failed (${response.status})`);
  return z.array(schema).parse(await response.json());
}

/**
 * Mirrors the anon branches of the `races_select` policy: a public live format, or a public
 * preview-visible format of a live event and visible edition (the mobile catalog's private state).
 */
async function isRunnerVisible(
  config: SupabaseServiceConfig,
  race: z.infer<typeof raceSchema>,
  event: z.infer<typeof eventSchema> | null,
): Promise<boolean> {
  if (race.is_public !== true) return false;
  if (event && event.is_live === false) return false;
  if (race.is_live === true) return true;
  if (race.racebook_preview_is_visible !== true || !race.event_id || event?.is_live !== true) return false;
  if (!race.edition_id) return true;
  const [edition] = await fetchRows(
    config,
    `race_event_editions?id=eq.${encodeURIComponent(race.edition_id)}&select=is_visible&limit=1`,
    editionSchema,
  );
  return edition?.is_visible === true;
}

const scheduleStartTime = (organizerDetails: unknown): string | null => {
  if (!organizerDetails || typeof organizerDetails !== "object") return null;
  const schedule = (organizerDetails as { schedule?: unknown }).schedule;
  if (!schedule || typeof schedule !== "object") return null;
  return normalizeCourseWeatherClock((schedule as { startTime?: unknown }).startTime);
};

async function loadTrack(config: SupabaseServiceConfig, storagePath: string) {
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/race-gpx/${encodeURI(storagePath)}`, {
      headers: serviceHeaders(config),
      // GPX replacements use new versioned paths, so the bytes behind one path never change.
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const parsed = parseGpx(await response.text());
    return parsed.points.length > 0 ? parsed.points : null;
  } catch (cause) {
    console.warn("Course weather: GPX unavailable", cause);
    return null;
  }
}

export type CourseWeatherResult = { kind: "not_found" } | { kind: "response"; body: CourseWeatherResponse };

export async function buildCourseWeather(
  config: SupabaseServiceConfig,
  raceId: string,
  now: Date = new Date(),
): Promise<CourseWeatherResult> {
  const [race] = await fetchRows(config, `races?id=eq.${encodeURIComponent(raceId)}&select=${RACE_COLUMNS}&limit=1`, raceSchema);
  if (!race) return { kind: "not_found" };
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events ?? null;
  if (!(await isRunnerVisible(config, race, event))) return { kind: "not_found" };

  const raceDate = race.race_date?.slice(0, 10) ?? null;
  if (!raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
    return { kind: "response", body: { status: "unavailable", raceId, reason: "no_date" } };
  }

  const timeZone = courseWeatherTimeZone(event?.location_country_code, event?.location_region_code);
  const today = zonedLocalDate(now, timeZone);
  if (raceDate < addCalendarDays(today, -1)) {
    return { kind: "response", body: { status: "unavailable", raceId, reason: "past" } };
  }
  if (raceDate > addCalendarDays(today, COURSE_WEATHER_HORIZON_DAYS)) {
    return {
      kind: "response",
      body: { status: "too_early", raceId, raceDate, availableFrom: addCalendarDays(raceDate, -COURSE_WEATHER_HORIZON_DAYS) },
    };
  }

  const [waves, aidRows, track] = await Promise.all([
    fetchRows(
      config,
      `race_start_waves?race_id=eq.${encodeURIComponent(raceId)}&select=start_time&order=start_time.asc&limit=1`,
      startWaveSchema,
    ),
    fetchRows(
      config,
      `race_aid_stations?race_id=eq.${encodeURIComponent(raceId)}&select=name,km,order_index&order=order_index.asc`,
      aidStationSchema,
    ),
    race.gpx_storage_path ? loadTrack(config, race.gpx_storage_path) : Promise.resolve(null),
  ]);

  // The earliest SAS is authoritative when present (docs/02-database/tables/race-start-waves.md).
  const officialStart = normalizeCourseWeatherClock(waves[0]?.start_time) ?? scheduleStartTime(race.organizer_details);
  const startTimeIsEstimated = officialStart === null;
  const startAt = zonedLocalTimeToUtc(raceDate, officialStart ?? DEFAULT_COURSE_WEATHER_START_TIME, timeZone);
  if (!startAt) return { kind: "response", body: { status: "unavailable", raceId, reason: "no_date" } };

  let specs: CourseWeatherPointSpec[] = [];
  if (track) {
    specs = selectCourseWeatherPoints({
      track,
      aidStations: aidRows.map((row, index) => ({ name: row.name, km: row.km, orderIndex: row.order_index ?? index })),
      finishDistanceKm: race.distance_km ?? null,
    });
  } else if (typeof race.start_lat === "number" && typeof race.start_lng === "number") {
    specs = [startOnlyCourseWeatherPoint(race.start_lat, race.start_lng)];
  }
  if (specs.length === 0) return { kind: "response", body: { status: "unavailable", raceId, reason: "no_route" } };

  const window = {
    start: new Date(Math.floor((startAt.getTime() - COURSE_WEATHER_WINDOW_BEFORE_MS) / HOUR_MS) * HOUR_MS),
    end: new Date(startAt.getTime() + COURSE_WEATHER_WINDOW_AFTER_MS),
  };
  const forecasts = await mapWithConcurrency(specs, MET_CONCURRENCY, (spec) => fetchMetNorwayPointForecast(spec, window));
  const points: CourseWeatherPoint[] = specs.flatMap((spec, index) => {
    const forecast = forecasts[index];
    return forecast ? [{ ...spec, hours: forecast.hours }] : [];
  });
  if (points.length === 0) return { kind: "response", body: { status: "unavailable", raceId, reason: "provider_error" } };

  // MET answered but publishes nothing for the window yet (start near the end of its horizon).
  if (points.every((point) => point.hours.length === 0)) {
    return {
      kind: "response",
      body: startAt.getTime() > now.getTime()
        ? { status: "too_early", raceId, raceDate, availableFrom: addCalendarDays(today, 1) }
        : { status: "unavailable", raceId, reason: "past" },
    };
  }

  const allHours = points.flatMap((point) => point.hours.map((hour) => Date.parse(hour.time)));
  const fetchedAt = now.getTime();
  const expiries = forecasts.flatMap((forecast) => (forecast?.expiresAt && forecast.expiresAt > fetchedAt ? [forecast.expiresAt] : []));
  const expiresAt = expiries.length > 0 ? Math.min(...expiries) : fetchedAt + HOUR_MS;
  const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");

  return {
    kind: "response",
    body: {
      status: "forecast",
      raceId,
      raceDate,
      startAt: iso(startAt.getTime()),
      startTimeIsEstimated,
      timeZone,
      windowStart: iso(Math.max(window.start.getTime(), Math.min(...allHours))),
      windowEnd: iso(Math.min(window.end.getTime(), Math.max(...allHours) + HOUR_MS)),
      fetchedAt: iso(fetchedAt),
      expiresAt: iso(expiresAt),
      source: COURSE_WEATHER_SOURCE,
      points: points.sort((a, b) => a.distanceKm - b.distanceKm),
    },
  };
}

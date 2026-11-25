/**
 * Mobile side of "weather along the course" (lot 1): fetch of `GET /api/race-weather`, cache
 * freshness and the pure row building used by the Livret coureur and the plan recap.
 * Display-only: nothing here feeds pacing or nutrition (docs/05-integrations/met-norway-weather.md).
 * The file-system device copy lives in `components/course-weather/useCourseWeather.ts`; this file
 * stays runtime-agnostic so it can be tested.
 */
import {
  courseWeatherAtPassages,
  courseWeatherFeelsLikeC,
  courseWeatherHourAlerts,
  courseWeatherHourAt,
  courseWeatherHoursBetween,
  courseWeatherLikelyPassageHours,
  courseWeatherLikelyPassageWindow,
  nearestCourseWeatherPoint,
  summarizeCourseWeatherHours,
  type CourseWeatherAlert,
  type CourseWeatherAtPassage,
  type CourseWeatherForecast,
  type CourseWeatherHour,
  type CourseWeatherPoint,
  type CourseWeatherPointKind,
  type CourseWeatherResponse,
  type CourseWeatherSummary,
} from './courseWeatherShared';
import { resolveDepartureOffsetMinutes } from './racebookPlanReflection';
import { WEB_API_BASE_URL } from './webApi';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** A "too early" answer is re-asked at most every 6 h (or when its availability day starts). */
const TOO_EARLY_TTL_MS = 6 * HOUR_MS;
/** An "unavailable" answer is re-asked after 1 h. */
const UNAVAILABLE_TTL_MS = HOUR_MS;
/** Floor between two requests, whatever the answer says. */
const MIN_REFRESH_MS = 15 * MINUTE_MS;
/** A device copy whose race window ended more than this long ago is no longer shown. */
const PAST_FORECAST_GRACE_MS = 24 * HOUR_MS;

export type CourseWeatherEntry = {
  response: CourseWeatherResponse;
  /** ISO time of the network load that produced the entry (device copy `savedAt`). */
  savedAt: string;
};

export type CourseWeatherFetchOutcome =
  | { kind: 'ok'; response: CourseWeatherResponse }
  /** Authoritative refusal (HTTP 4xx): the race has no weather, drop any copy. */
  | { kind: 'gone' }
  /** Network failure, timeout or 5xx: keep the last good copy. */
  | { kind: 'unreachable' };

const ALERT_ORDER: CourseWeatherAlert[] = ['storm', 'snow', 'wind', 'rain', 'cold', 'heat'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Minimal shape check of an API answer; anything else is treated as unreachable. */
export function isCourseWeatherResponse(value: unknown): value is CourseWeatherResponse {
  if (!isRecord(value) || typeof value.raceId !== 'string') return false;
  if (value.status === 'forecast') {
    return Array.isArray(value.points) && isRecord(value.source) && typeof value.expiresAt === 'string'
      && typeof value.fetchedAt === 'string' && typeof value.timeZone === 'string';
  }
  if (value.status === 'too_early') return typeof value.availableFrom === 'string';
  return value.status === 'unavailable';
}

export function buildCourseWeatherUrl(raceId: string, baseUrl: string = WEB_API_BASE_URL): string {
  return `${baseUrl}/api/race-weather?raceId=${encodeURIComponent(raceId)}`;
}

export async function fetchCourseWeather(
  raceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CourseWeatherFetchOutcome> {
  try {
    const response = await fetchImpl(buildCourseWeatherUrl(raceId), { headers: { Accept: 'application/json' } });
    if (response.status >= 500) return { kind: 'unreachable' };
    if (!response.ok) return { kind: 'gone' };
    const payload: unknown = await response.json();
    return isCourseWeatherResponse(payload) ? { kind: 'ok', response: payload } : { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}

/** Instant (ms) before which the entry must not be refetched. */
export function courseWeatherRefreshAt(entry: CourseWeatherEntry): number {
  const savedAt = Date.parse(entry.savedAt);
  const base = Number.isFinite(savedAt) ? savedAt : 0;
  const { response } = entry;
  let next: number;
  if (response.status === 'forecast') {
    const expires = Date.parse(response.expiresAt);
    next = Number.isFinite(expires) ? expires : base + HOUR_MS;
  } else if (response.status === 'too_early') {
    const available = Date.parse(`${response.availableFrom}T00:00:00Z`);
    next = Number.isFinite(available) ? Math.min(base + TOO_EARLY_TTL_MS, available) : base + TOO_EARLY_TTL_MS;
  } else {
    next = base + UNAVAILABLE_TTL_MS;
  }
  return Math.max(next, base + MIN_REFRESH_MS);
}

export function isCourseWeatherEntryFresh(entry: CourseWeatherEntry, now: Date = new Date()): boolean {
  return now.getTime() < courseWeatherRefreshAt(entry);
}

export type CourseWeatherResolution = {
  entry: CourseWeatherEntry | null;
  /** True when the shown entry is an older copy kept because the refresh failed. */
  stale: boolean;
  persist: 'write' | 'remove' | 'keep';
};

/**
 * Merges a refresh outcome with the entry already shown. A forecast or a "too early" answer
 * replaces the copy; a provider error keeps the last good forecast; an authoritative refusal
 * (4xx, no date, no route, past race) drops it; a network failure keeps whatever was shown.
 */
export function resolveCourseWeatherRefresh(
  previous: CourseWeatherEntry | null,
  outcome: CourseWeatherFetchOutcome,
  now: Date = new Date(),
): CourseWeatherResolution {
  if (outcome.kind === 'unreachable') return { entry: previous, stale: Boolean(previous), persist: 'keep' };
  if (outcome.kind === 'gone') return { entry: null, stale: false, persist: 'remove' };
  const entry: CourseWeatherEntry = { response: outcome.response, savedAt: now.toISOString() };
  if (outcome.response.status !== 'unavailable') return { entry, stale: false, persist: 'write' };
  if (outcome.response.reason === 'provider_error') {
    return previous?.response.status === 'forecast'
      ? { entry: previous, stale: true, persist: 'keep' }
      : { entry, stale: false, persist: 'keep' };
  }
  return { entry, stale: false, persist: 'remove' };
}

export type CourseWeatherDisplayState =
  | { kind: 'hidden' }
  | { kind: 'too_early'; availableFrom: string }
  | { kind: 'forecast'; forecast: CourseWeatherForecast };

/** What the Météo card shows: nothing for `unavailable` or a long-past copy. */
export function selectCourseWeatherDisplay(
  entry: CourseWeatherEntry | null,
  now: Date = new Date(),
): CourseWeatherDisplayState {
  const response = entry?.response;
  if (!response) return { kind: 'hidden' };
  if (response.status === 'too_early') return { kind: 'too_early', availableFrom: response.availableFrom };
  if (response.status !== 'forecast' || response.points.length === 0) return { kind: 'hidden' };
  const windowEnd = Date.parse(response.windowEnd);
  if (Number.isFinite(windowEnd) && now.getTime() > windowEnd + PAST_FORECAST_GRACE_MS) return { kind: 'hidden' };
  return { kind: 'forecast', forecast: response };
}

/** Ionicons glyph for a MET Norway `symbol_code` (existing icon set, no new asset). */
export type CourseWeatherIconName =
  | 'sunny-outline'
  | 'moon-outline'
  | 'partly-sunny-outline'
  | 'cloudy-night-outline'
  | 'cloudy-outline'
  | 'cloud-outline'
  | 'rainy-outline'
  | 'snow-outline'
  | 'thunderstorm-outline';

export function courseWeatherIconName(symbol: string | null | undefined): CourseWeatherIconName {
  if (!symbol) return 'cloud-outline';
  const night = symbol.endsWith('_night') || symbol.endsWith('_polartwilight');
  if (symbol.includes('thunder')) return 'thunderstorm-outline';
  if (symbol.includes('snow') || symbol.includes('sleet')) return 'snow-outline';
  if (symbol.includes('rain')) return 'rainy-outline';
  if (symbol.startsWith('fog')) return 'cloud-outline';
  if (symbol.startsWith('cloudy')) return 'cloudy-outline';
  if (symbol.startsWith('partlycloudy') || symbol.startsWith('fair')) return night ? 'cloudy-night-outline' : 'partly-sunny-outline';
  if (symbol.startsWith('clearsky')) return night ? 'moon-outline' : 'sunny-outline';
  return 'cloud-outline';
}

export function sortCourseWeatherAlerts(alerts: Iterable<CourseWeatherAlert>): CourseWeatherAlert[] {
  const set = new Set(alerts);
  return ALERT_ORDER.filter((alert) => set.has(alert));
}

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const maxOf = (values: (number | null | undefined)[]): number | null => {
  const known = values.filter(isNumber);
  return known.length ? Math.max(...known) : null;
};

export type CourseWeatherPointRow = {
  id: string;
  kind: CourseWeatherPointKind;
  name: string | null;
  distanceKm: number;
  icon: CourseWeatherIconName;
  summary: CourseWeatherSummary;
  minFeelsLikeC: number | null;
  maxFeelsLikeC: number | null;
  /** Highest sustained wind of the window (km/h). */
  maxWindSpeedKph: number | null;
  /** Highest real gust (km/h); `null` when the source gives no gusts (often in France). */
  maxWindGustKph: number | null;
  alerts: CourseWeatherAlert[];
};

type CourseWeatherHoursSummary = Pick<
  CourseWeatherPointRow,
  'icon' | 'summary' | 'minFeelsLikeC' | 'maxFeelsLikeC' | 'maxWindSpeedKph' | 'maxWindGustKph' | 'alerts'
>;

/** Summary of a set of hours: worst sky glyph, temperature and feels-like range, max wind, alerts. */
function summarizeCourseWeatherWindowHours(hours: CourseWeatherHour[]): CourseWeatherHoursSummary {
  const summary = summarizeCourseWeatherHours(hours);
  const feelsLike = hours.map((hour) => courseWeatherFeelsLikeC(hour)).filter(isNumber);
  return {
    // The dominant symbol is a real hour of the window, so its MET `_day` / `_night` suffix follows that hour.
    icon: courseWeatherIconName(summary.dominantSymbol),
    summary,
    minFeelsLikeC: feelsLike.length ? Math.min(...feelsLike) : null,
    maxFeelsLikeC: feelsLike.length ? Math.max(...feelsLike) : null,
    maxWindSpeedKph: maxOf(hours.map((hour) => hour.windSpeedKph)),
    maxWindGustKph: maxOf(hours.map((hour) => hour.windGustKph)),
    alerts: sortCourseWeatherAlerts(hours.flatMap((hour) => courseWeatherHourAlerts(hour))),
  };
}

/** Summary of every course point over the hours the field is likely to pass it (no runner ETA). */
export function buildCourseWeatherPointRows(
  forecast: Pick<CourseWeatherForecast, 'points'> & Partial<Pick<CourseWeatherForecast, 'startAt'>>,
): CourseWeatherPointRow[] {
  return forecast.points.map((point) => ({
    id: point.id,
    kind: point.kind,
    name: point.name,
    distanceKm: point.distanceKm,
    // Likely passage hours of the field, not the whole 48 h forecast window.
    ...summarizeCourseWeatherWindowHours(courseWeatherLikelyPassageHours(point, forecast.startAt ?? null)),
  }));
}

export type CourseWeatherPlanCheckpoint = { index: number; distanceKm: number; arrivalMinute: number };

export type CourseWeatherPassageLine = {
  /** Plan checkpoint index. */
  index: number;
  at: string;
  hour: CourseWeatherHour | null;
  icon: CourseWeatherIconName;
  feelsLikeC: number | null;
  alerts: CourseWeatherAlert[];
};

/**
 * Weather at each planned passage of a plan linked to a catalog race, from the runner's own
 * departure instant (manual start or official start) plus the planned elapsed minutes.
 */
export function buildCourseWeatherPassageLines(
  forecast: Pick<CourseWeatherForecast, 'points'>,
  checkpoints: CourseWeatherPlanCheckpoint[],
  departureAt: Date | string | null,
): Map<number, CourseWeatherPassageLine> {
  const lines = new Map<number, CourseWeatherPassageLine>();
  const startAt = departureAt instanceof Date ? departureAt.toISOString() : departureAt;
  if (!startAt || checkpoints.length === 0) return lines;
  for (const checkpoint of checkpoints) {
    // One passage per call keeps the checkpoint ↔ result pairing explicit (the helper skips
    // passages without a forecast point or a finite elapsed time).
    const [result]: CourseWeatherAtPassage[] = courseWeatherAtPassages(
      { startAt, points: forecast.points },
      [{ distanceKm: checkpoint.distanceKm, elapsedMinutes: checkpoint.arrivalMinute }],
    );
    if (!result) continue;
    lines.set(checkpoint.index, {
      index: checkpoint.index,
      at: result.at,
      hour: result.hour,
      icon: courseWeatherIconName(result.hour?.symbol),
      feelsLikeC: result.feelsLikeC,
      alerts: sortCourseWeatherAlerts(result.alerts),
    });
  }
  return lines;
}

/** A row farther than this (km) from every forecast point shows no weather. */
export const COURSE_WEATHER_POINT_MATCH_TOLERANCE_KM = 2;

/**
 * Forecast point of one course row (aid station, start, finish, supporter stop). The point with the
 * row's id (`start`, `finish`, `aid-<order_index>`) wins when its distance agrees; otherwise the
 * nearest point within `toleranceKm` (station dropped by the 15-point thinning or merged into the
 * start/finish); otherwise `null` and the row shows nothing.
 */
export function matchCourseWeatherPoint(
  points: CourseWeatherPoint[],
  row: { pointId?: string | null; distanceKm: number },
  toleranceKm: number = COURSE_WEATHER_POINT_MATCH_TOLERANCE_KM,
): CourseWeatherPoint | null {
  if (!Number.isFinite(row.distanceKm)) return null;
  const byId = row.pointId ? points.find((point) => point.id === row.pointId) : undefined;
  if (byId && Math.abs(byId.distanceKm - row.distanceKm) <= toleranceKm) return byId;
  const nearest = nearestCourseWeatherPoint(points, row.distanceKm);
  return nearest && Math.abs(nearest.distanceKm - row.distanceKm) <= toleranceKm ? nearest : null;
}

const DAY_MS = 24 * HOUR_MS;

function isoDayNumber(day: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '');
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS : null;
}

function clockMinutes(clock: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(clock?.trim() ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/**
 * Local day (as a UTC day number) and minute of the day of an instant in the race zone. Falls back
 * to device time when Hermes cannot format the zone, like `formatCourseWeatherClock`.
 */
function localClockParts(instantMs: number, timeZone: string): { dayNumber: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instantMs));
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const [year, month, day, hour, minute] = [value('year'), value('month'), value('day'), value('hour'), value('minute')];
    if ([year, month, day, hour, minute].every(Number.isFinite)) {
      return { dayNumber: Date.UTC(year, month - 1, day) / DAY_MS, minutes: (hour % 24) * 60 + minute };
    }
  } catch {
    // Device time below.
  }
  const local = new Date(instantMs);
  return {
    dayNumber: Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) / DAY_MS,
    minutes: local.getHours() * 60 + local.getMinutes(),
  };
}

/** Organizer race-day clock: `date` wins, else race day + `dayOffset` (Livret supporter cutoffs and arrivals). */
export type CourseWeatherRaceClock = { date?: string | null; time: string; dayOffset?: number | null };

/**
 * UTC instant of a local race-day clock, anchored on the forecast's official start (`startAt`,
 * already computed in the race zone by the API): `startAt + (clock − local clock of startAt)`.
 * A DST change between the start and the clock is ignored (at most one hour, display only).
 */
export function courseWeatherInstantAt(
  forecast: Pick<CourseWeatherForecast, 'startAt' | 'raceDate' | 'timeZone'>,
  clock: CourseWeatherRaceClock | null | undefined,
): Date | null {
  const startMs = forecast.startAt ? Date.parse(forecast.startAt) : Number.NaN;
  const minutes = clockMinutes(clock?.time);
  if (!clock || !Number.isFinite(startMs) || minutes === null) return null;
  const raceDay = isoDayNumber(forecast.raceDate);
  const targetDay = clock.date ? isoDayNumber(clock.date) : raceDay === null ? null : raceDay + (clock.dayOffset ?? 0);
  if (targetDay === null) return null;
  const reference = localClockParts(startMs, forecast.timeZone);
  const deltaMinutes = (targetDay - reference.dayNumber) * 24 * 60 + minutes - reference.minutes;
  return new Date(startMs + deltaMinutes * MINUTE_MS);
}

/**
 * Runner's departure instant: the forecast's official start shifted by the personal departure
 * clock (same ±12 h rule as the Livret cutoffs, `resolveDepartureOffsetMinutes`). The official
 * start itself when no clock is known.
 */
export function courseWeatherDepartureAt(
  forecast: Pick<CourseWeatherForecast, 'startAt' | 'timeZone'>,
  departureClock: string | null | undefined,
): Date | null {
  const startMs = forecast.startAt ? Date.parse(forecast.startAt) : Number.NaN;
  if (!Number.isFinite(startMs)) return null;
  if (clockMinutes(departureClock) === null) return new Date(startMs);
  const reference = localClockParts(startMs, forecast.timeZone).minutes;
  const referenceClock = `${String(Math.floor(reference / 60)).padStart(2, '0')}:${String(reference % 60).padStart(2, '0')}`;
  return new Date(startMs + resolveDepartureOffsetMinutes(departureClock, referenceClock) * MINUTE_MS);
}

/** Weather shown inside one course row: one forecast hour at a planned passage, or a passage window summary. */
export type CourseWeatherInlineLine =
  | {
    kind: 'passage';
    pointId: string;
    /** Planned passage instant (UTC ISO). */
    at: string;
    hour: CourseWeatherHour;
    icon: CourseWeatherIconName;
    feelsLikeC: number | null;
    alerts: CourseWeatherAlert[];
  }
  | ({
    kind: 'window';
    pointId: string;
    /** Covered window (UTC ISO), clipped to the forecast hours. */
    from: string;
    to: string;
  } & CourseWeatherHoursSummary);

export type CourseWeatherRowPassage = {
  key: string;
  pointId?: string | null;
  distanceKm: number;
  /** Planned elapsed minutes since the runner's departure; `null` skips the row. */
  arrivalMinute: number | null;
};

/**
 * Weather at the runner's own passage of each row (Livret coureur with a linked plan). Rows
 * without a matched point or outside the forecast are absent from the result.
 */
export function buildCourseWeatherRowPassages(
  forecast: Pick<CourseWeatherForecast, 'points'>,
  rows: CourseWeatherRowPassage[],
  departureAt: Date | null,
): Record<string, CourseWeatherInlineLine> {
  const lines: Record<string, CourseWeatherInlineLine> = {};
  const departureMs = departureAt?.getTime() ?? Number.NaN;
  if (!Number.isFinite(departureMs)) return lines;
  for (const row of rows) {
    if (row.arrivalMinute === null || !Number.isFinite(row.arrivalMinute) || row.arrivalMinute < 0) continue;
    const point = matchCourseWeatherPoint(forecast.points, row);
    if (!point) continue;
    const at = new Date(departureMs + row.arrivalMinute * MINUTE_MS);
    const hour = courseWeatherHourAt(point, at);
    if (!hour) continue;
    lines[row.key] = {
      kind: 'passage',
      pointId: point.id,
      at: at.toISOString(),
      hour,
      // Each forecast hour carries its own MET `_day` / `_night` symbol, so the glyph follows the passage hour.
      icon: courseWeatherIconName(hour.symbol),
      feelsLikeC: courseWeatherFeelsLikeC(hour),
      alerts: sortCourseWeatherAlerts(courseWeatherHourAlerts(hour)),
    };
  }
  return lines;
}

export type CourseWeatherRowWindow = {
  key: string;
  pointId?: string | null;
  distanceKm: number;
  /** Window start; the field's likely first passage when absent. */
  from?: Date | null;
  /** Window end; the field's likely last passage when absent. */
  to?: Date | null;
};

/**
 * Weather summary over the window runners pass each row: explicit bounds (Livret supporter first
 * arrival / cutoff) or the field's likely passage window (`courseWeatherLikelyPassageWindow`).
 * An end before the start is widened to one hour. Rows without hours are absent.
 */
export function buildCourseWeatherRowWindows(
  forecast: Pick<CourseWeatherForecast, 'points' | 'startAt'>,
  rows: CourseWeatherRowWindow[],
): Record<string, CourseWeatherInlineLine> {
  const lines: Record<string, CourseWeatherInlineLine> = {};
  for (const row of rows) {
    const point = matchCourseWeatherPoint(forecast.points, row);
    if (!point) continue;
    const field = courseWeatherLikelyPassageWindow(row.distanceKm, forecast.startAt);
    const from = row.from ?? field?.from ?? null;
    let to = row.to ?? field?.to ?? null;
    if (!from || !to || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) continue;
    if (to.getTime() < from.getTime()) to = new Date(from.getTime() + HOUR_MS);
    const hours = courseWeatherHoursBetween(point, from, to);
    if (hours.length === 0) continue;
    const firstHour = Date.parse(hours[0].time);
    const lastHourEnd = Date.parse(hours[hours.length - 1].time) + HOUR_MS;
    lines[row.key] = {
      kind: 'window',
      pointId: point.id,
      from: new Date(Math.max(from.getTime(), firstHour)).toISOString(),
      to: new Date(Math.min(to.getTime(), lastHourEnd)).toISOString(),
      ...summarizeCourseWeatherWindowHours(hours),
    };
  }
  return lines;
}

/** True when the device can format a clock in `timeZone` (Hermes Intl may reject some zones). */
export function supportsCourseWeatherTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * True when hours are shown in device time although the race uses another zone (the UI then says
 * so). False when the race zone is supported or equals the device zone.
 */
export function usesDeviceTimeFallback(timeZone: string): boolean {
  if (supportsCourseWeatherTimeZone(timeZone)) return false;
  return deviceTimeZone() !== timeZone;
}

const localeTag = (locale: 'fr' | 'en') => (locale === 'fr' ? 'fr-FR' : 'en-GB');

/** Local clock (`HH:mm`) of an UTC instant in the race zone, device time when unsupported. */
export function formatCourseWeatherClock(iso: string, timeZone: string, locale: 'fr' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  try {
    return new Intl.DateTimeFormat(localeTag(locale), { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(localeTag(locale), options).format(date);
  }
}

/** Short day + clock of the forecast fetch time, in device time (`Prévision du {date}`). */
export function formatCourseWeatherFetchedAt(iso: string, locale: 'fr' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tag = localeTag(locale);
  const day = date.toLocaleDateString(tag, { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${time}`;
}

/** `YYYY-MM-DD` local day as a readable date (`29 novembre`). */
export function formatCourseWeatherDay(day: string, locale: 'fr' | 'en'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.toLocaleDateString(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatCourseWeatherTemperature(value: number | null | undefined): string | null {
  return isNumber(value) ? `${Math.round(value)}°` : null;
}

export function formatCourseWeatherRange(min: number | null, max: number | null): string | null {
  const low = formatCourseWeatherTemperature(min);
  const high = formatCourseWeatherTemperature(max);
  if (!low || !high) return low ?? high;
  return low === high ? low : `${low} / ${high}`;
}

// Race-local time helpers for the course weather endpoint. Intl only (no time-zone library):
// the race date and the organizer start time are local clock values that must become UTC
// instants, across daylight-saving changes.

export const DEFAULT_COURSE_WEATHER_TIME_ZONE = "Europe/Paris";
export const DEFAULT_COURSE_WEATHER_START_TIME = "07:00";

/** French overseas regions, keyed by INSEE region code (`race_events.location_region_code`). */
const FRENCH_OVERSEAS_BY_REGION: Record<string, string> = {
  "01": "America/Guadeloupe",
  "02": "America/Martinique",
  "03": "America/Cayenne",
  "04": "Indian/Reunion",
  "06": "Indian/Mayotte",
};

/** One IANA zone per country; multi-zone countries use their mainland/most common zone. */
const ZONE_BY_COUNTRY: Record<string, string> = {
  FR: "Europe/Paris",
  MC: "Europe/Monaco",
  AD: "Europe/Andorra",
  BE: "Europe/Brussels",
  LU: "Europe/Luxembourg",
  CH: "Europe/Zurich",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
  NL: "Europe/Amsterdam",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  NO: "Europe/Oslo",
  SE: "Europe/Stockholm",
  FI: "Europe/Helsinki",
  DK: "Europe/Copenhagen",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
  SK: "Europe/Bratislava",
  SI: "Europe/Ljubljana",
  HR: "Europe/Zagreb",
  GR: "Europe/Athens",
  // French overseas departments when stored with their own ISO country code.
  GP: "America/Guadeloupe",
  MQ: "America/Martinique",
  GF: "America/Cayenne",
  RE: "Indian/Reunion",
  YT: "Indian/Mayotte",
  NC: "Pacific/Noumea",
  PF: "Pacific/Tahiti",
};

/** IANA time zone of a race from its event country / INSEE region codes. Defaults to Europe/Paris. */
export function courseWeatherTimeZone(countryCode: string | null | undefined, regionCode: string | null | undefined): string {
  const country = countryCode?.trim().toUpperCase() || null;
  const region = regionCode?.trim() || null;
  if ((!country || country === "FR") && region && FRENCH_OVERSEAS_BY_REGION[region]) return FRENCH_OVERSEAS_BY_REGION[region];
  return (country && ZONE_BY_COUNTRY[country]) || DEFAULT_COURSE_WEATHER_TIME_ZONE;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const zonedFormatter = (timeZone: string) => {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
};

const zonedParts = (instantMs: number, timeZone: string) => {
  const parts: Record<string, number> = {};
  for (const part of zonedFormatter(timeZone).formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
};

/** Offset (ms) of `timeZone` from UTC at `instantMs` (positive east of Greenwich). */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/** Normalizes an organizer clock text (`7:30`, `07h30`, `7h`, `07:30:00`) to `HH:MM`, or `null`. */
export function normalizeCourseWeatherClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * UTC instant of a local wall-clock time (`YYYY-MM-DD` + `HH:MM`) in `timeZone`. A time skipped
 * by a spring-forward change resolves one hour later; an ambiguous fall-back time resolves to the
 * first occurrence.
 */
export function zonedLocalTimeToUtc(date: string, clock: string, timeZone: string): Date | null {
  const dateMatch = DATE_PATTERN.exec(date);
  const normalizedClock = normalizeCourseWeatherClock(clock);
  if (!dateMatch || !normalizedClock) return null;
  const [hours, minutes] = normalizedClock.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes);
  if (!Number.isFinite(wallClockAsUtc)) return null;
  // Try both offsets around the guess; keep the earliest candidate that reads back as the wall clock.
  const offsets = new Set([
    zoneOffsetMs(wallClockAsUtc - 12 * 3_600_000, timeZone),
    zoneOffsetMs(wallClockAsUtc, timeZone),
    zoneOffsetMs(wallClockAsUtc + 12 * 3_600_000, timeZone),
  ]);
  const candidates = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((instant) => zoneOffsetMs(instant, timeZone) === wallClockAsUtc - instant)
    .sort((a, b) => a - b);
  if (candidates.length > 0) return new Date(candidates[0]);
  // Spring-forward gap: the wall clock does not exist; shift by the pre-transition offset.
  return new Date(wallClockAsUtc - zoneOffsetMs(wallClockAsUtc - 12 * 3_600_000, timeZone));
}

/** Local calendar day (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function zonedLocalDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant.getTime(), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Calendar arithmetic on `YYYY-MM-DD` strings (no time zone involved). */
export function addCalendarDays(date: string, days: number): string {
  const match = DATE_PATTERN.exec(date);
  if (!match) return date;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return value.toISOString().slice(0, 10);
}

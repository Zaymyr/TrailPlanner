// Contract of `GET /api/race-weather?raceId=<uuid>` shared by the web app and the mobile app.
// Source: MET Norway Locationforecast 2.0 (free, CC BY 4.0, attribution required).
// Display-only: these values never feed the pacing or nutrition calculations (see
// docs/05-integrations/met-norway-weather.md).

export type CourseWeatherPointKind = 'start' | 'aid_station' | 'summit' | 'finish';

/** One forecast hour at one course point. Every value can be missing in the source. */
export type CourseWeatherHour = {
  /** Start of the hour, ISO 8601 in UTC (e.g. `2026-11-29T07:00:00Z`). */
  time: string;
  temperatureC: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  /** Direction the wind blows FROM, in degrees (0 = north). */
  windFromDeg: number | null;
  /** Precipitation expected during this hour, in mm. */
  precipitationMm: number | null;
  /** 0–100. */
  precipitationProbability: number | null;
  /** 0–100. */
  relativeHumidity: number | null;
  /** 0–100. */
  cloudCover: number | null;
  /** MET Norway `symbol_code` (e.g. `clearsky_day`, `lightrain`, `heavyrainandthunder`). */
  symbol: string | null;
};

export type CourseWeatherPoint = {
  /** Stable within a response: `start`, `finish`, `summit`, `aid-<order>`. */
  id: string;
  kind: CourseWeatherPointKind;
  /** Aid station name; `null` for start, finish and summit (the UI labels them). */
  name: string | null;
  distanceKm: number;
  latitude: number;
  longitude: number;
  /** Altitude sent to MET Norway for the temperature correction, from the GPX. */
  altitudeM: number | null;
  /** Hours covering the race window, sorted by time. */
  hours: CourseWeatherHour[];
};

export type CourseWeatherSource = {
  provider: 'met_norway';
  /** Text to show next to any weather display (license requirement). */
  attribution: string;
  url: string;
};

export type CourseWeatherForecast = {
  status: 'forecast';
  raceId: string;
  /** Local race day, `YYYY-MM-DD`. */
  raceDate: string;
  /** Official start instant in UTC, or `null` when the race has no start time. */
  startAt: string | null;
  /** True when `startAt` uses the 07:00 local default because the organizer gave no start time. */
  startTimeIsEstimated: boolean;
  /** IANA time zone of the race, used to display local hours. */
  timeZone: string;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
  /** Do not refetch before this instant (MET Norway `Expires`). */
  expiresAt: string;
  source: CourseWeatherSource;
  /** Sorted by `distanceKm`. */
  points: CourseWeatherPoint[];
};

export type CourseWeatherTooEarly = {
  status: 'too_early';
  raceId: string;
  raceDate: string;
  /** First local day (`YYYY-MM-DD`) when the forecast becomes available. */
  availableFrom: string;
};

export type CourseWeatherUnavailableReason = 'no_date' | 'no_route' | 'past' | 'provider_error';

export type CourseWeatherUnavailable = {
  status: 'unavailable';
  raceId: string;
  reason: CourseWeatherUnavailableReason;
};

export type CourseWeatherResponse = CourseWeatherForecast | CourseWeatherTooEarly | CourseWeatherUnavailable;

/** Days ahead covered by MET Norway Locationforecast. */
export const COURSE_WEATHER_HORIZON_DAYS = 9;

export type CourseWeatherSummary = {
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  maxWindGustKph: number | null;
  totalPrecipitationMm: number | null;
  maxPrecipitationProbability: number | null;
  /** Most severe symbol of the period (thunder > snow > rain > fog > cloud > clear). */
  dominantSymbol: string | null;
};

export type CourseWeatherAlert = 'heat' | 'cold' | 'wind' | 'rain' | 'storm' | 'snow';

export type CourseWeatherPassage = {
  distanceKm: number;
  /** Planned elapsed time since the start, in minutes (from the plan chronology). */
  elapsedMinutes: number;
};

export type CourseWeatherAtPassage = {
  passage: CourseWeatherPassage;
  point: CourseWeatherPoint;
  /** Expected passage instant (UTC ISO). */
  at: string;
  hour: CourseWeatherHour | null;
  feelsLikeC: number | null;
  alerts: CourseWeatherAlert[];
};

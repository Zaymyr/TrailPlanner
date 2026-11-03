import type { VideoAidStation } from "../../../lib/video-generator";
import { getRoutePointAtDistance, type PreparedAnimationPath } from "./route-animation";

/**
 * Approximate race clock: when a mid-pack runner passes each kilometre, from a classic pace that
 * depends on the effort-distance (km + D+ / 100 + D- / 400), stops at stations, and pulled earlier
 * where organizer cutoffs show the estimate is too slow. It only drives the day/night look and
 * the story, never anything a runner relies on.
 */
export type RaceClock = {
  startUtcMs: number;
  distancesKm: number[];
  elapsedMinutes: number[];
  lat: number;
  lon: number;
};

export type Daylight = {
  /** Local time of day, minutes since midnight. */
  minutesOfDay: number;
  /** 0 at night, 1 in full daylight. */
  level: number;
  /** Peaks at sunrise and sunset, for a warm tint. */
  warmth: number;
  sunAzimuthDeg: number;
  isNight: boolean;
  isMorning: boolean;
};

export const RACE_TIME_ZONE = "Europe/Paris";
const AID_STOP_MINUTES = 3;
const LIFE_BASE_STOP_MINUTES = 15;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** "23:30", "7h05" or "07:00:00" → minutes since midnight. */
export const parseClockTime = (value: string | null | undefined) => {
  const match = value?.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
};

export const formatClockTime = (minutesOfDay: number) => {
  const minutes = ((Math.round(minutesOfDay) % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/** Offset of a time zone from UTC at an instant, in minutes (Paris: +60 in winter, +120 in summer). */
const formatters = new Map<string, Intl.DateTimeFormat>();
export const getTimeZoneOffsetMinutes = (utcMs: number, timeZone = RACE_TIME_ZONE) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(utcMs));
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return Math.round((Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute")) - utcMs) / 60_000);
};

/** Classic mid-pack speed in effort-km per hour: about 10 on a 20 km trail, 8.4 on 80 km / 2,300 m, 7.4 on an ultra. */
export const getClassicEffortSpeed = (effortKm: number) => clamp(11 - 1.1 * Math.log(Math.max(effortKm, 10) / 10), 4.5, 11);

export const buildRaceClock = (
  path: PreparedAnimationPath,
  stations: VideoAidStation[],
  race: { raceDate?: string | null; startTime?: string | null },
): RaceClock | null => {
  const startMinutes = parseClockTime(race.startTime);
  if (startMinutes === null || !path.canAnimate) return null;
  const { samples } = path;

  const effort = [0];
  for (let index = 1; index < samples.length; index += 1) {
    const stepKm = samples[index].distanceKm - samples[index - 1].distanceKm;
    const deltaM = samples[index].elevationM - samples[index - 1].elevationM;
    effort.push(effort[index - 1] + stepKm + Math.max(0, deltaM) / 100 + Math.max(0, -deltaM) / 400);
  }
  const speed = getClassicEffortSpeed(effort[effort.length - 1] ?? 0);
  const sortedStations = [...stations].sort((left, right) => left.distanceKm - right.distanceKm);
  const stopsBefore = (distanceKm: number) => sortedStations
    .filter((station) => station.distanceKm < distanceKm)
    .reduce((sum, station) => sum + (station.isLifeBase ? LIFE_BASE_STOP_MINUTES : AID_STOP_MINUTES), 0);
  const estimate = samples.map((sample, index) => (effort[index] / speed) * 60 + stopsBefore(sample.distanceKm));
  const distancesKm = samples.map((sample) => sample.distanceKm);
  const estimateAt = (distanceKm: number) => {
    const index = distancesKm.findIndex((value) => value >= distanceKm);
    return estimate[index < 0 ? estimate.length - 1 : index];
  };

  // Cutoffs: a classic runner passes comfortably before them (85 % of the allowed time).
  const anchors: Array<{ km: number; ratio: number }> = [{ km: 0, ratio: 1 }];
  sortedStations.forEach((station) => {
    const cutoff = parseClockTime(station.cutoffTime);
    const estimated = estimateAt(station.distanceKm);
    if (cutoff === null || estimated <= 0) return;
    let allowed = cutoff - startMinutes;
    while (allowed <= 0 || allowed < estimated * 0.5) allowed += 1_440;
    anchors.push({ km: station.distanceKm, ratio: Math.min(1, (allowed * 0.85) / estimated) });
  });
  const ratioAt = (distanceKm: number) => {
    const after = anchors.findIndex((anchor) => anchor.km >= distanceKm);
    if (after < 0) return anchors[anchors.length - 1].ratio;
    if (after === 0) return anchors[0].ratio;
    const before = anchors[after - 1];
    const next = anchors[after];
    const t = next.km > before.km ? (distanceKm - before.km) / (next.km - before.km) : 1;
    return before.ratio + (next.ratio - before.ratio) * t;
  };

  const dateMatch = race.raceDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const today = new Date();
  const [year, month, day] = dateMatch
    ? [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])]
    : [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()];
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  const offset = getTimeZoneOffsetMinutes(localMidnightAsUtc + 12 * 3_600_000);
  const start = getRoutePointAtDistance(path, 0);

  return {
    startUtcMs: localMidnightAsUtc + (startMinutes - offset) * 60_000,
    distancesKm,
    elapsedMinutes: estimate.map((value, index) => value * ratioAt(distancesKm[index])),
    lat: start.lat,
    lon: start.lon,
  };
};

export const getElapsedMinutes = (clock: RaceClock, distanceKm: number) => {
  const { distancesKm, elapsedMinutes } = clock;
  if (distanceKm <= distancesKm[0]) return elapsedMinutes[0];
  const last = distancesKm.length - 1;
  if (distanceKm >= distancesKm[last]) return elapsedMinutes[last];
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (distancesKm[middle] <= distanceKm) low = middle;
    else high = middle;
  }
  const span = distancesKm[high] - distancesKm[low];
  const t = span > 0 ? (distanceKm - distancesKm[low]) / span : 0;
  return elapsedMinutes[low] + (elapsedMinutes[high] - elapsedMinutes[low]) * t;
};

/** Solar elevation and azimuth (degrees, azimuth clockwise from north), low-precision NOAA formulas. */
export const getSunPosition = (utcMs: number, lat: number, lon: number) => {
  const rad = Math.PI / 180;
  const days = (utcMs - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const meanLongitude = (280.46 + 0.9856474 * days) % 360;
  const meanAnomaly = ((357.528 + 0.9856003 * days) % 360) * rad;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * rad;
  const obliquity = (23.439 - 0.0000004 * days) * rad;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const siderealDeg = ((18.697374558 + 24.06570982441908 * days) % 24) * 15;
  const hourAngle = (siderealDeg + lon) * rad - rightAscension;
  const latitude = lat * rad;
  const elevation = Math.asin(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle));
  const azimuth = Math.atan2(-Math.sin(hourAngle), Math.tan(declination) * Math.cos(latitude) - Math.sin(latitude) * Math.cos(hourAngle));
  return { elevationDeg: elevation / rad, azimuthDeg: ((azimuth / rad) + 360) % 360 };
};

export const getDaylightAt = (clock: RaceClock, distanceKm: number): Daylight => {
  const utcMs = clock.startUtcMs + getElapsedMinutes(clock, distanceKm) * 60_000;
  const { elevationDeg, azimuthDeg } = getSunPosition(utcMs, clock.lat, clock.lon);
  // Wide twilight band: from deep night (sun 16° below) to full day (10° above).
  const level = smoothstep(-16, 10, elevationDeg);
  return {
    minutesOfDay: (utcMs / 60_000 + getTimeZoneOffsetMinutes(utcMs)) % 1_440,
    level,
    warmth: clamp(1 - Math.abs(elevationDeg + 2) / 12, 0, 1),
    sunAzimuthDeg: azimuthDeg,
    isNight: level < 0.2,
    isMorning: azimuthDeg < 180,
  };
};

/**
 * Daylight averaged over a stretch of route around the runner (±8 % of the distance), so the
 * video fades between night, dawn, day and dusk slowly instead of switching within seconds of a
 * fast flyover. The clock shown stays the estimate at the runner.
 */
export const getSmoothedDaylightAt = (clock: RaceClock, distanceKm: number): Daylight => {
  const totalKm = clock.distancesKm[clock.distancesKm.length - 1] ?? 0;
  const center = getDaylightAt(clock, distanceKm);
  const windowKm = totalKm * 0.08;
  if (windowKm <= 0) return center;
  const samples = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]
    .map((offset) => getDaylightAt(clock, clamp(distanceKm + offset * windowKm, 0, totalKm)));
  const level = samples.reduce((sum, sample) => sum + sample.level, 0) / samples.length;
  const warmth = samples.reduce((sum, sample) => sum + sample.warmth, 0) / samples.length;
  return { ...center, level, warmth, isNight: level < 0.2 };
};

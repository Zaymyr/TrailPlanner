// Course points sent to MET Norway: start, aid stations, highest point and finish.

import type { CourseWeatherPointKind } from "@trailplanner/shared";

import type { GpxPoint } from "../gpx/parseGpx";

export const COURSE_WEATHER_MAX_POINTS = 15;
/** A summit closer than this to another selected point adds no information. */
export const COURSE_WEATHER_SUMMIT_MIN_GAP_KM = 2;
/** Aid stations this close to the start or finish duplicate those points. */
export const COURSE_WEATHER_ENDPOINT_GAP_KM = 0.5;

export type CourseWeatherAidStationInput = { name: string; km: number; orderIndex: number };

export type CourseWeatherPointSpec = {
  id: string;
  kind: CourseWeatherPointKind;
  name: string | null;
  distanceKm: number;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
};

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

const toSpec = (
  base: Pick<CourseWeatherPointSpec, "id" | "kind" | "name" | "distanceKm">,
  position: { lat: number; lng: number; ele: number | null },
): CourseWeatherPointSpec => ({
  ...base,
  distanceKm: round(base.distanceKm, 2),
  latitude: round(position.lat, 4),
  longitude: round(position.lng, 4),
  altitudeM: position.ele === null ? null : Math.round(position.ele),
});

/** Position at cumulative distance `km` along the track (linear interpolation, clamped to the ends). */
export function positionAtDistance(points: GpxPoint[], km: number): { lat: number; lng: number; ele: number | null } {
  const first = points[0];
  const last = points[points.length - 1];
  if (km <= first.distKmCum) return first;
  if (km >= last.distKmCum) return last;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].distKmCum <= km) low = middle;
    else high = middle;
  }
  const a = points[low];
  const b = points[high];
  const span = b.distKmCum - a.distKmCum;
  const ratio = span > 0 ? (km - a.distKmCum) / span : 0;
  const ele = a.ele !== null && b.ele !== null ? a.ele + (b.ele - a.ele) * ratio : a.ele ?? b.ele;
  return { lat: a.lat + (b.lat - a.lat) * ratio, lng: a.lng + (b.lng - a.lng) * ratio, ele };
}

/** Evenly spread subset of `items` of size `count`, keeping the first and last. */
function thinEvenly<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (items.length <= count) return items;
  if (count === 1) return [items[Math.floor(items.length / 2)]];
  const picked = new Set<number>();
  for (let index = 0; index < count; index += 1) picked.add(Math.round((index * (items.length - 1)) / (count - 1)));
  return [...picked].sort((a, b) => a - b).map((index) => items[index]);
}

/**
 * Selects the forecast points of a course from its parsed GPX track. `finishDistanceKm` is the
 * official distance when known (the plan's passage distances use it), else the GPX length.
 */
export function selectCourseWeatherPoints(input: {
  track: GpxPoint[];
  aidStations: CourseWeatherAidStationInput[];
  finishDistanceKm: number | null;
}): CourseWeatherPointSpec[] {
  const { track } = input;
  if (track.length === 0) return [];
  const trackEnd = track[track.length - 1];
  const finishKm = input.finishDistanceKm && input.finishDistanceKm > 0 ? input.finishDistanceKm : trackEnd.distKmCum;

  const start = toSpec({ id: "start", kind: "start", name: null, distanceKm: 0 }, track[0]);
  const finish = toSpec({ id: "finish", kind: "finish", name: null, distanceKm: finishKm }, trackEnd);

  const sortedStations = input.aidStations
    .filter((station) => Number.isFinite(station.km))
    .filter((station) => station.km > COURSE_WEATHER_ENDPOINT_GAP_KM && station.km < finishKm - COURSE_WEATHER_ENDPOINT_GAP_KM)
    .sort((a, b) => a.km - b.km || a.orderIndex - b.orderIndex);
  const usedIds = new Set<string>();
  const aidStations = sortedStations.map((station, index) => {
    let id = `aid-${station.orderIndex}`;
    if (usedIds.has(id)) id = `${id}-${index}`;
    usedIds.add(id);
    return toSpec(
      { id, kind: "aid_station", name: station.name, distanceKm: station.km },
      positionAtDistance(track, station.km),
    );
  });

  let summit: CourseWeatherPointSpec | null = null;
  const highest = track.reduce<GpxPoint | null>(
    (best, point) => (point.ele !== null && (best === null || best.ele === null || point.ele > best.ele) ? point : best),
    null,
  );
  if (highest && highest.ele !== null) {
    const isDistinct = [start, finish, ...aidStations].every(
      (point) => Math.abs(point.distanceKm - highest.distKmCum) >= COURSE_WEATHER_SUMMIT_MIN_GAP_KM,
    );
    if (isDistinct) summit = toSpec({ id: "summit", kind: "summit", name: null, distanceKm: highest.distKmCum }, highest);
  }

  const aidSlots = COURSE_WEATHER_MAX_POINTS - 2 - (summit ? 1 : 0);
  return [start, ...thinEvenly(aidStations, aidSlots), ...(summit ? [summit] : []), finish].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  );
}

/** Single start point when the race has no usable GPX. */
export function startOnlyCourseWeatherPoint(latitude: number, longitude: number): CourseWeatherPointSpec {
  return toSpec({ id: "start", kind: "start", name: null, distanceKm: 0 }, { lat: latitude, lng: longitude, ele: null });
}

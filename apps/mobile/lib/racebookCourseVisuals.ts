import type { MobileGpxPreviewPoint } from './gpx';

export type CourseDistancePoint = {
  distanceKm: number;
  elevationM: number;
};

export type ProjectedRoutePoint = {
  lat: number;
  lng: number;
  distanceKm: number;
};

export type CourseProgressPoint = CourseDistancePoint & {
  elevationGainM: number;
  elevationLossM: number;
};

function findDistanceSegment<T extends { distanceKm: number }>(points: T[], distanceKm: number) {
  if (points.length < 2) return null;

  const firstDistance = points[0].distanceKm;
  const lastDistance = points[points.length - 1].distanceKm;
  if (distanceKm < firstDistance || distanceKm > lastDistance) return null;

  const safeDistance = Math.max(firstDistance, Math.min(distanceKm, lastDistance));
  const nextIndex = points.findIndex((point) => point.distanceKm >= safeDistance);
  const rightIndex = nextIndex <= 0 ? 1 : nextIndex;
  const left = points[rightIndex - 1];
  const right = points[rightIndex];
  const span = Math.max(0.000_001, right.distanceKm - left.distanceKm);

  return {
    left,
    leftIndex: rightIndex - 1,
    right,
    ratio: Math.max(0, Math.min(1, (safeDistance - left.distanceKm) / span)),
    safeDistance,
  };
}

function addElevationDelta(
  totals: Pick<CourseProgressPoint, 'elevationGainM' | 'elevationLossM'>,
  deltaM: number,
  thresholdDeltaM = deltaM,
) {
  if (Math.abs(thresholdDeltaM) < 1) return;
  if (deltaM > 0) totals.elevationGainM += deltaM;
  else totals.elevationLossM += Math.abs(deltaM);
}

export function projectDistanceOnRoute(
  points: MobileGpxPreviewPoint[],
  distanceKm: number,
): ProjectedRoutePoint | null {
  const segment = findDistanceSegment(points, distanceKm);
  if (!segment) return null;

  return {
    lat: segment.left.lat + (segment.right.lat - segment.left.lat) * segment.ratio,
    lng: segment.left.lng + (segment.right.lng - segment.left.lng) * segment.ratio,
    distanceKm: segment.safeDistance,
  };
}

export function interpolateElevationAtDistance(
  points: CourseDistancePoint[],
  distanceKm: number,
): number | null {
  const segment = findDistanceSegment(points, distanceKm);
  if (!segment) return null;
  return segment.left.elevationM + (segment.right.elevationM - segment.left.elevationM) * segment.ratio;
}

export function getCourseProgressAtDistance(
  points: CourseDistancePoint[],
  distanceKm: number,
): CourseProgressPoint | null {
  const segment = findDistanceSegment(points, distanceKm);
  if (!segment) return null;

  const totals = { elevationGainM: 0, elevationLossM: 0 };
  for (let index = 1; index <= segment.leftIndex; index += 1) {
    addElevationDelta(totals, points[index].elevationM - points[index - 1].elevationM);
  }

  const segmentDelta = segment.right.elevationM - segment.left.elevationM;
  const partialDelta = segmentDelta * segment.ratio;
  addElevationDelta(totals, partialDelta, segmentDelta);

  return {
    distanceKm: segment.safeDistance,
    elevationM: segment.left.elevationM + partialDelta,
    ...totals,
  };
}

export function getElevationBounds(points: CourseDistancePoint[]) {
  if (points.length === 0) return null;
  const elevations = points.map((point) => point.elevationM);
  return {
    minElevationM: Math.min(...elevations),
    maxElevationM: Math.max(...elevations),
  };
}

export function elevationProfileFromRoute(points: MobileGpxPreviewPoint[]): CourseDistancePoint[] {
  return points.flatMap((point) =>
    point.elevationM === null || !Number.isFinite(point.elevationM)
      ? []
      : [{ distanceKm: point.distanceKm, elevationM: point.elevationM }],
  );
}

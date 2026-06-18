import type { ElevationPoint } from "../types";

const sortByDistance = (a: ElevationPoint, b: ElevationPoint) => a.distanceKm - b.distanceKm;

const getElevationAtDistance = (samples: ElevationPoint[], distanceKm: number) => {
  if (samples.length === 0) return 0;
  if (distanceKm <= samples[0].distanceKm) return samples[0].elevationM;
  const last = samples[samples.length - 1];
  if (distanceKm >= last.distanceKm) return last.elevationM;
  const nextIndex = samples.findIndex((point) => point.distanceKm >= distanceKm);
  if (nextIndex <= 0) return samples[0].elevationM;
  const prevPoint = samples[nextIndex - 1];
  const nextPoint = samples[nextIndex] ?? prevPoint;
  const ratio =
    nextPoint.distanceKm === prevPoint.distanceKm
      ? 0
      : (distanceKm - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);
  return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
};

export const getElevationSlice = (
  profile: ElevationPoint[],
  startDistanceKm: number,
  endDistanceKm: number
): ElevationPoint[] => {
  if (profile.length === 0) return [];
  const sorted = [...profile].sort(sortByDistance);
  const sliceStart = Math.min(startDistanceKm, endDistanceKm);
  const sliceEnd = Math.max(startDistanceKm, endDistanceKm);
  const points = [
    { distanceKm: sliceStart, elevationM: getElevationAtDistance(sorted, sliceStart) },
    ...sorted.filter((point) => point.distanceKm > sliceStart && point.distanceKm < sliceEnd),
    { distanceKm: sliceEnd, elevationM: getElevationAtDistance(sorted, sliceEnd) },
  ];
  return points.sort(sortByDistance);
};

export const getElevationSliceXY = (
  profile: ElevationPoint[],
  startDistanceKm: number,
  endDistanceKm: number
) => {
  const sliceStart = Math.min(startDistanceKm, endDistanceKm);
  const points = getElevationSlice(profile, startDistanceKm, endDistanceKm);
  return {
    x: points.map((point) => Number((point.distanceKm - sliceStart).toFixed(3))),
    y: points.map((point) => point.elevationM),
  };
};

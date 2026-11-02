import type { VideoRoutePoint } from "../../../lib/video-generator";

export const MAX_CAMERA_SAMPLES = 2_500;
export const TERRAIN_EXAGGERATION = 1.15;

const MIN_VALID_ELEVATION_M = -500;
const MAX_VALID_ELEVATION_M = 9_000;

export type AnimationViewport = "portrait" | "landscape";
export type RouteRevealMode = "progressive" | "full";

export type PreparedRoutePoint = {
  lat: number;
  lon: number;
  elevationM: number;
  distanceKm: number;
};

export type PreparedAnimationPath = {
  samples: PreparedRoutePoint[];
  totalDistanceKm: number;
  canAnimate: boolean;
};

export type CameraPosition = {
  lat: number;
  lon: number;
  altitudeM: number;
};

export type CameraFrame = {
  progress: number;
  distanceKm: number;
  routePoint: PreparedRoutePoint;
  camera: CameraPosition;
  target: CameraPosition;
};

export type DynamicCameraSettings = {
  terrainExaggeration: number;
  portraitAltitudeMultiplier: number;
  portraitLookAheadMultiplier: number;
};

export const DEFAULT_DYNAMIC_CAMERA_SETTINGS: DynamicCameraSettings = {
  terrainExaggeration: TERRAIN_EXAGGERATION,
  portraitAltitudeMultiplier: 1.25,
  portraitLookAheadMultiplier: 1.15,
};

type TerrainElevationResolver = (point: { lat: number; lon: number }) => number | null | undefined;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const isValidElevation = (value: number | null | undefined): value is number =>
  typeof value === "number"
  && Number.isFinite(value)
  && value >= MIN_VALID_ELEVATION_M
  && value <= MAX_VALID_ELEVATION_M;

const normalizePoints = (points: VideoRoutePoint[]) => {
  let previousDistance = 0;
  return points.map((point, index) => {
    const distanceKm = index === 0
      ? Math.max(0, point.distanceKm)
      : Math.max(previousDistance, point.distanceKm);
    previousDistance = distanceKm;
    return { ...point, distanceKm };
  });
};

const findUpperIndex = <T extends { distanceKm: number }>(points: T[], distanceKm: number) => {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].distanceKm <= distanceKm) low = middle + 1;
    else high = middle;
  }
  return low;
};

const interpolateNumber = (start: number, end: number, ratio: number) =>
  start + (end - start) * ratio;

const interpolateCoordinates = (
  points: Array<Pick<VideoRoutePoint, "lat" | "lon" | "distanceKm">>,
  distanceKm: number,
) => {
  if (points.length === 0) return { lat: 0, lon: 0 };
  if (distanceKm <= points[0].distanceKm) return { lat: points[0].lat, lon: points[0].lon };
  const last = points[points.length - 1];
  if (distanceKm >= last.distanceKm) return { lat: last.lat, lon: last.lon };

  const upperIndex = findUpperIndex(points, distanceKm);
  const before = points[Math.max(0, upperIndex - 1)];
  const after = points[Math.min(points.length - 1, upperIndex)];
  const span = after.distanceKm - before.distanceKm;
  const ratio = span > 0 ? (distanceKm - before.distanceKm) / span : 1;
  return {
    lat: interpolateNumber(before.lat, after.lat, ratio),
    lon: interpolateNumber(before.lon, after.lon, ratio),
  };
};

const interpolateGpxElevation = (
  anchors: Array<{ distanceKm: number; elevationM: number }>,
  distanceKm: number,
) => {
  if (anchors.length === 0) return null;
  if (distanceKm <= anchors[0].distanceKm) return anchors[0].elevationM;
  const last = anchors[anchors.length - 1];
  if (distanceKm >= last.distanceKm) return last.elevationM;

  const upperIndex = findUpperIndex(anchors, distanceKm);
  const before = anchors[Math.max(0, upperIndex - 1)];
  const after = anchors[Math.min(anchors.length - 1, upperIndex)];
  const span = after.distanceKm - before.distanceKm;
  if (span <= 0) return after.elevationM;
  return interpolateNumber(
    before.elevationM,
    after.elevationM,
    (distanceKm - before.distanceKm) / span,
  );
};

export const prepareAnimationPath = (
  sourcePoints: VideoRoutePoint[],
  resolveTerrainElevation?: TerrainElevationResolver,
): PreparedAnimationPath => {
  const points = normalizePoints(sourcePoints);
  if (points.length === 0) return { samples: [], totalDistanceKm: 0, canAnimate: false };

  const totalDistanceKm = points[points.length - 1].distanceKm;
  const gpxElevationAnchors = points.flatMap((point) => isValidElevation(point.elevationM)
    ? [{ distanceKm: point.distanceKm, elevationM: point.elevationM }]
    : []);
  const sampleCount = totalDistanceKm > 0
    ? Math.min(MAX_CAMERA_SAMPLES, Math.max(2, Math.ceil(totalDistanceKm * 200) + 1))
    : 1;

  const samples = Array.from({ length: sampleCount }, (_, index): PreparedRoutePoint => {
    const distanceKm = sampleCount === 1 ? 0 : totalDistanceKm * index / (sampleCount - 1);
    const coordinates = interpolateCoordinates(points, distanceKm);
    const gpxElevation = interpolateGpxElevation(gpxElevationAnchors, distanceKm);
    const terrainElevation = gpxElevation === null
      ? resolveTerrainElevation?.(coordinates)
      : null;
    return {
      ...coordinates,
      distanceKm,
      elevationM: isValidElevation(gpxElevation)
        ? gpxElevation
        : isValidElevation(terrainElevation)
          ? terrainElevation
          : 0,
    };
  });

  return { samples, totalDistanceKm, canAnimate: totalDistanceKm > 0 && samples.length > 1 };
};

export const getRoutePointAtDistance = (
  path: PreparedAnimationPath,
  requestedDistanceKm: number,
): PreparedRoutePoint => {
  const { samples } = path;
  if (samples.length === 0) return { lat: 0, lon: 0, elevationM: 0, distanceKm: 0 };
  const distanceKm = clamp(requestedDistanceKm, 0, path.totalDistanceKm);
  if (distanceKm <= 0) return samples[0];
  if (distanceKm >= path.totalDistanceKm) return samples[samples.length - 1];

  const upperIndex = findUpperIndex(samples, distanceKm);
  const before = samples[Math.max(0, upperIndex - 1)];
  const after = samples[Math.min(samples.length - 1, upperIndex)];
  const span = after.distanceKm - before.distanceKm;
  const ratio = span > 0 ? (distanceKm - before.distanceKm) / span : 1;
  return {
    lat: interpolateNumber(before.lat, after.lat, ratio),
    lon: interpolateNumber(before.lon, after.lon, ratio),
    elevationM: interpolateNumber(before.elevationM, after.elevationM, ratio),
    distanceKm,
  };
};

const getSmoothedRoutePoint = (
  path: PreparedAnimationPath,
  distanceKm: number,
  smoothingDistanceM: number,
) => {
  const windowKm = smoothingDistanceM / 1_000;
  const offsets = [-1, -0.5, 0, 0.5, 1];
  const positions = offsets.map((offset) => getRoutePointAtDistance(path, distanceKm + windowKm * offset));
  const count = positions.length;
  return {
    lat: positions.reduce((sum, point) => sum + point.lat, 0) / count,
    lon: positions.reduce((sum, point) => sum + point.lon, 0) / count,
    elevationM: positions.reduce((sum, point) => sum + point.elevationM, 0) / count,
    distanceKm: clamp(distanceKm, 0, path.totalDistanceKm),
  };
};

export const getCameraStateAtTime = (
  timeMs: number,
  durationMs: number,
  path: PreparedAnimationPath,
  settings: DynamicCameraSettings = DEFAULT_DYNAMIC_CAMERA_SETTINGS,
  viewport: AnimationViewport = "portrait",
): CameraFrame => {
  const safeDurationMs = Math.max(1, durationMs);
  const progress = clamp(timeMs / safeDurationMs, 0, 1);
  const distanceKm = path.totalDistanceKm * progress;
  const speedMps = path.totalDistanceKm * 1_000 / (safeDurationMs / 1_000);
  const portrait = viewport === "portrait";
  const lookAheadM = clamp(speedMps * 0.8, 150, 1_600)
    * (portrait ? settings.portraitLookAheadMultiplier : 1);
  const setbackM = clamp(speedMps * 0.35, 80, 700);
  const smoothingDistanceM = clamp(speedMps * 0.6, 100, 1_200);
  const clearanceM = clamp(700 + speedMps * 0.35, 800, 2_500)
    * (portrait ? settings.portraitAltitudeMultiplier : 1);

  const routePoint = getRoutePointAtDistance(path, distanceKm);
  const cameraGround = getSmoothedRoutePoint(path, distanceKm - setbackM / 1_000, smoothingDistanceM);
  const targetGround = getSmoothedRoutePoint(path, distanceKm + lookAheadM / 1_000, smoothingDistanceM);

  return {
    progress,
    distanceKm,
    routePoint,
    camera: {
      lat: cameraGround.lat,
      lon: cameraGround.lon,
      altitudeM: cameraGround.elevationM * settings.terrainExaggeration + clearanceM,
    },
    target: {
      lat: targetGround.lat,
      lon: targetGround.lon,
      altitudeM: targetGround.elevationM * settings.terrainExaggeration,
    },
  };
};

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

export type LineProgressTable = { distancesKm: number[]; progress: number[] };

const toMercator = (lon: number, lat: number) => {
  const clampedLat = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return { x: lon / 360, y: Math.log(Math.tan(Math.PI / 4 + clampedLat / 2)) / (2 * Math.PI) };
};

/**
 * Mapbox `line-progress` (used by `line-trim-offset`) is measured along the drawn line in Mercator
 * units, not in GPX distance. GPX distances can include elevation and Mercator scale changes with
 * latitude, so the reveal must map the marker distance through this table to stay under the dot.
 */
export const buildLineProgressTable = (sourcePoints: VideoRoutePoint[]): LineProgressTable => {
  const points = normalizePoints(sourcePoints);
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const from = toMercator(points[index - 1].lon, points[index - 1].lat);
    const to = toMercator(points[index].lon, points[index].lat);
    lengths.push(lengths[index - 1] + Math.hypot(to.x - from.x, to.y - from.y));
  }
  const total = lengths[lengths.length - 1] ?? 0;
  return {
    distancesKm: points.map((point) => point.distanceKm),
    progress: lengths.map((length, index) => total > 0 ? length / total : points.length > 1 ? index / (points.length - 1) : 0),
  };
};

export const getLineProgressAtDistance = (table: LineProgressTable, distanceKm: number) => {
  const { distancesKm, progress } = table;
  if (distancesKm.length === 0) return 0;
  if (distanceKm <= distancesKm[0]) return progress[0];
  const last = distancesKm.length - 1;
  if (distanceKm >= distancesKm[last]) return progress[last];
  let low = 0;
  let high = distancesKm.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (distancesKm[middle] <= distanceKm) low = middle + 1;
    else high = middle;
  }
  const upperIndex = low;
  const lowerIndex = Math.max(0, upperIndex - 1);
  const span = distancesKm[upperIndex] - distancesKm[lowerIndex];
  const ratio = span > 0 ? (distanceKm - distancesKm[lowerIndex]) / span : 1;
  return interpolateNumber(progress[lowerIndex], progress[upperIndex], ratio);
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

const METERS_PER_DEGREE_LAT = 111_320;
// Mapbox GL default vertical field of view.
const VERTICAL_FOV_RAD = (36.87 * Math.PI) / 180;
// A high viewpoint: the map reads like a relief map and small turns barely move the picture.
const CHASE_ELEVATION_ANGLE_RAD = (54 * Math.PI) / 180;
const OVERVIEW_ELEVATION_ANGLE_RAD = (50 * Math.PI) / 180;
const MIN_TERRAIN_CLEARANCE_M = 300;

export type CameraPose = {
  camera: CameraPosition;
  target: CameraPosition;
};

const metersPerDegreeLon = (lat: number) => METERS_PER_DEGREE_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180));

const offsetPosition = (origin: { lat: number; lon: number }, eastM: number, northM: number) => ({
  lat: origin.lat + northM / METERS_PER_DEGREE_LAT,
  lon: origin.lon + eastM / metersPerDegreeLon(origin.lat),
});

/**
 * Travel direction averaged over three symmetric chords, so hairpins and GPS noise rotate the
 * camera progressively instead of snapping it. Pure function of the distance: seeking stays exact.
 */
export const getRouteHeading = (path: PreparedAnimationPath, distanceKm: number, windowKm: number) => {
  let east = 0;
  let north = 0;
  [windowKm / 3, (2 * windowKm) / 3, windowKm].forEach((chordKm) => {
    const from = getRoutePointAtDistance(path, distanceKm - chordKm);
    const to = getRoutePointAtDistance(path, distanceKm + chordKm);
    east += (to.lon - from.lon) * metersPerDegreeLon(from.lat);
    north += (to.lat - from.lat) * METERS_PER_DEGREE_LAT;
  });
  const length = Math.hypot(east, north);
  return length > 1e-6 ? { east: east / length, north: north / length } : { east: 0, north: 1 };
};

const getMaxElevationAround = (path: PreparedAnimationPath, distanceKm: number, radiusKm: number) => {
  const { samples, totalDistanceKm } = path;
  if (samples.length === 0) return 0;
  if (samples.length === 1 || totalDistanceKm <= 0) return samples[0].elevationM;
  const spacingKm = totalDistanceKm / (samples.length - 1);
  const start = Math.max(0, Math.floor((distanceKm - radiusKm) / spacingKm));
  const end = Math.min(samples.length - 1, Math.ceil((distanceKm + radiusKm) / spacingKm));
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = start; index <= end; index += 1) maximum = Math.max(maximum, samples[index].elevationM);
  return Number.isFinite(maximum) ? maximum : samples[0].elevationM;
};

/**
 * Chase camera: always looks exactly at the progress marker so it stays centred, sits behind it
 * along the smoothed travel direction and never dips below the surrounding terrain. Distances
 * scale with the average flyover speed, not the instantaneous one, so the framing stays stable
 * while the pace slows down at aid stations and climbs.
 */
export const getChaseCameraPose = (
  path: PreparedAnimationPath,
  distanceKm: number,
  speedMps: number,
  viewport: AnimationViewport = "portrait",
  terrainExaggeration = TERRAIN_EXAGGERATION,
  /** Travel direction to look along; defaults to the route heading around the runner. */
  headingOverride?: { east: number; north: number },
  /** Point to centre on; defaults to the exact runner position. */
  targetOverride?: { lat: number; lon: number; elevationM: number },
): CameraPose => {
  const portrait = viewport === "portrait";
  const target = targetOverride ?? getRoutePointAtDistance(path, distanceKm);
  // Far enough to read the whole section around the runner (4.5 km at the slowest), pulled back
  // up to 20 km on fast stretches.
  const backDistanceM = clamp(speedMps * 3, 4_500, 20_000) * (portrait ? 1.25 : 1);
  const headingWindowKm = clamp(speedMps * 3, 2_500, 15_000) / 1_000;
  const heading = headingOverride ?? getRouteHeading(path, distanceKm, headingWindowKm);
  const cameraGround = offsetPosition(target, -heading.east * backDistanceM, -heading.north * backDistanceM);
  const heightM = backDistanceM * Math.tan(CHASE_ELEVATION_ANGLE_RAD);
  const surroundingMaxM = getMaxElevationAround(path, distanceKm, (backDistanceM * 1.3) / 1_000);
  const targetAltitudeM = target.elevationM * terrainExaggeration;

  return {
    camera: {
      ...cameraGround,
      altitudeM: Math.max(
        targetAltitudeM + heightM,
        surroundingMaxM * terrainExaggeration + MIN_TERRAIN_CLEARANCE_M,
      ),
    },
    target: { lat: target.lat, lon: target.lon, altitudeM: targetAltitudeM },
  };
};

/** North-up 3D overview fitting every sample, computed without querying the map. */
export const getOverviewCameraPose = (
  path: PreparedAnimationPath,
  viewport: AnimationViewport = "portrait",
  terrainExaggeration = TERRAIN_EXAGGERATION,
): CameraPose => {
  const { samples } = path;
  if (samples.length === 0) {
    return { camera: { lat: 0, lon: 0, altitudeM: 10_000 }, target: { lat: 0, lon: 0, altitudeM: 0 } };
  }
  const lats = samples.map((sample) => sample.lat);
  const lons = samples.map((sample) => sample.lon);
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
  };
  const widthM = Math.max(500, (Math.max(...lons) - Math.min(...lons)) * metersPerDegreeLon(center.lat));
  const depthM = Math.max(500, (Math.max(...lats) - Math.min(...lats)) * METERS_PER_DEGREE_LAT);
  const aspect = viewport === "portrait" ? 9 / 16 : 16 / 9;
  const horizontalFovRad = 2 * Math.atan(Math.tan(VERTICAL_FOV_RAD / 2) * aspect);
  const viewDistanceM = 1.3 * Math.max(
    widthM / 2 / Math.tan(horizontalFovRad / 2),
    (depthM * Math.sin(OVERVIEW_ELEVATION_ANGLE_RAD)) / 2 / Math.tan(VERTICAL_FOV_RAD / 2),
  );
  const meanElevationM = samples.reduce((sum, sample) => sum + sample.elevationM, 0) / samples.length;
  const targetAltitudeM = meanElevationM * terrainExaggeration;
  const cameraGround = offsetPosition(center, 0, -viewDistanceM * Math.cos(OVERVIEW_ELEVATION_ANGLE_RAD));

  return {
    camera: { ...cameraGround, altitudeM: targetAltitudeM + viewDistanceM * Math.sin(OVERVIEW_ELEVATION_ANGLE_RAD) },
    target: { ...center, altitudeM: targetAltitudeM },
  };
};

export const easeInOut = (value: number) => {
  const ratio = clamp(value, 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
};

const interpolatePosition = (from: CameraPosition, to: CameraPosition, ratio: number): CameraPosition => ({
  lat: interpolateNumber(from.lat, to.lat, ratio),
  lon: interpolateNumber(from.lon, to.lon, ratio),
  altitudeM: interpolateNumber(from.altitudeM, to.altitudeM, ratio),
});

export const interpolateCameraPose = (from: CameraPose, to: CameraPose, ratio: number): CameraPose => ({
  camera: interpolatePosition(from.camera, to.camera, ratio),
  target: interpolatePosition(from.target, to.target, ratio),
});

// High above the slope so the whole climb, its foot and its top read at once.
const FRAMING_ELEVATION_ANGLE_RAD = (62 * Math.PI) / 180;

/**
 * Frames a whole slope (a climb from its foot to its top): the camera looks along the slope from
 * behind its foot, far enough back for both ends and the high point to fit, so the narrated climb
 * is seen entirely. Pure function of the slope, so seeking stays exact.
 */
export const getSegmentFramingPose = (
  path: PreparedAnimationPath,
  startKm: number,
  endKm: number,
  viewport: AnimationViewport = "portrait",
  terrainExaggeration = TERRAIN_EXAGGERATION,
): CameraPose => {
  const portrait = viewport === "portrait";
  const start = getRoutePointAtDistance(path, startKm);
  const end = getRoutePointAtDistance(path, endKm);
  const middle = getRoutePointAtDistance(path, (startKm + endKm) / 2);
  const steps = 24;
  let maxElevationM = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (let step = 0; step <= steps; step += 1) {
    const point = getRoutePointAtDistance(path, startKm + ((endKm - startKm) * step) / steps);
    maxElevationM = Math.max(maxElevationM, point.elevationM);
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  const center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  const spanM = Math.hypot(
    (maxLat - minLat) * METERS_PER_DEGREE_LAT,
    (maxLon - minLon) * metersPerDegreeLon(center.lat),
  );
  // Look along the slope, from its foot toward its top.
  let east = (end.lon - start.lon) * metersPerDegreeLon(center.lat);
  let north = (end.lat - start.lat) * METERS_PER_DEGREE_LAT;
  const length = Math.hypot(east, north);
  if (length < 1) {
    const heading = getRouteHeading(path, (startKm + endKm) / 2, 1);
    east = heading.east;
    north = heading.north;
  } else {
    east /= length;
    north /= length;
  }
  // Seen from about three times its length: the slope fills roughly half the frame width.
  const backDistanceM = clamp(spanM * (portrait ? 1.5 : 1.15), 6_000, 30_000);
  const cameraGround = offsetPosition(center, -east * backDistanceM, -north * backDistanceM);
  const targetAltitudeM = ((middle.elevationM + maxElevationM) / 2) * terrainExaggeration;
  return {
    camera: {
      ...cameraGround,
      altitudeM: Math.max(
        targetAltitudeM + backDistanceM * Math.tan(FRAMING_ELEVATION_ANGLE_RAD),
        maxElevationM * terrainExaggeration + MIN_TERRAIN_CLEARANCE_M,
      ),
    },
    target: { lat: center.lat, lon: center.lon, altitudeM: targetAltitudeM },
  };
};

import {
  getRoutePointAtDistance,
  VERTICAL_FOV_RAD,
  type AnimationViewport,
  type CameraPose,
  type PreparedAnimationPath,
} from "./route-animation";

/**
 * Frame guarantee of the tilted chase camera. A simple pinhole model (the Mapbox vertical field of
 * view, the frame aspect ratio, no roll) projects the runner and the next kilometres of trail
 * through a camera pose; when one of them falls outside the safe rectangle of the frame, the pose
 * is turned, pulled back and/or moved towards the upcoming trail until they all fit. Pure: the same
 * path and pose always give the same answer, so the preview and the export match.
 */

const METERS_PER_DEGREE_LAT = 111_320;

export const FRAME_ASPECT: Record<AnimationViewport, number> = { portrait: 9 / 16, landscape: 16 / 9 };

/**
 * Bottom of the leg card of the light overlay, in cqmin from the top of the frame: the card starts
 * at COMPACT_TOP_CQMIN + 28 = 56 cqmin and is about 13 cqmin tall (pill, title, facts line). In
 * portrait the band share is capped by MAX_TOP_BAND_SHARE (40 % of the height).
 */
export const OVERLAY_TOP_BAND_CQMIN = 72;
/** Bottom share of the frame kept clear (subtitles, Instagram interface). */
export const FRAME_BOTTOM_MARGIN = 0.2;
/** Share of the width kept clear on each side. */
export const FRAME_SIDE_MARGIN = 0.06;
/** The landscape frame is only 100 cqmin tall: the band cannot take more than this share of it. */
const MAX_TOP_BAND_SHARE = 0.4;

/** Route ahead of the runner that must stay in the frame, sampled every 250 m. */
export const FRAMING_LOOKAHEAD_KM = 2;
export const FRAMING_STEP_KM = 0.25;

// The correction aims inside the safe rectangle by this share of the frame on every side, so the
// time smoothing that follows (a gaussian on the camera position) cannot push a point out.
const RAW_INSET = 0.03;

export type FrameRect = { left: number; right: number; top: number; bottom: number };
export type FramePoint = { lat: number; lon: number; altitudeM: number };

/** Safe rectangle of the frame as fractions (0, 0 = top-left corner). */
export const getSafeFrameRect = (viewport: AnimationViewport): FrameRect => {
  const aspect = FRAME_ASPECT[viewport];
  const heightCqmin = aspect < 1 ? 100 / aspect : 100;
  return {
    left: FRAME_SIDE_MARGIN,
    right: 1 - FRAME_SIDE_MARGIN,
    top: Math.min(MAX_TOP_BAND_SHARE, OVERLAY_TOP_BAND_CQMIN / heightCqmin),
    bottom: 1 - FRAME_BOTTOM_MARGIN,
  };
};

type Vec3 = [number, number, number];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** Local east/north/up metres of a position around an origin latitude/longitude. */
const toLocal = (origin: { lat: number; lon: number }, point: { lat: number; lon: number; altitudeM: number }): Vec3 => [
  (point.lon - origin.lon) * METERS_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180),
  (point.lat - origin.lat) * METERS_PER_DEGREE_LAT,
  point.altitudeM,
];

/**
 * Where a point lands in the frame (fractions, 0, 0 = top-left), or null when it is behind the
 * camera. The camera looks from `pose.camera` to `pose.target` without roll.
 */
export const projectToFrame = (pose: CameraPose, point: FramePoint, aspect: number): { x: number; y: number } | null => {
  const origin = pose.camera;
  const camera = toLocal(origin, pose.camera);
  const forward = normalize(toLocal(origin, pose.target).map((value, index) => value - camera[index]) as Vec3);
  let right = cross(forward, [0, 0, 1]);
  right = Math.hypot(right[0], right[1]) < 1e-6 ? [1, 0, 0] : normalize(right);
  const up = cross(right, forward);
  const delta = toLocal(origin, point).map((value, index) => value - camera[index]) as Vec3;
  const depth = dot(delta, forward);
  if (depth <= 1) return null;
  const tanV = Math.tan(VERTICAL_FOV_RAD / 2);
  return {
    x: 0.5 + dot(delta, right) / (depth * tanV * aspect) / 2,
    y: 0.5 - dot(delta, up) / (depth * tanV) / 2,
  };
};

/** The runner and the route up to 2 km ahead, as 3D points (elevation scaled like the terrain). */
export const getFramingPoints = (
  path: PreparedAnimationPath,
  distanceKm: number,
  terrainExaggeration: number,
  lookaheadKm = FRAMING_LOOKAHEAD_KM,
): FramePoint[] => {
  const points: FramePoint[] = [];
  const last = Math.min(lookaheadKm, Math.max(0, path.totalDistanceKm - distanceKm));
  for (let aheadKm = 0; aheadKm < last + 1e-9; aheadKm += FRAMING_STEP_KM) {
    const point = getRoutePointAtDistance(path, distanceKm + aheadKm);
    points.push({ lat: point.lat, lon: point.lon, altitudeM: point.elevationM * terrainExaggeration });
  }
  const end = getRoutePointAtDistance(path, distanceKm + last);
  if (last > 0) points.push({ lat: end.lat, lon: end.lon, altitudeM: end.elevationM * terrainExaggeration });
  return points;
};

/**
 * How far the points fall outside a rectangle, as the largest overshoot in frame fractions
 * (0 = all inside; a point behind the camera counts as 10).
 */
export const getFramingViolation = (pose: CameraPose, points: FramePoint[], viewport: AnimationViewport, rect: FrameRect = getSafeFrameRect(viewport)) => {
  const aspect = FRAME_ASPECT[viewport];
  let worst = 0;
  for (const point of points) {
    const screen = projectToFrame(pose, point, aspect);
    if (!screen) return 10;
    worst = Math.max(worst, rect.left - screen.x, screen.x - rect.right, rect.top - screen.y, screen.y - rect.bottom);
  }
  return Math.max(0, worst);
};

type Correction = { pull: number; turnDeg: number; shift: number; cost: number };

// Candidate corrections, cheapest first: a pull back along the view direction (the pitch is kept),
// a turn around the aimed point (the pitch is kept) and a move of the whole rig towards the
// centroid of the upcoming trail (the pitch and the bearing are kept).
const CORRECTIONS: Correction[] = (() => {
  const list: Correction[] = [];
  for (let pull = 1; pull <= 2.501; pull += 0.1) {
    for (const turnDeg of [0, 6, -6, 12, -12, 18, -18, 24, -24]) {
      for (const shift of [0, 0.2, 0.4, 0.6]) {
        list.push({ pull, turnDeg, shift, cost: (pull - 1) + (Math.abs(turnDeg) / 30) * 0.6 + shift * 0.5 });
      }
    }
  }
  return list.sort((left, right) => left.cost - right.cost);
})();

const applyCorrection = (pose: CameraPose, correction: Correction, centroid: { east: number; north: number }): CameraPose => {
  const origin = pose.target;
  const camera = toLocal(origin, pose.camera);
  const turn = (correction.turnDeg * Math.PI) / 180;
  // Rotate the camera around the aimed point, then scale its offset from it.
  const east = (camera[0] * Math.cos(turn) - camera[1] * Math.sin(turn)) * correction.pull;
  const north = (camera[0] * Math.sin(turn) + camera[1] * Math.cos(turn)) * correction.pull;
  const altitudeM = pose.target.altitudeM + (camera[2] - pose.target.altitudeM) * correction.pull;
  const moveEast = centroid.east * correction.shift;
  const moveNorth = centroid.north * correction.shift;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const toLat = (northM: number) => origin.lat + northM / METERS_PER_DEGREE_LAT;
  const toLon = (eastM: number) => origin.lon + eastM / (METERS_PER_DEGREE_LAT * cosLat);
  return {
    camera: { lat: toLat(north + moveNorth), lon: toLon(east + moveEast), altitudeM },
    target: { lat: toLat(moveNorth), lon: toLon(moveEast), altitudeM: pose.target.altitudeM },
  };
};

/**
 * Raw pose adjusted so the runner and the route ahead stay in the safe rectangle: the pose itself
 * when they already do, otherwise the cheapest correction that fits them (or, when none does, the
 * one that comes closest). The camera never gets closer to the ground: a pull back only rises.
 */
export const ensureRouteInFrame = (pose: CameraPose, points: FramePoint[], viewport: AnimationViewport): CameraPose => {
  if (points.length === 0) return pose;
  const safe = getSafeFrameRect(viewport);
  const rect: FrameRect = {
    left: safe.left + RAW_INSET,
    right: safe.right - RAW_INSET,
    top: safe.top + RAW_INSET,
    bottom: safe.bottom - RAW_INSET,
  };
  if (getFramingViolation(pose, points, viewport, rect) <= 0) return pose;
  let east = 0;
  let north = 0;
  points.forEach((point) => {
    const local = toLocal(pose.target, point);
    east += local[0];
    north += local[1];
  });
  const centroid = { east: east / points.length, north: north / points.length };
  let best = pose;
  let bestViolation = Number.POSITIVE_INFINITY;
  for (const correction of CORRECTIONS) {
    const candidate = applyCorrection(pose, correction, centroid);
    const violation = getFramingViolation(candidate, points, viewport, rect);
    if (violation <= 0) return candidate;
    if (violation < bestViolation - 1e-9) {
      best = candidate;
      bestViolation = violation;
    }
  }
  return best;
};

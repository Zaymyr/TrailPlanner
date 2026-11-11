/**
 * Pure geometry and formatting helpers behind the Pace Yourself trail
 * signature (ridge lines, course-derived contours, map-style "cotes").
 * Rendering lives in `components/themed`; this module stays testable.
 */

export type TrailProfilePoint = {
  distanceKm: number;
  elevationM: number;
};

export type RidgePoint = { x: number; y: number };

export type RidgeFrame = {
  width: number;
  height: number;
  /** Inner margin so strokes and markers are never clipped. */
  inset?: number;
};

/**
 * The brand ridge: a fixed, normalized silhouette used whenever no course
 * profile is available (loaders, dividers, empty states). Values are 0..1.
 */
export const SIGNATURE_RIDGE: readonly number[] = [
  0.08, 0.16, 0.34, 0.28, 0.46, 0.62, 0.52, 0.78, 1, 0.84, 0.66, 0.72, 0.5, 0.36, 0.42, 0.24, 0.12,
];

/** Narrows an untyped stored profile (e.g. `race_plans.elevation_profile`). */
export function asTrailProfile(value: unknown): TrailProfilePoint[] | null {
  if (!Array.isArray(value)) return null;
  const points = value.filter((point): point is TrailProfilePoint => (
    typeof point === 'object'
    && point !== null
    && typeof (point as TrailProfilePoint).distanceKm === 'number'
    && typeof (point as TrailProfilePoint).elevationM === 'number'
  ));
  return points.length >= 2 ? points : null;
}

/** Elevation spans below this are rendered as a calm, flat line. */
const FLAT_ELEVATION_SPAN_M = 1;

/**
 * Resamples a course profile at evenly spaced distances and normalizes the
 * elevation to 0..1. Returns null when the profile cannot draw a ridge.
 */
export function resampleProfile(
  points: readonly TrailProfilePoint[] | null | undefined,
  samples: number,
): number[] | null {
  if (!Array.isArray(points) || samples < 2) return null;
  const clean = points
    .filter((point) => point
      && Number.isFinite(point.distanceKm)
      && Number.isFinite(point.elevationM))
    .slice()
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (clean.length < 2) return null;

  const start = clean[0].distanceKm;
  const end = clean[clean.length - 1].distanceKm;
  if (!(end > start)) return null;

  const elevations: number[] = [];
  let cursor = 0;
  for (let index = 0; index < samples; index += 1) {
    const target = start + ((end - start) * index) / (samples - 1);
    while (cursor < clean.length - 2 && clean[cursor + 1].distanceKm < target) cursor += 1;
    const from = clean[cursor];
    const to = clean[cursor + 1];
    const span = to.distanceKm - from.distanceKm;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (target - from.distanceKm) / span)) : 0;
    elevations.push(from.elevationM + (to.elevationM - from.elevationM) * ratio);
  }

  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  if (max - min < FLAT_ELEVATION_SPAN_M) return elevations.map(() => 0.5);
  return elevations.map((value) => (value - min) / (max - min));
}

function clampUnit(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Maps normalized values (1 = highest) onto a frame (y grows downwards). */
export function ridgePoints(values: readonly number[], frame: RidgeFrame): RidgePoint[] {
  const inset = frame.inset ?? 0;
  const usableWidth = Math.max(0, frame.width - inset * 2);
  const usableHeight = Math.max(0, frame.height - inset * 2);
  if (values.length === 0) return [];
  if (values.length === 1) {
    const y = inset + (1 - clampUnit(values[0])) * usableHeight;
    return [{ x: inset, y }, { x: inset + usableWidth, y }];
  }
  return values.map((value, index) => ({
    x: inset + (usableWidth * index) / (values.length - 1),
    y: inset + (1 - clampUnit(value)) * usableHeight,
  }));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Smooth open path through the points (Catmull-Rom converted to cubic
 * Béziers). Control points are clamped vertically to the frame so the curve
 * never overshoots outside the drawing area.
 */
export function buildRidgePath(values: readonly number[], frame: RidgeFrame): string {
  const points = ridgePoints(values, frame);
  if (points.length === 0) return '';
  const inset = frame.inset ?? 0;
  const minY = inset;
  const maxY = frame.height - inset;
  const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));

  let path = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: clampY(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: clampY(p2.y - (p3.y - p1.y) / 6) };
    path += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return path;
}

/** Same ridge closed down to the frame bottom, for filled silhouettes. */
export function buildRidgeAreaPath(values: readonly number[], frame: RidgeFrame): string {
  const points = ridgePoints(values, frame);
  if (points.length === 0) return '';
  const line = buildRidgePath(values, frame);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${round(last.x)} ${round(frame.height)} L${round(first.x)} ${round(frame.height)} Z`;
}

/** Highest point of the ridge (first one when the summit is a plateau). */
export function ridgeSummit(values: readonly number[], frame: RidgeFrame): RidgePoint & { index: number } {
  const points = ridgePoints(values, frame);
  if (points.length === 0) return { x: 0, y: 0, index: -1 };
  let summitIndex = 0;
  points.forEach((point, index) => {
    if (point.y < points[summitIndex].y) summitIndex = index;
  });
  return { ...points[summitIndex], index: summitIndex };
}

/** Polyline length, used to drive stroke-dash drawing animations. */
export function ridgeLength(values: readonly number[], frame: RidgeFrame): number {
  const points = ridgePoints(values, frame);
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  // Béziers are slightly longer than their polyline; a margin keeps the
  // dash hidden at the start of a draw animation.
  return Math.ceil(length * 1.08);
}

/**
 * Course-derived contour lines: the ridge repeated as nested, flattening
 * bands, like the iso-lines around a summit on a topographic map.
 */
export function buildContourPaths(values: readonly number[], frame: RidgeFrame, layers = 4): string[] {
  if (values.length < 2 || layers < 1) return [];
  const paths: string[] = [];
  const bandStep = frame.height / (layers + 2);
  for (let layer = 0; layer < layers; layer += 1) {
    const amplitude = 1 - layer * (0.7 / layers);
    const offset = bandStep * layer;
    const layerValues = values.map((value) => clampUnit(value) * amplitude);
    const layerFrame = { width: frame.width, height: frame.height - offset, inset: frame.inset };
    const path = buildRidgePath(layerValues, layerFrame);
    paths.push(offset === 0 ? path : translatePath(path, offset));
  }
  return paths;
}

function translatePath(path: string, dy: number): string {
  // Paths produced here only use absolute M/C/L commands with "x y" pairs.
  return path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${x} ${round(Number(y) + dy)}`);
}

export type CoteParts = {
  value: string;
  unit: string | null;
};

/**
 * Splits an already formatted measurement ("1 240 m", "42,3 km", "60 g/h")
 * into its numeric value and trailing unit so it can be typeset like a map
 * elevation mark. Labels without a trailing unit are returned unchanged.
 */
export function splitCoteLabel(label: string | number | null | undefined): CoteParts {
  if (label == null) return { value: '—', unit: null };
  const text = String(label).trim();
  if (!text) return { value: '—', unit: null };
  const match = /^(.*\d)\s*([^\d\s][^\d]*)$/u.exec(text);
  if (!match) return { value: text, unit: null };
  const unit = match[2].trim();
  // Words such as "4 ravitos" are not units; keep units short and symbolic.
  if (unit.length > 6 || /\s/.test(unit)) return { value: text, unit: null };
  return { value: match[1].trim(), unit };
}

/** Map-style unit typesetting: compact capitals ("km" -> "KM"). */
export function formatCoteUnit(unit: string): string {
  return unit.toLocaleUpperCase('fr-FR');
}

const MIN_TILT_DEGREES = 0.5;

/**
 * A stable, slightly "hand-set" tilt for a trail sign: derived from a seed
 * (usually the label) so the same sign always leans the same way and never
 * wobbles between renders. Never upright, never beyond `maxDegrees`.
 */
export function signTilt(seed: string, maxDegrees = 1.4): number {
  // FNV-1a: tiny, deterministic, well spread for short labels.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const span = Math.max(0, maxDegrees - MIN_TILT_DEGREES);
  const magnitude = MIN_TILT_DEGREES + ((hash % 1000) / 999) * span;
  const sign = (hash >>> 16) % 2 === 0 ? 1 : -1;
  return Math.round(sign * magnitude * 100) / 100;
}

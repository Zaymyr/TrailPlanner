/**
 * Pure helpers behind the catalog race-card profile strip: every format of an
 * event is drawn as its own smoothed line stretched across the full width and
 * overlaid on one shared elevation range, so the stack reads as a signature of
 * the event rather than a distance chart.
 * Rendering lives in `components/themed/trail/CardProfile`.
 */

import type { TrailProfilePoint } from './trailSignature';

/** Points kept per format once fetched: enough for a recognisable line, tiny in memory. */
export const CATALOG_PROFILE_STORED_POINTS = 48;
/** Samples drawn per format in the strip. */
export const CATALOG_PROFILE_DRAWN_SAMPLES = 32;
/** Above this many formats the strip gets noisy; the shortest ones are dropped. */
export const CATALOG_PROFILE_MAX_LAYERS = 5;

/** Neighbours averaged on each side when smoothing a drawn line. */
export const CATALOG_PROFILE_SMOOTHING_RADIUS = 2;

/** Elevation spans below this are rendered as a calm, flat line. */
const FLAT_ELEVATION_SPAN_M = 1;

function cleanProfile(points: readonly TrailProfilePoint[] | null | undefined): TrailProfilePoint[] {
  if (!Array.isArray(points)) return [];
  return points
    .filter((point) => point
      && Number.isFinite(point.distanceKm)
      && Number.isFinite(point.elevationM))
    .slice()
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Resamples a profile at evenly spaced distances, keeping real metres and
 * distances (first point rebased to km 0). Returns null when unusable.
 */
export function downsampleProfile(
  points: readonly TrailProfilePoint[] | null | undefined,
  samples: number,
): TrailProfilePoint[] | null {
  const clean = cleanProfile(points);
  if (clean.length < 2 || samples < 2) return null;
  const start = clean[0].distanceKm;
  const end = clean[clean.length - 1].distanceKm;
  if (!(end > start)) return null;

  const result: TrailProfilePoint[] = [];
  let cursor = 0;
  for (let index = 0; index < samples; index += 1) {
    const target = start + ((end - start) * index) / (samples - 1);
    while (cursor < clean.length - 2 && clean[cursor + 1].distanceKm < target) cursor += 1;
    const from = clean[cursor];
    const to = clean[cursor + 1];
    const span = to.distanceKm - from.distanceKm;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (target - from.distanceKm) / span)) : 0;
    result.push({
      distanceKm: Math.round((target - start) * 1000) / 1000,
      elevationM: Math.round(from.elevationM + (to.elevationM - from.elevationM) * ratio),
    });
  }
  return result;
}

export type CatalogProfileInput = {
  key: string;
  profile: readonly TrailProfilePoint[] | null | undefined;
};

export type CatalogProfileLayer = {
  key: string;
  /** Rank by length, 0 = longest format (drawn first, behind the others). */
  rank: number;
  /** Always 1: every format is stretched across the full strip. */
  widthRatio: number;
  /** Elevations normalised to the shared range of all formats (1 = highest). */
  values: number[];
};

/**
 * Centred moving average whose window shrinks near the ends, so the first and
 * last values (and any straight slope) are kept exactly.
 */
export function smoothValues(values: readonly number[], radius = CATALOG_PROFILE_SMOOTHING_RADIUS): number[] {
  return values.map((_, index) => {
    const span = Math.min(radius, index, values.length - 1 - index);
    let sum = 0;
    for (let offset = -span; offset <= span; offset += 1) sum += values[index + offset];
    return sum / (span * 2 + 1);
  });
}

/**
 * Builds the overlaid layers: longest first, each stretched across the full
 * width, smoothed, and scaled on the shared elevation range. Empty when no format has a
 * usable profile (the strip then falls back to the brand ridge).
 */
export function buildCatalogProfileLayers(
  inputs: readonly CatalogProfileInput[],
  samples = CATALOG_PROFILE_DRAWN_SAMPLES,
  maxLayers = CATALOG_PROFILE_MAX_LAYERS,
): CatalogProfileLayer[] {
  const sampled = inputs
    .map((input) => ({ key: input.key, points: downsampleProfile(input.profile, samples) }))
    .filter((entry): entry is { key: string; points: TrailProfilePoint[] } => entry.points !== null)
    .map((entry) => ({ ...entry, spanKm: entry.points[entry.points.length - 1].distanceKm }))
    .sort((a, b) => b.spanKm - a.spanKm || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, maxLayers));
  if (sampled.length === 0) return [];

  let min = Infinity;
  let max = -Infinity;
  for (const entry of sampled) {
    for (const point of entry.points) {
      if (point.elevationM < min) min = point.elevationM;
      if (point.elevationM > max) max = point.elevationM;
    }
  }
  const range = max - min;

  return sampled.map((entry, rank) => ({
    key: entry.key,
    rank,
    widthRatio: 1,
    values: smoothValues(entry.points.map((point) => (range < FLAT_ELEVATION_SPAN_M ? 0.5 : (point.elevationM - min) / range))),
  }));
}

// Track resampling, local projection and Overpass chunking for the course terrain job.

export const COURSE_TERRAIN_SAMPLE_STEP_M = 25;
/** Max side of one Overpass bbox chunk (before padding). Small enough for dense areas. */
export const COURSE_TERRAIN_CHUNK_MAX_SIDE_M = 3_500;
/** Bbox padding, larger than the match distance so every candidate way intersects the bbox. */
export const COURSE_TERRAIN_CHUNK_PADDING_M = 100;

const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_DEGREE_LAT = (Math.PI / 180) * EARTH_RADIUS_M;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

export type TrackPoint = { lat: number; lng: number; distKmCum: number };
export type TrackSample = { distM: number; lat: number; lon: number };
export type LatLon = { lat: number; lon: number };
export type XY = { x: number; y: number };
export type Bbox = { south: number; west: number; north: number; east: number };
/** Samples [start, end) of the track and their bbox (unpadded). */
export type TrackChunk = { start: number; end: number; bbox: Bbox };

/** Resamples the track every `stepM` metres on its cumulative distance (`distKmCum`). */
export function resampleTrack(points: TrackPoint[], stepM = COURSE_TERRAIN_SAMPLE_STEP_M): TrackSample[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ distM: 0, lat: points[0]!.lat, lon: points[0]!.lng }];
  const totalM = points[points.length - 1]!.distKmCum * 1000;
  const out: TrackSample[] = [];
  let j = 0;
  for (let s = 0; s <= totalM; s += stepM) {
    while (j < points.length - 2 && points[j + 1]!.distKmCum * 1000 < s) j++;
    const a = points[j]!;
    const b = points[j + 1]!;
    const length = (b.distKmCum - a.distKmCum) * 1000;
    const t = length > 0 ? Math.min(1, Math.max(0, (s - a.distKmCum * 1000) / length)) : 0;
    out.push({ distM: s, lat: a.lat + (b.lat - a.lat) * t, lon: a.lng + (b.lng - a.lng) * t });
  }
  return out;
}

/** Local equirectangular metres around `origin` (accurate at chunk scale). */
export function projectLocal(point: LatLon, origin: LatLon): XY {
  return {
    x: rad(point.lon - origin.lon) * EARTH_RADIUS_M * Math.cos(rad(origin.lat)),
    y: rad(point.lat - origin.lat) * EARTH_RADIUS_M,
  };
}

export function distancePointToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const bboxSides = (bbox: Bbox) => {
  const midLat = (bbox.south + bbox.north) / 2;
  return {
    heightM: (bbox.north - bbox.south) * METERS_PER_DEGREE_LAT,
    widthM: (bbox.east - bbox.west) * METERS_PER_DEGREE_LAT * Math.cos(rad(midLat)),
  };
};

/**
 * Cuts the samples into consecutive chunks whose bbox side stays <= `maxSideM`. Deterministic for a
 * given track, so a later cron tick can resume at a chunk index.
 */
export function buildTrackChunks(samples: TrackSample[], maxSideM = COURSE_TERRAIN_CHUNK_MAX_SIDE_M): TrackChunk[] {
  const chunks: TrackChunk[] = [];
  let current: TrackChunk | null = null;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index]!;
    if (current) {
      const grown: Bbox = {
        south: Math.min(current.bbox.south, sample.lat),
        north: Math.max(current.bbox.north, sample.lat),
        west: Math.min(current.bbox.west, sample.lon),
        east: Math.max(current.bbox.east, sample.lon),
      };
      const { heightM, widthM } = bboxSides(grown);
      if (heightM <= maxSideM && widthM <= maxSideM) {
        current.bbox = grown;
        current.end = index + 1;
        continue;
      }
      chunks.push(current);
    }
    current = { start: index, end: index + 1, bbox: { south: sample.lat, north: sample.lat, west: sample.lon, east: sample.lon } };
  }
  if (current) chunks.push(current);
  return chunks;
}

export function padBbox(bbox: Bbox, paddingM = COURSE_TERRAIN_CHUNK_PADDING_M): Bbox {
  const dLat = paddingM / METERS_PER_DEGREE_LAT;
  const midLat = (bbox.south + bbox.north) / 2;
  const dLon = paddingM / (METERS_PER_DEGREE_LAT * Math.max(0.01, Math.cos(rad(midLat))));
  return { south: bbox.south - dLat, west: bbox.west - dLon, north: bbox.north + dLat, east: bbox.east + dLon };
}

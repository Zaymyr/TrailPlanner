// Map matching of 25 m samples to OSM ways, one Overpass chunk at a time.

import type { CourseTerrainClass } from "@trailplanner/shared";

import { classifyOsmWay, type OsmTags } from "./classify";
import { distancePointToSegment, projectLocal, type LatLon, type TrackSample, type XY } from "./geometry";

/** Beyond this distance from every mapped way a sample is `off_path`. */
export const COURSE_TERRAIN_MATCH_MAX_M = 30;
/** The previous way keeps the sample if it is within (best distance + bonus): avoids jumping to crossings. */
export const COURSE_TERRAIN_CONTINUITY_BONUS_M = 12;
const GRID_CELL_M = 200;

export type OsmWay = { id: number; tags?: OsmTags; geometry: LatLon[] };

export type SampleMatch = {
  class: CourseTerrainClass;
  surface: string | null;
  hasSurfaceTag: boolean;
  hasSacScaleTag: boolean;
};

export const OFF_PATH_MATCH: SampleMatch = { class: "off_path", surface: null, hasSurfaceTag: false, hasSacScaleTag: false };

type IndexedSegment = { wayIndex: number; a: XY; b: XY };

/**
 * Matches each sample to its nearest way (point-to-segment distance), keeping the previous way
 * while it stays within the continuity bonus. `previousWayId` carries continuity across chunks.
 */
export function matchSamples(
  samples: TrackSample[],
  ways: OsmWay[],
  previousWayId: number | null = null,
): { matches: SampleMatch[]; lastWayId: number | null } {
  if (samples.length === 0) return { matches: [], lastWayId: previousWayId };
  const origin = { lat: samples[0]!.lat, lon: samples[0]!.lon };
  const segments: IndexedSegment[] = [];
  const grid = new Map<string, number[]>();
  ways.forEach((way, wayIndex) => {
    const points = way.geometry.map((node) => projectLocal(node, origin));
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const segmentIndex = segments.push({ wayIndex, a, b }) - 1;
      const minX = Math.floor((Math.min(a.x, b.x) - COURSE_TERRAIN_MATCH_MAX_M) / GRID_CELL_M);
      const maxX = Math.floor((Math.max(a.x, b.x) + COURSE_TERRAIN_MATCH_MAX_M) / GRID_CELL_M);
      const minY = Math.floor((Math.min(a.y, b.y) - COURSE_TERRAIN_MATCH_MAX_M) / GRID_CELL_M);
      const maxY = Math.floor((Math.max(a.y, b.y) + COURSE_TERRAIN_MATCH_MAX_M) / GRID_CELL_M);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = `${cx},${cy}`;
          const cell = grid.get(key);
          if (cell) cell.push(segmentIndex);
          else grid.set(key, [segmentIndex]);
        }
      }
    }
  });

  const classByWay = new Map<number, SampleMatch>();
  const matchForWay = (wayIndex: number): SampleMatch => {
    const cached = classByWay.get(wayIndex);
    if (cached) return cached;
    const tags = ways[wayIndex]!.tags ?? {};
    const match: SampleMatch = {
      class: classifyOsmWay(tags),
      surface: tags.surface ?? null,
      hasSurfaceTag: Boolean(tags.surface),
      hasSacScaleTag: Boolean(tags.sac_scale),
    };
    classByWay.set(wayIndex, match);
    return match;
  };

  let previous = previousWayId;
  const matches = samples.map((sample) => {
    const p = projectLocal(sample, origin);
    const candidates = grid.get(`${Math.floor(p.x / GRID_CELL_M)},${Math.floor(p.y / GRID_CELL_M)}`) ?? [];
    const bestByWay = new Map<number, number>();
    for (const segmentIndex of candidates) {
      const segment = segments[segmentIndex]!;
      const distance = distancePointToSegment(p, segment.a, segment.b);
      if (distance > COURSE_TERRAIN_MATCH_MAX_M) continue;
      const current = bestByWay.get(segment.wayIndex);
      if (current === undefined || distance < current) bestByWay.set(segment.wayIndex, distance);
    }
    let bestWay: number | null = null;
    let bestDistance = Infinity;
    for (const [wayIndex, distance] of bestByWay) {
      if (distance < bestDistance) {
        bestWay = wayIndex;
        bestDistance = distance;
      }
    }
    if (bestWay !== null && previous !== null) {
      for (const [wayIndex, distance] of bestByWay) {
        if (ways[wayIndex]!.id === previous && distance <= bestDistance + COURSE_TERRAIN_CONTINUITY_BONUS_M) {
          bestWay = wayIndex;
          break;
        }
      }
    }
    if (bestWay === null) return OFF_PATH_MATCH;
    previous = ways[bestWay]!.id;
    return matchForWay(bestWay);
  });
  return { matches, lastWayId: previous };
}

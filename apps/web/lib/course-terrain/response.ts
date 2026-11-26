// Row -> CourseTerrainResponse / OrganizerCourseTerrain (contract in packages/shared/src/course-terrain).

import {
  COURSE_TERRAIN_ATTRIBUTION,
  COURSE_TERRAIN_ATTRIBUTION_URL,
  applyCourseTerrainOverrides,
  summarizeCourseTerrain,
  type CourseTerrainResponse,
  type OrganizerCourseTerrain,
} from "@trailplanner/shared";

import type { CourseTerrainRow } from "./store";

/**
 * - no row: `pending` when the race has a GPX (the trigger/backfill will queue it), else `no_route`;
 * - `ready` with segments: overrides applied, summary recomputed;
 * - `pending` / `processing`: `pending`; `failed` / `no_route`: `unavailable`.
 */
export function toCourseTerrainResponse(raceId: string, row: CourseTerrainRow | null, raceHasGpx: boolean): CourseTerrainResponse {
  if (!row) return raceHasGpx ? { status: "pending", raceId } : { status: "unavailable", raceId, reason: "no_route" };
  if (row.status === "no_route") return { status: "unavailable", raceId, reason: "no_route" };
  if (row.status === "failed") return { status: "unavailable", raceId, reason: "failed" };
  if (row.status !== "ready" || !row.osm_segments || row.distance_km === null || !row.coverage || !row.computed_at) {
    return { status: "pending", raceId };
  }
  const distanceKm = row.distance_km;
  const segments = applyCourseTerrainOverrides(row.osm_segments, row.organizer_overrides, distanceKm);
  return {
    status: "ready",
    raceId,
    distanceKm,
    segments,
    summary: summarizeCourseTerrain(segments, distanceKm),
    coverage: row.coverage,
    hasOrganizerOverrides: segments.some((segment) => segment.source === "organizer"),
    computedAt: row.computed_at,
    rulesVersion: row.rules_version ?? 0,
    attribution: COURSE_TERRAIN_ATTRIBUTION,
    attributionUrl: COURSE_TERRAIN_ATTRIBUTION_URL,
  };
}

export function toOrganizerCourseTerrain(raceId: string, row: CourseTerrainRow | null, raceHasGpx: boolean): OrganizerCourseTerrain {
  const terrain = toCourseTerrainResponse(raceId, row, raceHasGpx);
  const overrides = row?.organizer_overrides ?? [];
  return {
    terrain,
    osmSegments: terrain.status === "ready" ? row?.osm_segments ?? [] : [],
    overrides,
    overridesNeedReview: overrides.length > 0 && (row?.overrides_gpx_sha256 ?? null) !== (row?.gpx_sha256 ?? null),
  };
}

// CDN caching of GET /api/race-terrain. A `ready` answer is cached 1 h at the Vercel CDN under a
// per-race tag; organizer override writes and the cron purge that tag (same mechanism as the
// RaceBook routes, apps/web/lib/racebook-cache.ts), so the TTL only bounds staleness if the purge fails.

import { invalidateByTag } from "@vercel/functions";
import type { CourseTerrainResponse } from "@trailplanner/shared";

export const courseTerrainCacheTag = (raceId: string) => `course-terrain:race:${raceId}`;

export const COURSE_TERRAIN_READY_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
/** Pending answers flip to ready within minutes: keep them short. */
export const COURSE_TERRAIN_PENDING_CACHE_CONTROL = "public, s-maxage=60";
export const COURSE_TERRAIN_UNAVAILABLE_CACHE_CONTROL = "public, s-maxage=300";
export const COURSE_TERRAIN_NO_STORE = "no-store";

export function setCourseTerrainCacheHeaders(response: Response, body: CourseTerrainResponse) {
  const cacheControl =
    body.status === "ready"
      ? COURSE_TERRAIN_READY_CACHE_CONTROL
      : body.status === "pending"
        ? COURSE_TERRAIN_PENDING_CACHE_CONTROL
        : COURSE_TERRAIN_UNAVAILABLE_CACHE_CONTROL;
  response.headers.set("Cache-Control", cacheControl);
  response.headers.set("Vercel-Cache-Tag", courseTerrainCacheTag(body.raceId));
  return response;
}

/** Never throws: a failed purge must not roll back a write (the TTL is the fallback). */
export async function invalidateCourseTerrainCache(raceId: string) {
  if (process.env.VERCEL !== "1") return;
  try {
    await invalidateByTag([courseTerrainCacheTag(raceId)]);
  } catch (error) {
    console.warn("Unable to invalidate course terrain CDN cache", error);
  }
}

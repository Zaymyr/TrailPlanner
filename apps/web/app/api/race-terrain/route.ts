import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { COURSE_TERRAIN_NO_STORE, setCourseTerrainCacheHeaders } from "../../../lib/course-terrain/cache";
import { buildPublicCourseTerrain } from "../../../lib/course-terrain/service";
import { checkRateLimit, withSecurityHeaders } from "../../../lib/http";
import { getSupabaseServiceConfig } from "../../../lib/supabase";

const error = (message: string, status: number) => {
  const response = withSecurityHeaders(NextResponse.json({ message }, { status }));
  response.headers.set("Cache-Control", COURSE_TERRAIN_NO_STORE);
  return response;
};

/**
 * Display-only terrain classes along a runner-visible course (OpenStreetMap, ODbL). Contract:
 * `CourseTerrainResponse` in `packages/shared/src/course-terrain/types.ts`.
 */
export async function GET(request: NextRequest) {
  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`race-terrain:${rateLimitKey}`, 30, 60_000).allowed) return error("Too many requests.", 429);

  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return error("Invalid race id.", 400);
  const config = getSupabaseServiceConfig();
  if (!config) return error("Supabase configuration is missing.", 500);

  try {
    const result = await buildPublicCourseTerrain(config, raceId);
    if (result.kind === "not_found") return error("Race not found.", 404);
    return setCourseTerrainCacheHeaders(withSecurityHeaders(NextResponse.json(result.body)), result.body);
  } catch (cause) {
    console.error("Unable to build race terrain", cause);
    return error("Unable to load race terrain.", 502);
  }
}

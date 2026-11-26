import { NextResponse } from "next/server";

import { createCourseTerrainJobDeps } from "../../../../lib/course-terrain/service";
import { runCourseTerrainTick } from "../../../../lib/course-terrain/job";
import { withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
// The job keeps a 240 s work budget and persists each Overpass chunk, so long courses resume on
// the next tick instead of hitting this limit.
export const maxDuration = 300;

/**
 * Every 10 minutes (pg_cron + pg_net, see 20261126090000_course_terrain.sql): computes the
 * OpenStreetMap terrain of the due races, one at a time. Display-only, rules:
 * docs/03-business-rules/course-terrain.md.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const supabase = getSupabaseServiceConfig();
  if (!supabase) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));

  try {
    const result = await runCourseTerrainTick(createCourseTerrainJobDeps(supabase));
    return withSecurityHeaders(NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    console.error("Course terrain tick failed.", error instanceof Error ? error.message : error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to run the course terrain job." }, { status: 500 }));
  }
}

export const GET = POST;

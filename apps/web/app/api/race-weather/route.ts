import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildCourseWeather } from "../../../lib/course-weather/service";
import { checkRateLimit, withSecurityHeaders } from "../../../lib/http";
import { getSupabaseServiceConfig } from "../../../lib/supabase";

const NO_STORE = "no-store";

const json = (body: unknown, status: number, cacheControl: string) => {
  const response = withSecurityHeaders(NextResponse.json(body, { status }));
  response.headers.set("Cache-Control", cacheControl);
  return response;
};

/**
 * Display-only weather along a runner-visible course (MET Norway, CC BY 4.0). Contract:
 * `CourseWeatherResponse` in `packages/shared/src/course-weather/types.ts`.
 */
export async function GET(request: NextRequest) {
  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`race-weather:${rateLimitKey}`, 30, 60_000).allowed) {
    return json({ message: "Too many requests." }, 429, NO_STORE);
  }

  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return json({ message: "Invalid race id." }, 400, NO_STORE);
  const config = getSupabaseServiceConfig();
  if (!config) return json({ message: "Supabase configuration is missing." }, 500, NO_STORE);

  try {
    const result = await buildCourseWeather(config, raceId);
    if (result.kind === "not_found") return json({ message: "Race not found." }, 404, NO_STORE);
    const body = result.body;
    const cacheControl =
      body.status === "forecast"
        ? "public, s-maxage=1800, stale-while-revalidate=3600"
        : body.status === "too_early"
          ? "public, s-maxage=21600, stale-while-revalidate=3600"
          : NO_STORE;
    return json(body, 200, cacheControl);
  } catch (cause) {
    console.error("Unable to build race weather", cause);
    return json({ message: "Unable to load race weather." }, 502, NO_STORE);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { parseGpx } from "../../../../lib/gpx/parseGpx";
import { getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../../lib/supabase";
import { withSecurityHeaders } from "../../../../lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function samplePoints<T>(points: T[], maxCount: number): T[] {
  if (points.length <= maxCount) return points;
  const step = Math.ceil(points.length / maxCount);
  const result = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (last && result[result.length - 1] !== last) result.push(last);
  return result;
}

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");

  if (!raceId || !UUID_RE.test(raceId)) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid raceId." }, { status: 400 }));
  }

  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  // Fetch race's gpx_storage_path (no auth required — public live races)
  const raceRes = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}&is_live=eq.true&select=gpx_storage_path&limit=1`,
    {
      headers: { apikey: supabaseAnon.supabaseAnonKey },
      cache: "force-cache",
    }
  );

  if (!raceRes.ok) {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }

  const rows = (await raceRes.json().catch(() => [])) as Array<{ gpx_storage_path?: string | null }>;
  const gpxPath = rows[0]?.gpx_storage_path;

  if (!gpxPath) {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }

  // Fetch GPX using service role (private bucket)
  const gpxRes = await fetch(
    `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${gpxPath}`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "force-cache",
    }
  );

  if (!gpxRes.ok) {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }

  let parsedGpx;
  try {
    const gpxContent = await gpxRes.text();
    parsedGpx = parseGpx(gpxContent);
  } catch {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }

  const raw = parsedGpx.points
    .filter((p) => p.ele !== null)
    .map((p) => ({ distanceKm: p.distKmCum, elevationM: p.ele as number }));

  const elevationProfile = samplePoints(raw, 400);

  return withSecurityHeaders(
    NextResponse.json({ elevationProfile }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } })
  );
}

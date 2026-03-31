import { NextRequest, NextResponse } from "next/server";
import { parseGpx } from "../../../../lib/gpx/parseGpx";
import { getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../../lib/supabase";
import { withSecurityHeaders } from "../../../../lib/http";
import { getUtmbRaceData } from "../../../../lib/utmb-race-import";

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
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}&is_live=eq.true&select=gpx_storage_path,trace_provider,source_url,external_site_url&limit=1`,
    {
      headers: { apikey: supabaseAnon.supabaseAnonKey },
      cache: "force-cache",
    }
  );

  if (!raceRes.ok) {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }

  const rows = (await raceRes.json().catch(() => [])) as Array<{
    gpx_storage_path?: string | null;
    trace_provider?: string | null;
    source_url?: string | null;
    external_site_url?: string | null;
  }>;
  const race = rows[0] ?? null;
  const gpxPath = race?.gpx_storage_path ?? null;
  const sourceUrl = race?.source_url ?? race?.external_site_url ?? null;
  const traceProvider = race?.trace_provider ?? null;
  let elevationProfile: Array<{ distanceKm: number; elevationM: number }> = [];

  if (gpxPath) {
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

    if (gpxRes.ok) {
      try {
        const gpxContent = await gpxRes.text();
        const parsedGpx = parseGpx(gpxContent);
        const raw = parsedGpx.points
          .filter((point) => point.ele !== null)
          .map((point) => ({ distanceKm: point.distKmCum, elevationM: point.ele as number }));

        elevationProfile = samplePoints(raw, 400);
      } catch {
        elevationProfile = [];
      }
    }
  }

  if (elevationProfile.length === 0 && sourceUrl && traceProvider === "utmb") {
    try {
      const utmbRace = await getUtmbRaceData(sourceUrl);
      elevationProfile = samplePoints(utmbRace.elevationProfile, 400);
    } catch {
      elevationProfile = [];
    }
  }

  return withSecurityHeaders(
    NextResponse.json({ elevationProfile }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } })
  );
}

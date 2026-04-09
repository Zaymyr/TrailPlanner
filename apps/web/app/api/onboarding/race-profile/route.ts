import { NextRequest, NextResponse } from "next/server";
import { parseGpx } from "../../../../lib/gpx/parseGpx";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../lib/supabase";
import { withSecurityHeaders } from "../../../../lib/http";
import { getUtmbRaceData } from "../../../../lib/utmb-race-import";
import { getTraceDeTrailRaceData } from "../../../../lib/tracedetrail-race-import";

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
  const token = extractBearerToken(request.headers.get("authorization"));
  const currentUser = token ? await fetchSupabaseUser(token, supabaseAnon) : null;

  const raceRes = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=gpx_storage_path,trace_provider,trace_id,source_url,external_site_url,is_live,is_public,created_by,race_events(is_live)&limit=1`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!raceRes.ok) {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }

  const rows = (await raceRes.json().catch(() => [])) as Array<{
    gpx_storage_path?: string | null;
    trace_provider?: string | null;
    trace_id?: number | null;
    source_url?: string | null;
    external_site_url?: string | null;
    is_live?: boolean | null;
    is_public?: boolean | null;
    created_by?: string | null;
    race_events?: { is_live?: boolean | null } | Array<{ is_live?: boolean | null }> | null;
  }>;
  const race = rows[0] ?? null;
  const eventIsLive = Array.isArray(race?.race_events)
    ? race.race_events.some((event) => event?.is_live === true)
    : race?.race_events?.is_live === true;
  const canAccess = Boolean(
    race &&
      (race.is_live === true ||
        race.is_public === true ||
        eventIsLive ||
        (currentUser?.id && race.created_by === currentUser.id)),
  );
  if (!canAccess) {
    return withSecurityHeaders(NextResponse.json({ elevationProfile: [] }));
  }
  const gpxPath = race?.gpx_storage_path ?? null;
  const sourceUrl = race?.source_url ?? race?.external_site_url ?? null;
  const traceProvider = race?.trace_provider ?? null;
  const traceId = typeof race?.trace_id === "number" && Number.isFinite(race.trace_id) ? race.trace_id : null;
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

  if (elevationProfile.length === 0 && traceProvider === "tracedetrail") {
    const traceDeTrailUrl = sourceUrl ?? (traceId ? `https://tracedetrail.fr/fr/trace/${traceId}` : null);

    if (traceDeTrailUrl) {
      try {
        const traceDeTrailRace = await getTraceDeTrailRaceData(traceDeTrailUrl);
        elevationProfile = samplePoints(traceDeTrailRace.elevationProfile, 400);
      } catch {
        elevationProfile = [];
      }
    }
  }

  if (elevationProfile.length === 0) {
    const fallbackPlanRes = await fetch(
      `${supabaseService.supabaseUrl}/rest/v1/race_plans?race_id=eq.${raceId}&select=elevation_profile,updated_at&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (fallbackPlanRes.ok) {
      const fallbackRows = (await fallbackPlanRes.json().catch(() => [])) as Array<{
        elevation_profile?: Array<{ distanceKm?: unknown; elevationM?: unknown }> | null;
      }>;
      const fallbackProfile = Array.isArray(fallbackRows[0]?.elevation_profile)
        ? fallbackRows[0]?.elevation_profile ?? []
        : [];

      elevationProfile = samplePoints(
        fallbackProfile.flatMap((point) => {
          const distanceKm =
            typeof point?.distanceKm === "number" && Number.isFinite(point.distanceKm) ? point.distanceKm : null;
          const elevationM =
            typeof point?.elevationM === "number" && Number.isFinite(point.elevationM) ? point.elevationM : null;

          if (distanceKm === null || elevationM === null) return [];

          return [{ distanceKm, elevationM }];
        }),
        400
      );
    }
  }

  return withSecurityHeaders(
    NextResponse.json(
      { elevationProfile },
      {
        headers: {
          "Cache-Control":
            race?.is_live === true ? "public, max-age=3600, s-maxage=3600" : "private, no-store",
        },
      }
    )
  );
}

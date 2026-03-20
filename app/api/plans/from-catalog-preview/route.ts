import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../../lib/gpx/parseGpx";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../../lib/supabase";

const bodySchema = z.object({
  catalogRaceId: z.string().uuid(),
});

const catalogRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  gpx_storage_path: z.string().nullable().optional(),
});

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371e3;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const mapWaypointsToAidStations = (
  points: Array<{ lat: number; lng: number; distKmCum: number }>,
  waypoints: Array<{ lat: number; lng: number; name?: string | null; desc?: string | null }>
) =>
  waypoints.map((waypoint, index) => {
    let closest = points[0];
    let minDistance = Number.POSITIVE_INFINITY;

    points.forEach((point) => {
      const distance = haversineDistance(point.lat, point.lng, waypoint.lat, waypoint.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closest = point;
      }
    });

    const name = waypoint.name?.trim() || waypoint.desc?.trim() || `Aid station ${index + 1}`;
    return { name, distanceKm: Number(closest.distKmCum.toFixed(1)), waterRefill: true };
  });

export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  const rateLimit = checkRateLimit(`catalog-preview:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const catalogRaceResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/race_catalog?id=eq.${parsedBody.data.catalogRaceId}&is_live=eq.true&select=id,name,distance_km,elevation_gain_m,gpx_storage_path&limit=1`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!catalogRaceResponse.ok) {
    console.error("Unable to load catalog race preview", await catalogRaceResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race." }, { status: 502 }));
  }

  const catalogRace = z.array(catalogRaceSchema).parse(await catalogRaceResponse.json())?.[0];

  if (!catalogRace) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
  }

  if (!catalogRace.gpx_storage_path) {
    return withSecurityHeaders(NextResponse.json({ message: "This race has no GPX available." }, { status: 409 }));
  }

  const gpxResponse = await fetch(
    `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${catalogRace.gpx_storage_path}`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!gpxResponse.ok) {
    console.error("Unable to download catalog GPX preview", await gpxResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to read race GPX." }, { status: 502 }));
  }

  const gpxContent = await gpxResponse.text();
  let parsedGpx;

  try {
    parsedGpx = parseGpx(gpxContent);
  } catch (error) {
    console.error("Unable to parse catalog GPX preview", error);
    return withSecurityHeaders(NextResponse.json({ message: "Invalid GPX file." }, { status: 422 }));
  }

  const elevationProfile = parsedGpx.points.map((point) => ({
    distanceKm: Number(point.distKmCum.toFixed(2)),
    elevationM: Number((point.ele ?? 0).toFixed(1)),
  }));

  const plannerValues = {
    raceDistanceKm: parsedGpx.stats.distanceKm || Number(catalogRace.distance_km),
    elevationGain: parsedGpx.stats.gainM || Number(catalogRace.elevation_gain_m),
    aidStations: mapWaypointsToAidStations(parsedGpx.points, parsedGpx.waypoints),
  };

  return withSecurityHeaders(
    NextResponse.json({ name: catalogRace.name, plannerValues, elevationProfile })
  );
}

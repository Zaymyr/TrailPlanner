import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { haversineMeters, parseGpx } from "../../../../../lib/gpx/parseGpx";
import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const catalogRaceSchema = z.object({
  id: z.string().uuid(),
  gpx_storage_path: z.string().nullable().optional(),
});

export async function GET(_request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race id." }, { status: 400 }));
  }

  const raceResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}&is_live=eq.true&select=id,gpx_storage_path&limit=1`,
    {
      headers: {
        apikey: supabaseAnon.supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnon.supabaseAnonKey}`,
      },
      cache: "no-store",
    }
  );

  if (!raceResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race." }, { status: 502 }));
  }

  const race = z.array(catalogRaceSchema).parse(await raceResponse.json())?.[0];

  if (!race) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
  }

  if (!race.gpx_storage_path) {
    return withSecurityHeaders(NextResponse.json({ message: "This race has no GPX available." }, { status: 409 }));
  }

  const gpxResponse = await fetch(
    `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${race.gpx_storage_path}`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!gpxResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to read race GPX." }, { status: 502 }));
  }

  const gpxContent = await gpxResponse.text();

  return withSecurityHeaders(
    new NextResponse(gpxContent, {
      status: 200,
      headers: { "Content-Type": "application/gpx+xml" },
    })
  );
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race id." }, { status: 400 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (!isAdminUser(supabaseUser)) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  const rateLimit = checkRateLimit(`race-catalog-update:${supabaseUser.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid form data." }, { status: 400 }));
  }

  const gpxFile = formData.get("gpx");

  if (!(gpxFile instanceof File)) {
    return withSecurityHeaders(NextResponse.json({ message: "GPX file is required." }, { status: 400 }));
  }

  const gpxContent = await gpxFile.text();
  let parsedGpx;

  try {
    parsedGpx = parseGpx(gpxContent);
  } catch (error) {
    console.error("Unable to parse GPX in /api/race-catalog/[id]/gpx", error);
    const details = error instanceof Error ? error.message : "Unknown parse error";
    return withSecurityHeaders(NextResponse.json({ message: `Invalid GPX file: ${details}` }, { status: 422 }));
  }

  const storagePath = `catalog/${parsedParams.data.id}/${Date.now()}.gpx`;

  const uploadResponse = await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": gpxFile.type || "application/gpx+xml",
      "x-upsert": "true",
    },
    body: gpxFile,
  });

  if (!uploadResponse.ok) {
    console.error("Unable to upload GPX", await uploadResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to upload GPX file." }, { status: 502 }));
  }

  const gpxSha = createHash("sha256").update(gpxContent).digest("hex");

  const updateResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnon.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        gpx_storage_path: storagePath,
        gpx_sha256: gpxSha,
        distance_km: parsedGpx.stats.distanceKm,
        elevation_gain_m: parsedGpx.stats.gainM,
        elevation_loss_m: parsedGpx.stats.lossM,
        min_alt_m: parsedGpx.stats.minAltM,
        max_alt_m: parsedGpx.stats.maxAltM,
        start_lat: parsedGpx.stats.startLat,
        start_lng: parsedGpx.stats.startLng,
        bounds_min_lat: parsedGpx.stats.boundsMinLat,
        bounds_min_lng: parsedGpx.stats.boundsMinLng,
        bounds_max_lat: parsedGpx.stats.boundsMaxLat,
        bounds_max_lng: parsedGpx.stats.boundsMaxLng,
      }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update race catalog", await updateResponse.text());
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    });
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update race." }, { status: 502 }));
  }

  const updated = await updateResponse.json();

  // Extract aid stations from waypoints and persist them
  try {
    // Delete existing aid stations for this race
    const deleteResponse = await fetch(
      `${supabaseService.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}`,
      {
        method: "DELETE",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
      }
    );
    if (!deleteResponse.ok) {
      console.error("Unable to delete existing aid stations", await deleteResponse.text());
    }

    // Insert new aid stations from GPX waypoints
    if (parsedGpx.waypoints.length > 0) {
      const aidStations = parsedGpx.waypoints.map((wpt, index) => {
        let closestDistKm = 0;
        let minDist = Infinity;
        for (const pt of parsedGpx.points) {
          const d = haversineMeters(wpt.lat, wpt.lng, pt.lat, pt.lng);
          if (d < minDist) {
            minDist = d;
            closestDistKm = pt.distKmCum;
          }
        }
        return {
          race_id: parsedParams.data.id,
          name: wpt.name ?? wpt.desc ?? `Aid Station ${index + 1}`,
          km: closestDistKm,
          water_available: true,
          notes: wpt.desc && wpt.name ? wpt.desc : null,
          order_index: index,
        };
      });

      const insertResponse = await fetch(`${supabaseService.supabaseUrl}/rest/v1/race_aid_stations`, {
        method: "POST",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aidStations),
      });
      if (!insertResponse.ok) {
        console.error("Unable to insert aid stations", await insertResponse.text());
      }
    }
  } catch (error) {
    console.error("Unexpected error while saving aid stations", error);
  }

  return withSecurityHeaders(NextResponse.json({ race: updated?.[0] ?? null }));
}

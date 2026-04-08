import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserEntitlements } from "../../../../lib/entitlements";
import { parseGpx } from "../../../../lib/gpx/parseGpx";
import { normalizeImportedWaypoints } from "../../../../lib/gpx/normalizeImportedWaypoints";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../lib/supabase";

const bodySchema = z.object({
  catalogRaceId: z.string().uuid(),
});

const catalogRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  gpx_sha256: z.string().nullable().optional(),
  updated_at: z.string(),
  race_aid_stations: z
    .array(
      z.object({
        name: z.string(),
        km: z.number(),
        water_available: z.boolean().nullable().optional(),
        order_index: z.number().nullable().optional(),
      })
    )
    .optional()
    .default([]),
});

const plannerValuesSchema = z
  .object({
    segments: z.record(z.array(z.unknown())).optional(),
  })
  .passthrough();

const planRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  planner_values: plannerValuesSchema,
  elevation_profile: z.array(z.unknown()).optional().default([]),
});

const buildAuthHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const mapWaypointsToAidStations = (
  points: Array<{ lat: number; lng: number; distKmCum: number }>,
  waypoints: Array<{ lat: number; lng: number; name?: string | null; desc?: string | null }>
) =>
  normalizeImportedWaypoints(points, waypoints).aidStations.map((station) => ({
    name: station.name,
    distanceKm: station.distanceKm,
    waterRefill: true,
  }));

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

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`plans-from-catalog:${supabaseUser.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() },
        }
      )
    );
  }

  const entitlements = await getUserEntitlements(supabaseUser.id);

  if (!entitlements.isPremium && Number.isFinite(entitlements.planLimit)) {
    const existingPlansResponse = await fetch(
      `${supabaseAnon.supabaseUrl}/rest/v1/race_plans?select=id&limit=${entitlements.planLimit}`,
      {
        headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
        cache: "no-store",
      }
    );

    if (!existingPlansResponse.ok) {
      console.error("Unable to evaluate plan count", await existingPlansResponse.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to create plan." }, { status: 500 })
      );
    }

    const existingPlans = (await existingPlansResponse.json().catch(() => [])) as Array<{ id?: string }>;

    if (existingPlans.length >= entitlements.planLimit) {
      return withSecurityHeaders(
        NextResponse.json({ message: "A premium plan is required to save additional plans." }, { status: 402 })
      );
    }
  }

  // Idempotency guard: if the user already has a plan for this catalog race
  // created in the last 90 seconds, return that plan instead of creating another.
  // This prevents duplicates from page refresh, back navigation, or React Strict Mode
  // double-invocations while the URL param is still present.
  const recentPlanCutoff = new Date(Date.now() - 90_000).toISOString();
  const recentPlanResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/race_plans?race_id=eq.${parsedBody.data.catalogRaceId}&created_at=gte.${recentPlanCutoff}&select=id,name,created_at,updated_at,planner_values,elevation_profile&order=created_at.desc&limit=1`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );
  if (recentPlanResponse.ok) {
    const recentPlans = (await recentPlanResponse.json().catch(() => [])) as Array<Record<string, unknown>>;
    if (recentPlans.length > 0) {
      const existing = planRowSchema.safeParse(recentPlans[0]);
      if (existing.success) {
        return withSecurityHeaders(NextResponse.json({ plan: existing.data }));
      }
    }
  }

  const catalogRaceResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${parsedBody.data.catalogRaceId}&is_live=eq.true&select=id,name,distance_km,elevation_gain_m,elevation_loss_m,gpx_storage_path,gpx_sha256,updated_at,race_aid_stations(name,km,water_available,order_index)&limit=1`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!catalogRaceResponse.ok) {
    console.error("Unable to load catalog race", await catalogRaceResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race." }, { status: 502 }));
  }

  const catalogRace = z.array(catalogRaceSchema).parse(await catalogRaceResponse.json())?.[0];

  if (!catalogRace) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
  }

  if (!catalogRace.gpx_storage_path) {
    return withSecurityHeaders(NextResponse.json({ message: "This race has no GPX available." }, { status: 409 }));
  }

  const planId = randomUUID();
  const planGpxPath = `${supabaseUser.id}/${planId}.gpx`;

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
    console.error("Unable to download catalog GPX", await gpxResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to read race GPX." }, { status: 502 }));
  }

  const gpxContent = await gpxResponse.text();
  let parsedGpx;

  try {
    parsedGpx = parseGpx(gpxContent);
  } catch (error) {
    console.error("Unable to parse catalog GPX", error);
    return withSecurityHeaders(NextResponse.json({ message: "Invalid GPX file." }, { status: 422 }));
  }

  const copyResponse = await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/copy`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: "race-gpx",
      sourceKey: catalogRace.gpx_storage_path,
      destinationBucket: "plan-gpx",
      destinationKey: planGpxPath,
    }),
  });

  if (!copyResponse.ok) {
    console.error("Unable to copy catalog GPX", await copyResponse.text());
    const uploadResponse = await fetch(
      `${supabaseService.supabaseUrl}/storage/v1/object/plan-gpx/${planGpxPath}`,
      {
        method: "POST",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/gpx+xml",
          "x-upsert": "true",
        },
        body: gpxContent,
      }
    );

    if (!uploadResponse.ok) {
      console.error("Unable to upload catalog GPX", await uploadResponse.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to copy race GPX." }, { status: 502 })
      );
    }
  }

  const elevationProfile = parsedGpx.points.map((point) => ({
    distanceKm: Number(point.distKmCum.toFixed(2)),
    elevationM: Number((point.ele ?? 0).toFixed(1)),
  }));

  const plannerAidStations =
    catalogRace.race_aid_stations.length > 0
      ? [...catalogRace.race_aid_stations]
          .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
          .map((station) => ({
            name: station.name,
            distanceKm: station.km,
            waterRefill: station.water_available !== false,
          }))
      : parsedGpx.pointSource !== "waypoint"
        ? mapWaypointsToAidStations(parsedGpx.points, parsedGpx.waypoints)
        : [];

  const plannerValues = {
    raceDistanceKm: parsedGpx.stats.distanceKm || Number(catalogRace.distance_km),
    elevationGain: parsedGpx.stats.gainM || Number(catalogRace.elevation_gain_m),
    aidStations: plannerAidStations,
  };

  const gpxHash = catalogRace.gpx_sha256 ?? createHash("sha256").update(gpxContent).digest("hex");

  const planCourseStats = {
    distanceKm: parsedGpx.stats.distanceKm,
    elevationGainM: parsedGpx.stats.gainM,
    elevationLossM: parsedGpx.stats.lossM,
    minAltM: parsedGpx.stats.minAltM,
    maxAltM: parsedGpx.stats.maxAltM,
    startLat: parsedGpx.stats.startLat,
    startLng: parsedGpx.stats.startLng,
    gpxHash,
  };

  const planResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/race_plans`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: planId,
      name: catalogRace.name,
      planner_values: plannerValues,
      elevation_profile: elevationProfile,
      race_id: catalogRace.id,
      catalog_race_updated_at_at_import: catalogRace.updated_at,
      plan_gpx_path: planGpxPath,
      plan_course_stats: planCourseStats,
    }),
    cache: "no-store",
  });

  if (!planResponse.ok) {
    console.error("Unable to create catalog plan", await planResponse.text());
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/plan-gpx/${planGpxPath}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    });
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create plan." }, { status: 502 }));
  }

  const planRow = planRowSchema.parse((await planResponse.json())?.[0]);

  if (plannerAidStations.length > 0) {
    const insertResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/plan_aid_stations`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(
        plannerAidStations.map((station, index) => ({
          plan_id: planId,
          name: station.name,
          km: station.distanceKm,
          water_available: station.waterRefill ?? true,
          notes: null,
          order_index: index,
        }))
      ),
      cache: "no-store",
    });

    if (!insertResponse.ok) {
      console.error("Unable to create plan aid stations", await insertResponse.text());
      await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/race_plans?id=eq.${planId}`, {
        method: "DELETE",
        headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
        cache: "no-store",
      });
      await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/plan-gpx/${planGpxPath}`, {
        method: "DELETE",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
      });

      return withSecurityHeaders(NextResponse.json({ message: "Unable to create plan." }, { status: 502 }));
    }
  }

  return withSecurityHeaders(NextResponse.json({ plan: planRow }));
}

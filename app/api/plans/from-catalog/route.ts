import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserEntitlements } from "../../../../lib/entitlements";
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
  gpx_path: z.string(),
  gpx_hash: z.string(),
  updated_at: z.string(),
});

const catalogAidStationSchema = z.object({
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  notes: z.string().nullable().optional(),
  order_index: z.number().optional(),
});

const planRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  planner_values: z.record(z.unknown()),
  elevation_profile: z.array(z.unknown()).optional().default([]),
});

const buildAuthHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
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

  const catalogRaceResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/race_catalog?id=eq.${parsedBody.data.catalogRaceId}&select=id,name,distance_km,elevation_gain_m,gpx_path,gpx_hash,updated_at&limit=1`,
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

  const catalogAidStationsResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/race_catalog_aid_stations?race_id=eq.${catalogRace.id}&select=name,km,water_available,notes,order_index&order=order_index.asc`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!catalogAidStationsResponse.ok) {
    console.error("Unable to load catalog aid stations", await catalogAidStationsResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race." }, { status: 502 }));
  }

  const catalogAidStations = z
    .array(catalogAidStationSchema)
    .parse(await catalogAidStationsResponse.json())
    .map((station, index) => ({
      ...station,
      order_index: station.order_index ?? index,
    }));

  const planId = randomUUID();
  const planGpxPath = `${supabaseUser.id}/${planId}.gpx`;

  const copyResponse = await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/copy`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: "race-catalog-gpx",
      sourceKey: catalogRace.gpx_path,
      destinationBucket: "plan-gpx",
      destinationKey: planGpxPath,
    }),
  });

  if (!copyResponse.ok) {
    console.error("Unable to copy catalog GPX", await copyResponse.text());
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to copy race GPX." }, { status: 502 })
    );
  }

  const plannerAidStations = catalogAidStations.map((station) => ({
    name: station.name,
    distanceKm: Number(station.km),
    waterRefill: station.water_available,
  }));

  const plannerValues = {
    raceDistanceKm: Number(catalogRace.distance_km),
    elevationGain: Number(catalogRace.elevation_gain_m),
    aidStations: plannerAidStations,
  };

  const planCourseStats = {
    distanceKm: Number(catalogRace.distance_km),
    elevationGainM: Number(catalogRace.elevation_gain_m),
    gpxHash: catalogRace.gpx_hash,
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
      elevation_profile: [],
      catalog_race_id: catalogRace.id,
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

  if (catalogAidStations.length > 0) {
    const insertResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/plan_aid_stations`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(
        catalogAidStations.map((station) => ({
          plan_id: planId,
          name: station.name,
          km: station.km,
          water_available: station.water_available,
          notes: station.notes ?? null,
          order_index: station.order_index ?? 0,
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

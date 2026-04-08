import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../lib/supabase";

const paramsSchema = z.object({ id: z.string().uuid() });

const aidStationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

const aidStationInputSchema = z.object({
  name: z.string().trim().min(1),
  distanceKm: z.number().nonnegative(),
  waterRefill: z.boolean().optional().default(true),
});

const updateAidStationsSchema = z.object({
  aidStations: z.array(aidStationInputSchema),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}&select=id,name,km,water_available,notes,order_index&order=order_index.asc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load race catalog aid stations", await response.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to load aid stations." }, { status: 502 })
      );
    }

    const rows = z.array(aidStationRowSchema).parse(await response.json());

    return withSecurityHeaders(NextResponse.json({ aidStations: rows }));
  } catch (error) {
    console.error("Unexpected error while loading race catalog aid stations", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load aid stations." }, { status: 500 }));
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
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

  if (!isAdminUser(supabaseUser)) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  const rateLimit = checkRateLimit(`race-catalog-aid-stations:${supabaseUser.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const parsedBody = updateAidStationsSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid aid stations." }, { status: 400 }));
  }

  const raceResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}&select=id&limit=1`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!raceResponse.ok) {
    console.error("Unable to verify race before updating aid stations", await raceResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify race." }, { status: 502 }));
  }

  const races = z.array(z.object({ id: z.string().uuid() })).parse(await raceResponse.json());
  if (!races[0]) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
  }

  const deleteResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}`,
    {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete existing aid stations", await deleteResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update aid stations." }, { status: 502 }));
  }

  if (parsedBody.data.aidStations.length === 0) {
    return withSecurityHeaders(NextResponse.json({ aidStations: [] }));
  }

  const insertResponse = await fetch(`${supabaseService.supabaseUrl}/rest/v1/race_aid_stations`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(
      parsedBody.data.aidStations.map((station, index) => ({
        race_id: parsedParams.data.id,
        name: station.name,
        km: station.distanceKm,
        water_available: station.waterRefill,
        notes: null,
        order_index: index,
      }))
    ),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to insert aid stations", await insertResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update aid stations." }, { status: 502 }));
  }

  const rows = z.array(aidStationRowSchema).parse(await insertResponse.json());

  return withSecurityHeaders(NextResponse.json({ aidStations: rows }));
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../lib/supabase";

const updateRaceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  distance_km: z.number().positive().optional(),
  elevation_gain_m: z.number().nonnegative().optional(),
  elevation_loss_m: z.number().nonnegative().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
});

const buildAuthHeaders = (key: string, token: string, contentType = "application/json") => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: raceId } = await params;

  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration error." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const parsedBody = updateRaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  // Verify ownership by attempting update with user_id filter (RLS also enforces this)
  const checkResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}&created_by=eq.${user.id}&select=id&limit=1`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!checkResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify ownership." }, { status: 502 }));
  }

  const owned = await checkResponse.json();
  if (!owned?.length) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found or not authorized." }, { status: 404 }));
  }

  const updates: Record<string, unknown> = {};
  const body = parsedBody.data;
  if (body.name !== undefined) updates.name = body.name;
  if (body.distance_km !== undefined) updates.distance_km = body.distance_km;
  if (body.elevation_gain_m !== undefined) updates.elevation_gain_m = body.elevation_gain_m;
  if (body.elevation_loss_m !== undefined) updates.elevation_loss_m = body.elevation_loss_m;
  if (body.location_text !== undefined) updates.location_text = body.location_text;
  if (body.race_date !== undefined) updates.race_date = body.race_date;

  const updateResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}`,
    {
      method: "PATCH",
      headers: {
        ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
        Prefer: "return=representation",
      },
      body: JSON.stringify(updates),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update race", await updateResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update race." }, { status: 502 }));
  }

  const rows = await updateResponse.json();
  return withSecurityHeaders(NextResponse.json({ race: rows?.[0] ?? null }));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: raceId } = await params;

  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration error." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  // Verify ownership
  const checkResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}&created_by=eq.${user.id}&select=id,gpx_storage_path&limit=1`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!checkResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify ownership." }, { status: 502 }));
  }

  const owned: Array<{ id: string; gpx_storage_path?: string | null }> = await checkResponse.json();
  if (!owned?.length) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found or not authorized." }, { status: 404 }));
  }

  const race = owned[0];

  // Nullify race_id on associated plans to orphan them rather than cascade delete
  await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/race_plans?race_id=eq.${raceId}`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
      body: JSON.stringify({ race_id: null }),
      cache: "no-store",
    }
  );

  // Delete the race (RLS enforces ownership)
  const deleteResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete race", await deleteResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete race." }, { status: 502 }));
  }

  // Clean up GPX from storage
  if (race.gpx_storage_path) {
    await fetch(
      `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${race.gpx_storage_path}`,
      {
        method: "DELETE",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
      }
    ).catch((err) => console.error("Unable to delete race GPX from storage", err));
  }

  return withSecurityHeaders(NextResponse.json({ success: true }));
}

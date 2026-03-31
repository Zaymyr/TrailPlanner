import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  slug: z.string(),
  created_at: z.string().optional(),
  race_events: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
      thumbnail_url: z.string().nullable().optional(),
      is_live: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export async function GET(request: NextRequest) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);
  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (!isAdminUser(supabaseUser)) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/races?select=id,name,event_id,location_text,location,distance_km,elevation_gain_m,elevation_loss_m,trace_provider,trace_id,external_site_url,thumbnail_url,gpx_storage_path,is_live,slug,created_at,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=name.asc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load race catalog", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load race catalog." }, { status: 502 }));
    }

    const rows = z.array(raceRowSchema).parse(await response.json());

    return withSecurityHeaders(NextResponse.json({ races: rows }));
  } catch (error) {
    console.error("Unexpected error while loading race catalog", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race catalog." }, { status: 500 }));
  }
}

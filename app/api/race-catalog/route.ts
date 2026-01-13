import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { getSupabaseAnonConfig } from "../../../lib/supabase";

const querySchema = z.object({
  search: z.string().trim().min(1).optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  source_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsedQuery.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid query." }, { status: 400 }));
  }

  const search = parsedQuery.data.search;
  const filter = search
    ? `&or=(name.ilike.*${encodeURIComponent(search)}*,location.ilike.*${encodeURIComponent(search)}*,slug.ilike.*${encodeURIComponent(
        search
      )}*)`
    : "";

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_catalog?select=id,slug,name,location,distance_km,elevation_gain_m,source_url,image_url&order=name.asc${filter}`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";
import { serviceHeaders } from "../../../../lib/organizer";

const eventRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        distance_km: z.number().nullable().optional(),
      })
    )
    .nullable()
    .optional(),
});

const sanitizeSearch = (value: string) => value.replace(/[%_*\\]/g, "").trim();

export async function GET(request: NextRequest) {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const search = sanitizeSearch(request.nextUrl.searchParams.get("search") ?? "");
  const filter = search
    ? `&or=(name.ilike.*${encodeURIComponent(search)}*,location.ilike.*${encodeURIComponent(search)}*)`
    : "";

  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,location,race_date,thumbnail_url,is_live,races(id,name,distance_km)&is_live=eq.true&order=name.asc&limit=25${filter}`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to search organizer race events", await response.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to search events." }, { status: 502 }));
  }

  const events = z.array(eventRowSchema).parse(await response.json());
  return withSecurityHeaders(NextResponse.json({ events }));
}

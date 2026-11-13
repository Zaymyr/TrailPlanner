import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ id: z.string().uuid() });
const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  race_date: z.string().nullable(),
});
const eventSchema = z.object({
  id: z.string().uuid(),
  race_date: z.string().nullable().optional().default(null),
});

const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}` });

export async function GET(_request: NextRequest, { params }: { params: { id?: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race id." }, { status: 400 }));
  }
  const service = getSupabaseServiceConfig();
  if (!service) {
    return withSecurityHeaders(NextResponse.json({ message: "Race catalog unavailable." }, { status: 503 }));
  }

  try {
    const raceResponse = await fetch(
      `${service.supabaseUrl}/rest/v1/races?id=eq.${encodeURIComponent(parsed.data.id)}&web_catalog_is_live=eq.true&is_public=eq.true&select=id,event_id,name,slug,distance_km,elevation_gain_m,race_date&limit=1`,
      { headers: headers(service.supabaseServiceRoleKey), next: { revalidate: 900 } },
    );
    if (!raceResponse.ok) throw new Error(`race summary read failed (${raceResponse.status})`);
    const race = z.array(raceSchema).parse(await raceResponse.json())[0];
    if (!race) return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));

    let eventDate: string | null = null;
    if (race.event_id) {
      const eventResponse = await fetch(
        `${service.supabaseUrl}/rest/v1/race_events?id=eq.${encodeURIComponent(race.event_id)}&is_live=eq.true&select=id,race_date&limit=1`,
        { headers: headers(service.supabaseServiceRoleKey), next: { revalidate: 900 } },
      );
      if (!eventResponse.ok) throw new Error(`race event summary read failed (${eventResponse.status})`);
      const event = z.array(eventSchema).parse(await eventResponse.json())[0];
      if (!event) {
        return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
      }
      eventDate = event.race_date;
    }

    return withSecurityHeaders(NextResponse.json({
      race: {
        id: race.id,
        name: race.name,
        slug: race.slug,
        distanceKm: race.distance_km,
        elevationGainM: race.elevation_gain_m,
        date: race.race_date ?? eventDate,
      },
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } }));
  } catch (error) {
    console.error("Unable to load public race summary", error);
    return withSecurityHeaders(NextResponse.json({ message: "Race catalog unavailable." }, { status: 502 }));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { isOrganizerForEvent, serviceHeaders } from "../../../lib/organizer";
import { hasOrganizerRacebookContent } from "../../../lib/racebook-sponsors";
import { setPrivateRacebookCacheHeaders, setPublicRacebookCacheHeaders } from "../../../lib/racebook-cache";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../lib/supabase";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable(),
  name: z.string(),
  distance_km: z.coerce.number(),
  elevation_gain_m: z.coerce.number().nullable().optional(),
  elevation_loss_m: z.coerce.number().nullable().optional(),
  race_date: z.string().nullable().optional(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  racebook_preview_is_visible: z.boolean().default(true),
  thumbnail_url: z.string().nullable().optional(),
  location_text: z.string().nullable().optional(),
  participation_mode: z.string().nullable().optional(),
  start_lat: z.coerce.number().nullable().optional(),
  start_lng: z.coerce.number().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  race_events: z.union([
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
      thumbnail_url: z.string().nullable().optional(),
      is_live: z.boolean(),
      organizer_details: z.unknown().nullable().optional(),
    }),
    z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
      thumbnail_url: z.string().nullable().optional(),
      is_live: z.boolean(),
      organizer_details: z.unknown().nullable().optional(),
    })),
    z.null(),
  ]),
});

const raceSelect = [
  "id", "event_id", "edition_id", "name", "distance_km", "elevation_gain_m", "elevation_loss_m",
  "race_date", "is_live", "racebook_is_live", "racebook_preview_is_visible", "thumbnail_url",
  "location_text", "participation_mode", "start_lat", "start_lng", "organizer_details",
  "race_events(id,name,location,race_date,thumbnail_url,is_live,organizer_details)",
].join(",");

const stationSelect = "id,name,km,water_available,solid_available,assistance_allowed,notes,order_index,organizer_details,race_aid_station_products(id,notes,order_index,products(id,name,brand))";
const relaySelect = "id,race_aid_station_id,name,km,handover_time,cutoff_time,notes,order_index";
const waveSelect = "id,name,start_time,eligibility_type,bib_number_min,bib_number_max,finish_minutes_min,finish_minutes_max,pace_seconds_min,pace_seconds_max,eligibility_note,order_index";
const awardSelect = "id,category_key,category_label,audience,place_from,place_to,podium_time,podium_location,reward_note,order_index";
const serviceSelect = "id,service_type,name,description,address,latitude,longitude,google_maps_url,website_url,phone,order_index";

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

async function readRows(response: Response | null, required: boolean) {
  if (!response) return [];
  if (!response.ok) {
    if (required) throw new Error(await response.text());
    return [];
  }
  const value = await response.json().catch(() => []);
  return Array.isArray(value) ? value : [];
}

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return jsonError("Invalid race id.", 400);

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return jsonError("Supabase configuration is missing.", 500);

  const raceResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=${raceSelect}&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!raceResponse.ok) return jsonError("Unable to load RaceBook.", 502);

  const race = z.array(raceSchema).parse(await raceResponse.json())[0] ?? null;
  if (!race || race.racebook_preview_is_visible === false || !race.event_id) {
    return jsonError("RaceBook not available.", 404);
  }

  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events;
  if (!event || !hasOrganizerRacebookContent(event.organizer_details, race.organizer_details, race.participation_mode)) {
    return jsonError("RaceBook not available.", 404);
  }

  const isPublic = race.is_live && race.racebook_is_live && event.is_live;
  if (!isPublic) {
    const token = extractBearerToken(request.headers.get("authorization"));
    const anonConfig = getSupabaseAnonConfig();
    const user = token && anonConfig ? await fetchSupabaseUser(token, anonConfig) : null;
    if (!user?.id || !(await isOrganizerForEvent(serviceConfig, user.id, race.event_id))) {
      return jsonError("RaceBook not available.", 404);
    }
  }

  const urls = [
    `${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=${stationSelect}&order=order_index.asc`,
    `${serviceConfig.supabaseUrl}/rest/v1/race_relay_points?race_id=eq.${raceId}&select=${relaySelect}&order=order_index.asc`,
    `${serviceConfig.supabaseUrl}/rest/v1/race_start_waves?race_id=eq.${raceId}&select=${waveSelect}&order=order_index.asc`,
    `${serviceConfig.supabaseUrl}/rest/v1/race_awards?race_id=eq.${raceId}&select=${awardSelect}&order=podium_time.asc,order_index.asc`,
  ];
  const headers = serviceHeaders(serviceConfig, "");
  const [stationsResponse, relayResponse, wavesResponse, awardsResponse, servicesResponse] = await Promise.all([
    ...urls.map((url) => fetch(url, { headers, cache: "no-store" })),
    race.edition_id
      ? fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_edition_services?edition_id=eq.${race.edition_id}&select=${serviceSelect}&order=service_type.asc,order_index.asc`, { headers, cache: "no-store" })
      : Promise.resolve(null),
  ]);

  try {
    const [stationRows, relayPointRows, startWaveRows, awardRows, editionServiceRows] = await Promise.all([
      readRows(stationsResponse, true),
      readRows(relayResponse, true),
      readRows(wavesResponse, false),
      readRows(awardsResponse, false),
      readRows(servicesResponse, false),
    ]);
    const response = withSecurityHeaders(NextResponse.json({
      raceRow: race,
      stationRows,
      relayPointRows,
      startWaveRows,
      awardRows,
      editionServiceRows,
      organizerPreview: !isPublic,
    }));

    return isPublic
      ? setPublicRacebookCacheHeaders(response, { raceId, editionId: race.edition_id, eventId: race.event_id })
      : setPrivateRacebookCacheHeaders(response);
  } catch {
    return jsonError("Unable to load RaceBook content.", 502);
  }
}

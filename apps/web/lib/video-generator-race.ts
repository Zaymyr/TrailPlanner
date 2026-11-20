import { z } from "zod";

import { parseGpx } from "./gpx/parseGpx";
import {
  parseOrganizerAidStationDetails,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "./organizer-dashboard-details";
import type { SupabaseServiceConfig } from "./supabase";
import type { VideoGeneratorDetail } from "./video-generator";

/**
 * Race, aid stations and parsed GPX of the admin video generator (service role, private race-gpx
 * bucket). Shared by `/api/admin/video-generator/races/[id]` and the automatic reel pipeline.
 */
export type VideoGeneratorDetailResult = { ok: true; detail: VideoGeneratorDetail } | { ok: false; status: number; message: string };

const eventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  short_name: z.string().nullable().optional(),
  organizer_details: z.unknown().optional(),
});

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  location_text: z.string().nullable().optional(),
  organizer_details: z.unknown().optional(),
  race_events: eventSchema.nullable().optional(),
});

const aidStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean().nullable().optional(),
  solid_available: z.boolean().nullable().optional(),
  assistance_allowed: z.boolean().nullable().optional(),
  organizer_details: z.unknown().optional(),
});

const parseEditionYear = (raceDate: string | null | undefined) => {
  const year = raceDate ? Number.parseInt(raceDate.slice(0, 4), 10) : Number.NaN;
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
};

const firstText = (...values: Array<string | null | undefined>) =>
  values.map((value) => value?.trim()).find((value): value is string => Boolean(value)) ?? null;

const resolveStartInfo = (race: z.infer<typeof raceSchema>) => {
  const raceDetails = parseOrganizerRaceDetails(race.organizer_details);
  const eventDetails = parseOrganizerEventDetails(race.race_events?.organizer_details);
  return {
    startTime: raceDetails.schedule.startTime,
    startLocation: firstText(
      raceDetails.access.startLocation.label,
      raceDetails.access.startAddress,
      eventDetails.access.startLocation.label,
      eventDetails.access.startAddress,
      raceDetails.raceLocation.label,
      race.location_text,
    ),
  };
};

export const loadVideoGeneratorDetail = async (
  supabase: SupabaseServiceConfig,
  raceId: string,
  fetcher: typeof fetch = fetch,
): Promise<VideoGeneratorDetailResult> => {
  const serviceHeaders = {
    apikey: supabase.supabaseServiceRoleKey,
    Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  };

  try {
    const [raceResponse, aidStationsResponse] = await Promise.all([
      fetcher(
        `${supabase.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,name,distance_km,elevation_gain_m,elevation_loss_m,gpx_storage_path,race_date,location_text,organizer_details,race_events(id,name,short_name,organizer_details)&limit=1`,
        { headers: serviceHeaders, cache: "no-store" },
      ),
      fetcher(
        `${supabase.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=id,name,km,water_available,solid_available,assistance_allowed,organizer_details&order=order_index.asc,km.asc`,
        { headers: serviceHeaders, cache: "no-store" },
      ),
    ]);

    if (!raceResponse.ok) {
      console.error("Unable to load video-generator race", await raceResponse.text());
      return { ok: false, status: 502, message: "Unable to load race." };
    }
    if (!aidStationsResponse.ok) {
      console.error("Unable to load video-generator aid stations", await aidStationsResponse.text());
      return { ok: false, status: 502, message: "Unable to load aid stations." };
    }

    const race = z.array(raceSchema).parse(await raceResponse.json())[0] ?? null;
    if (!race) return { ok: false, status: 404, message: "Race not found." };

    const aidStationRows = z.array(aidStationSchema).parse(await aidStationsResponse.json());
    const responseBase = {
      race: {
        id: race.id,
        eventId: race.event_id ?? null,
        eventName: race.race_events?.name ?? null,
        eventShortName: race.race_events?.short_name ?? null,
        name: race.name,
        distanceKm: race.distance_km,
        elevationGainM: race.elevation_gain_m,
        elevationLossM: race.elevation_loss_m ?? null,
        editionYear: parseEditionYear(race.race_date),
        raceDate: race.race_date ?? null,
        ...resolveStartInfo(race),
      },
      aidStations: aidStationRows.map((station) => {
        const details = parseOrganizerAidStationDetails(station.organizer_details);
        return {
          id: station.id,
          name: station.name,
          distanceKm: station.km,
          waterAvailable: station.water_available ?? true,
          foodAvailable: station.solid_available ?? true,
          assistanceAllowed: station.assistance_allowed ?? true,
          isLifeBase: details.stationType === "life_base",
          dropBagAvailable: details.dropBagAvailable,
          cutoffTime: details.cutoffTime,
        };
      }),
    };

    if (!race.gpx_storage_path) {
      return { ok: true, detail: { ...responseBase, gpx: { status: "missing" as const } } };
    }

    const gpxResponse = await fetcher(
      `${supabase.supabaseUrl}/storage/v1/object/race-gpx/${race.gpx_storage_path}`,
      { headers: serviceHeaders, cache: "no-store" },
    );

    if (!gpxResponse.ok) {
      console.error("Unable to read video-generator GPX", await gpxResponse.text());
      return { ok: false, status: 502, message: "Unable to read race GPX." };
    }

    try {
      const parsedGpx = parseGpx(await gpxResponse.text());
      const firstPoint = parsedGpx.points[0];
      const bounds = {
        minLat: parsedGpx.stats.boundsMinLat ?? firstPoint.lat,
        minLon: parsedGpx.stats.boundsMinLng ?? firstPoint.lng,
        maxLat: parsedGpx.stats.boundsMaxLat ?? firstPoint.lat,
        maxLon: parsedGpx.stats.boundsMaxLng ?? firstPoint.lng,
      };

      return { ok: true, detail: {
        ...responseBase,
        gpx: {
          status: "ready" as const,
          pointCount: parsedGpx.points.length,
          bounds,
          points: parsedGpx.points.map((point) => ({
            lat: point.lat,
            lon: point.lng,
            elevationM: point.ele,
            distanceKm: point.distKmCum,
          })),
        },
      } };
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown parse error";
      console.error("Invalid video-generator GPX", details);
      return { ok: false, status: 422, message: `Invalid GPX file: ${details}` };
    }
  } catch (error) {
    console.error("Unexpected video-generator data error", error);
    return { ok: false, status: 500, message: "Unable to load race data." };
  }
};

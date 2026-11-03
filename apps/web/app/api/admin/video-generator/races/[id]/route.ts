import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../../../../lib/gpx/parseGpx";
import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../../lib/supabase";

const paramsSchema = z.object({ id: z.string().uuid() });

const eventSchema = z.object({ id: z.string().uuid(), name: z.string() });

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  race_events: eventSchema.nullable().optional(),
});

const aidStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
});

const parseEditionYear = (raceDate: string | null | undefined) => {
  const year = raceDate ? Number.parseInt(raceDate.slice(0, 4), 10) : Number.NaN;
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
};

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return jsonError("Supabase configuration is missing.", 500);
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return jsonError("Missing access token.", 401);

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) return jsonError("Invalid session.", 401);
  if (!isAdminUser(user)) return jsonError("Not authorized.", 403);

  const serviceHeaders = {
    apikey: supabaseService.supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
  };
  const raceId = parsedParams.data.id;

  try {
    const [raceResponse, aidStationsResponse] = await Promise.all([
      fetch(
        `${supabaseService.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,name,distance_km,elevation_gain_m,elevation_loss_m,gpx_storage_path,race_date,race_events(id,name)&limit=1`,
        { headers: serviceHeaders, cache: "no-store" },
      ),
      fetch(
        `${supabaseService.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=id,name,km&order=order_index.asc,km.asc`,
        { headers: serviceHeaders, cache: "no-store" },
      ),
    ]);

    if (!raceResponse.ok) {
      console.error("Unable to load video-generator race", await raceResponse.text());
      return jsonError("Unable to load race.", 502);
    }
    if (!aidStationsResponse.ok) {
      console.error("Unable to load video-generator aid stations", await aidStationsResponse.text());
      return jsonError("Unable to load aid stations.", 502);
    }

    const race = z.array(raceSchema).parse(await raceResponse.json())[0] ?? null;
    if (!race) return jsonError("Race not found.", 404);

    const aidStationRows = z.array(aidStationSchema).parse(await aidStationsResponse.json());
    const responseBase = {
      race: {
        id: race.id,
        eventId: race.event_id ?? null,
        eventName: race.race_events?.name ?? null,
        name: race.name,
        distanceKm: race.distance_km,
        elevationGainM: race.elevation_gain_m,
        elevationLossM: race.elevation_loss_m ?? null,
        editionYear: parseEditionYear(race.race_date),
      },
      aidStations: aidStationRows.map((station) => ({
        id: station.id,
        name: station.name,
        distanceKm: station.km,
      })),
    };

    if (!race.gpx_storage_path) {
      return withSecurityHeaders(NextResponse.json({ ...responseBase, gpx: { status: "missing" } }));
    }

    const gpxResponse = await fetch(
      `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${race.gpx_storage_path}`,
      { headers: serviceHeaders, cache: "no-store" },
    );

    if (!gpxResponse.ok) {
      console.error("Unable to read video-generator GPX", await gpxResponse.text());
      return jsonError("Unable to read race GPX.", 502);
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

      return withSecurityHeaders(NextResponse.json({
        ...responseBase,
        gpx: {
          status: "ready",
          pointCount: parsedGpx.points.length,
          bounds,
          points: parsedGpx.points.map((point) => ({
            lat: point.lat,
            lon: point.lng,
            elevationM: point.ele,
            distanceKm: point.distKmCum,
          })),
        },
      }));
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown parse error";
      console.error("Invalid video-generator GPX", details);
      return jsonError(`Invalid GPX file: ${details}`, 422);
    }
  } catch (error) {
    console.error("Unexpected video-generator data error", error);
    return jsonError("Unable to load race data.", 500);
  }
}

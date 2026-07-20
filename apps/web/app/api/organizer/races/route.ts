import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildSlug,
  jsonError,
  optionalTextOrNull,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
} from "../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../lib/http";
import {
  organizerRaceDetailsSchema,
  parseOrganizerRaceDetails,
} from "../../../../lib/organizer-dashboard-details";

const createRaceSchema = z.object({
  eventId: z.string().uuid(),
  cloneFromRaceId: z.string().uuid().optional(),
  seriesName: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  distanceKm: z.coerce.number().positive().optional(),
  elevationGainM: z.coerce.number().nonnegative().optional(),
  elevationLossM: z.coerce.number().nonnegative().nullable().optional(),
  locationText: optionalTextOrNull,
  raceDate: z.string().trim().min(1),
  thumbnailUrl: optionalTextOrNull,
  isLive: z.boolean().optional().default(false),
  organizerDetails: organizerRaceDetailsSchema.optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  edition_group_id: z.string().uuid(),
  series_name: z.string(),
  name: z.string(),
  slug: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  organizer_details: z.unknown().nullable().optional(),
});

const cloneSourceRaceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  edition_group_id: z.string().uuid().nullable().optional(),
  series_name: z.string().nullable().optional(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_path: z.string().nullable().optional(),
  gpx_hash: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  gpx_sha256: z.string().nullable().optional(),
  min_alt_m: z.number().nullable().optional(),
  max_alt_m: z.number().nullable().optional(),
  start_lat: z.number().nullable().optional(),
  start_lng: z.number().nullable().optional(),
  bounds_min_lat: z.number().nullable().optional(),
  bounds_min_lng: z.number().nullable().optional(),
  bounds_max_lat: z.number().nullable().optional(),
  bounds_max_lng: z.number().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
});

const cloneAidStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  solid_available: z.boolean().nullable().optional(),
  assistance_allowed: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
  organizer_details: z.unknown().nullable().optional(),
});

const cloneAidStationProductSchema = z.object({
  product_id: z.string().uuid(),
  race_aid_station_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

const deleteClonedRace = async (serviceConfig: Parameters<typeof serviceHeaders>[0], raceId: string) => {
  await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
};

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsed = createRaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid race fields.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsed.data.eventId);
  if (organizer !== true) return organizer.error;

  if (!parsed.data.cloneFromRaceId && (!parsed.data.distanceKm || parsed.data.elevationGainM === undefined)) {
    return jsonError("Invalid race fields.", 400);
  }

  const raceId = randomUUID();
  let clonedStoragePath: string | null = null;

  let editionGroupId: string = raceId;
  let seriesName = parsed.data.seriesName?.trim() || parsed.data.name;
  let sourceRace: z.infer<typeof cloneSourceRaceSchema> | null = null;

  if (parsed.data.cloneFromRaceId) {
    const sourceAccess = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsed.data.cloneFromRaceId}&select=id,event_id&limit=1`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!sourceAccess.ok) {
      console.error("Unable to inspect organizer clone source", await sourceAccess.text());
      return jsonError("Unable to load source format.", 502);
    }

    const sourceAccessRow = z
      .array(z.object({ id: z.string().uuid(), event_id: z.string().uuid().nullable().optional() }))
      .parse(await sourceAccess.json())[0] ?? null;

    if (!sourceAccessRow?.event_id || sourceAccessRow.event_id !== parsed.data.eventId) {
      return jsonError("Source format does not belong to this event.", 409);
    }

    const sourceResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsed.data.cloneFromRaceId}&select=id,event_id,edition_group_id,series_name,name,slug,distance_km,elevation_gain_m,elevation_loss_m,location_text,race_date,thumbnail_url,gpx_path,gpx_hash,gpx_storage_path,gpx_sha256,min_alt_m,max_alt_m,start_lat,start_lng,bounds_min_lat,bounds_min_lng,bounds_max_lat,bounds_max_lng,organizer_details&limit=1`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!sourceResponse.ok) {
      console.error("Unable to load organizer clone source", await sourceResponse.text());
      return jsonError("Unable to load source format.", 502);
    }

    sourceRace = z.array(cloneSourceRaceSchema).parse(await sourceResponse.json())[0] ?? null;
    if (!sourceRace) return jsonError("Source format not found.", 404);

    editionGroupId = sourceRace.edition_group_id ?? sourceRace.id;
    seriesName = parsed.data.seriesName?.trim() || sourceRace.series_name?.trim() || parsed.data.name;
  }

  const insertPayload: Record<string, unknown> = {
    id: raceId,
    event_id: parsed.data.eventId,
    edition_group_id: editionGroupId,
    series_name: seriesName,
    slug: buildSlug(parsed.data.name),
    name: parsed.data.name,
    distance_km: Number((parsed.data.distanceKm ?? 0).toFixed(2)),
    elevation_gain_m: Math.round(parsed.data.elevationGainM ?? 0),
    elevation_loss_m: Math.round(parsed.data.elevationLossM ?? 0),
    location_text: parsed.data.locationText,
    race_date: parsed.data.raceDate,
    thumbnail_url: parsed.data.thumbnailUrl,
    organizer_details: parsed.data.organizerDetails ?? null,
    gpx_path: `organizer/${parsed.data.eventId}/${raceId}.gpx`,
    gpx_hash: `manual:${raceId}`,
    gpx_storage_path: null,
    gpx_sha256: null,
    is_live: parsed.data.isLive,
    is_public: true,
    created_by: null,
  };

  if (sourceRace) {
    insertPayload.distance_km = sourceRace.distance_km;
    insertPayload.elevation_gain_m = sourceRace.elevation_gain_m;
    insertPayload.elevation_loss_m = sourceRace.elevation_loss_m ?? 0;
    insertPayload.location_text = sourceRace.location_text;
    insertPayload.thumbnail_url = sourceRace.thumbnail_url;
    insertPayload.organizer_details = sourceRace.organizer_details ?? null;
    insertPayload.is_live = false;
    insertPayload.min_alt_m = sourceRace.min_alt_m ?? null;
    insertPayload.max_alt_m = sourceRace.max_alt_m ?? null;
    insertPayload.start_lat = sourceRace.start_lat ?? null;
    insertPayload.start_lng = sourceRace.start_lng ?? null;
    insertPayload.bounds_min_lat = sourceRace.bounds_min_lat ?? null;
    insertPayload.bounds_min_lng = sourceRace.bounds_min_lng ?? null;
    insertPayload.bounds_max_lat = sourceRace.bounds_max_lat ?? null;
    insertPayload.bounds_max_lng = sourceRace.bounds_max_lng ?? null;
  }

  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/races`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify(insertPayload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to create organizer race", await response.text());
    return jsonError("Unable to create race format.", 502);
  }

  if (sourceRace) {
    try {
      if (sourceRace.gpx_storage_path) {
        const sourceGpxResponse = await fetch(
          `${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${sourceRace.gpx_storage_path}`,
          {
            headers: serviceHeaders(auth.serviceConfig, ""),
            cache: "no-store",
          }
        );

        if (!sourceGpxResponse.ok) {
          throw new Error(`Unable to read source GPX: ${await sourceGpxResponse.text()}`);
        }

        const sourceGpxBuffer = await sourceGpxResponse.arrayBuffer();
        const nextStoragePath = `organizer/${parsed.data.eventId}/${raceId}/${Date.now()}.gpx`;
        const uploadResponse = await fetch(
          `${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${nextStoragePath}`,
          {
            method: "POST",
            headers: {
              ...serviceHeaders(auth.serviceConfig, sourceGpxResponse.headers.get("content-type") || "application/gpx+xml"),
              "x-upsert": "true",
            },
            body: sourceGpxBuffer,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(`Unable to clone source GPX: ${await uploadResponse.text()}`);
        }

        clonedStoragePath = nextStoragePath;
        const gpxPatchResponse = await fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}`,
          {
            method: "PATCH",
            headers: serviceHeaders(auth.serviceConfig),
            body: JSON.stringify({
              gpx_path: nextStoragePath,
              gpx_hash: sourceRace.gpx_sha256 ?? sourceRace.gpx_hash ?? `clone:${raceId}`,
              gpx_storage_path: nextStoragePath,
              gpx_sha256: sourceRace.gpx_sha256 ?? null,
            }),
            cache: "no-store",
          }
        );

        if (!gpxPatchResponse.ok) {
          throw new Error(`Unable to persist cloned GPX: ${await gpxPatchResponse.text()}`);
        }
      }

      const sourceStationsResponse = await fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${sourceRace.id}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index,organizer_details&order=order_index.asc`,
        {
          headers: serviceHeaders(auth.serviceConfig, ""),
          cache: "no-store",
        }
      );

      if (!sourceStationsResponse.ok) {
        throw new Error(`Unable to load source aid stations: ${await sourceStationsResponse.text()}`);
      }

      const sourceStations = z.array(cloneAidStationSchema).parse(await sourceStationsResponse.json());
      const stationIdMap = new Map<string, string>();

      if (sourceStations.length > 0) {
        const stationInsertPayload = sourceStations.map((station) => {
          const nextStationId = randomUUID();
          stationIdMap.set(station.id, nextStationId);
          return {
            id: nextStationId,
            race_id: raceId,
            name: station.name,
            km: station.km,
            water_available: station.water_available,
            solid_available: station.solid_available ?? true,
            assistance_allowed: station.assistance_allowed ?? true,
            notes: station.notes ?? null,
            order_index: station.order_index,
            organizer_details: station.organizer_details ?? null,
          };
        });

        const stationInsertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
          method: "POST",
          headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify(stationInsertPayload),
          cache: "no-store",
        });

        if (!stationInsertResponse.ok) {
          throw new Error(`Unable to clone aid stations: ${await stationInsertResponse.text()}`);
        }

        const sourceProductsResponse = await fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products?select=product_id,race_aid_station_id,notes,order_index,race_aid_stations!inner(race_id)&race_aid_stations.race_id=eq.${sourceRace.id}&order=order_index.asc`,
          {
            headers: serviceHeaders(auth.serviceConfig, ""),
            cache: "no-store",
          }
        );

        if (!sourceProductsResponse.ok) {
          throw new Error(`Unable to load source station products: ${await sourceProductsResponse.text()}`);
        }

        const sourceProducts = z.array(cloneAidStationProductSchema.passthrough()).parse(await sourceProductsResponse.json());
        const productInsertPayload = sourceProducts
          .map((product) => {
            const nextStationId = stationIdMap.get(product.race_aid_station_id);
            if (!nextStationId) return null;
            return {
              race_aid_station_id: nextStationId,
              product_id: product.product_id,
              notes: product.notes ?? null,
              order_index: product.order_index,
            };
          })
          .filter((product): product is NonNullable<typeof product> => product !== null);

        if (productInsertPayload.length > 0) {
          const productInsertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products`, {
            method: "POST",
            headers: serviceHeaders(auth.serviceConfig),
            body: JSON.stringify(productInsertPayload),
            cache: "no-store",
          });

          if (!productInsertResponse.ok) {
            throw new Error(`Unable to clone station products: ${await productInsertResponse.text()}`);
          }
        }
      }
    } catch (error) {
      console.error("Unable to clone organizer race edition", error);
      if (clonedStoragePath) {
        await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${clonedStoragePath}`, {
          method: "DELETE",
          headers: serviceHeaders(auth.serviceConfig, ""),
          cache: "no-store",
        }).catch(() => null);
      }
      await deleteClonedRace(auth.serviceConfig, raceId);
      return jsonError("Unable to clone race edition.", 502);
    }
  }

  const createdRace = z.array(raceRowSchema).parse(await response.json())[0];
  const reloadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,edition_group_id,series_name,name,slug,event_id,distance_km,elevation_gain_m,elevation_loss_m,location_text,race_date,thumbnail_url,gpx_storage_path,is_live,organizer_details&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!reloadResponse.ok) {
    console.error("Unable to reload organizer race after create", await reloadResponse.text());
    return jsonError("Race format created, but unable to reload it.", 502);
  }

  const race = z.array(raceRowSchema).parse(await reloadResponse.json())[0] ?? createdRace;
  return withSecurityHeaders(
    NextResponse.json(
      {
        race: {
          ...race,
          organizerDetails: parseOrganizerRaceDetails(race.organizer_details),
        },
      },
      { status: 201 }
    )
  );
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  jsonError,
  optionalTextOrNull,
  optionalUrlOrNull,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../../lib/http";
import { isAdminUser } from "../../../../../lib/supabase";
import {
  organizerEventDetailsSchema,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "../../../../../lib/organizer-dashboard-details";

const updateEventSchema = z.object({
  selectedEditionYear: z.string().regex(/^\d{4}$/).optional(),
  editionStartDate: z.string().date().optional(),
  editionEndDate: z.string().date().optional(),
  name: z.string().trim().min(1).optional(),
  location: optionalTextOrNull,
  raceDate: optionalTextOrNull,
  thumbnailUrl: optionalUrlOrNull,
  organizerDetails: organizerEventDetailsSchema.optional(),
});

const eventEditionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean(),
});

const eventDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  race_event_editions: z.array(eventEditionSchema).nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        edition_id: z.string().uuid().nullable().optional(),
        edition_group_id: z.string().uuid(),
        series_name: z.string(),
        name: z.string(),
        slug: z.string().nullable().optional(),
        external_site_url: z.string().nullable().optional(),
        location_text: z.string().nullable().optional(),
        race_date: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
        elevation_loss_m: z.number().nullable().optional(),
        gpx_storage_path: z.string().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        is_live: z.boolean(),
        organizer_details: z.unknown().nullable().optional(),
        race_aid_stations: z
          .array(
            z.object({
              id: z.string().uuid(),
            })
          )
          .nullable()
          .optional(),
      })
    )
    .nullable()
    .optional(),
});

const eventDeleteReadSchema = z.object({
  id: z.string().uuid(),
  thumbnail_url: z.string().nullable().optional(),
  races: z.array(z.object({
    id: z.string().uuid(),
    gpx_storage_path: z.string().nullable().optional(),
    thumbnail_url: z.string().nullable().optional(),
  })).nullable().optional(),
});

const ownerMembershipSchema = z.object({ id: z.string().uuid(), role: z.string() });

const getPublicRaceImageStoragePath = (supabaseUrl: string, publicUrl: string | null | undefined) => {
  if (!publicUrl) return null;
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/race-images/`;
  return publicUrl.startsWith(publicPrefix) ? publicUrl.slice(publicPrefix.length) : null;
};

const deleteStorageObject = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  bucket: string,
  storagePath: string
) => {
  await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
};

const mapEventDetail = (event: z.infer<typeof eventDetailSchema>) => ({
  ...event,
  editions: (event.race_event_editions ?? []).sort((left, right) => right.edition_year - left.edition_year),
  organizerDetails: parseOrganizerEventDetails(event.organizer_details),
  races: (event.races ?? []).map((race) => {
    const { race_aid_stations: raceAidStations, ...raceFields } = race;
    return {
      ...raceFields,
      organizerDetails: parseOrganizerRaceDetails(race.organizer_details),
      aidStationCount: raceAidStations?.length ?? 0,
    };
  }),
});

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}&select=id,name,location,race_date,thumbnail_url,is_live,organizer_details,race_event_editions(id,event_id,edition_year,start_date,end_date,is_current),races(id,edition_id,edition_group_id,series_name,name,slug,external_site_url,location_text,race_date,distance_km,elevation_gain_m,elevation_loss_m,gpx_storage_path,thumbnail_url,is_live,organizer_details,race_aid_stations(id))&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load organizer event", await response.text());
    return jsonError("Unable to load event.", 502);
  }

  const event = z.array(eventDetailSchema).parse(await response.json())[0] ?? null;
  if (!event) return jsonError("Event not found.", 404);

  return withSecurityHeaders(NextResponse.json({ event: mapEventDetail(event) }));
}

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const parsedBody = updateEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid event fields.", 400);

  const updatesEdition = parsedBody.data.editionStartDate !== undefined || parsedBody.data.editionEndDate !== undefined;
  if (updatesEdition && (!parsedBody.data.selectedEditionYear || !parsedBody.data.editionStartDate || !parsedBody.data.editionEndDate)) {
    return jsonError("Edition year, start date and end date are required together.", 400);
  }
  if (
    updatesEdition &&
    (parsedBody.data.editionEndDate! < parsedBody.data.editionStartDate! ||
      parsedBody.data.editionStartDate!.slice(0, 4) !== parsedBody.data.selectedEditionYear)
  ) {
    return jsonError("Invalid edition date range.", 400);
  }

  let editionId: string | null = null;
  if (updatesEdition) {
    const editionReadResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsedParams.data.id}&edition_year=eq.${parsedBody.data.selectedEditionYear}&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!editionReadResponse.ok) return jsonError("Unable to inspect event edition.", 502);
    editionId = z.array(z.object({ id: z.string().uuid() })).parse(await editionReadResponse.json())[0]?.id ?? null;
    if (!editionId) return jsonError("Event edition not found.", 404);

    const editionRacesResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${editionId}&select=race_date`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!editionRacesResponse.ok) return jsonError("Unable to inspect edition formats.", 502);
    const editionRaces = z.array(z.object({ race_date: z.string().nullable().optional() })).parse(await editionRacesResponse.json());
    if (editionRaces.some((race) => race.race_date && (race.race_date < parsedBody.data.editionStartDate! || race.race_date > parsedBody.data.editionEndDate!))) {
      return jsonError("La plage de l'édition doit contenir les dates de tous ses formats.", 409);
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsedBody.data.name !== undefined) updatePayload.name = parsedBody.data.name;
  if (parsedBody.data.location !== undefined) updatePayload.location = parsedBody.data.location;
  if (parsedBody.data.raceDate !== undefined) updatePayload.race_date = parsedBody.data.raceDate;
  if (parsedBody.data.thumbnailUrl !== undefined) updatePayload.thumbnail_url = parsedBody.data.thumbnailUrl;
  if (parsedBody.data.organizerDetails !== undefined) updatePayload.organizer_details = parsedBody.data.organizerDetails;

  if (Object.keys(updatePayload).length === 0 && !updatesEdition) return jsonError("No fields to update.", 400);

  const response = Object.keys(updatePayload).length > 0
    ? await fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}`,
        {
          method: "PATCH",
          headers: {
            ...serviceHeaders(auth.serviceConfig),
            Prefer: "return=representation",
          },
          body: JSON.stringify(updatePayload),
          cache: "no-store",
        }
      )
    : new Response("[]", { status: 200, headers: { "content-type": "application/json" } });

  if (!response.ok) {
    console.error("Unable to update organizer event", await response.text());
    return jsonError("Unable to update event.", 502);
  }

  let edition: z.infer<typeof eventEditionSchema> | null = null;
  if (updatesEdition) {
    const editionResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          start_date: parsedBody.data.editionStartDate,
          end_date: parsedBody.data.editionEndDate,
        }),
        cache: "no-store",
      }
    );
    if (!editionResponse.ok) {
      console.error("Unable to update organizer event edition", await editionResponse.text());
      return jsonError("Unable to update event edition.", 502);
    }
    edition = z.array(eventEditionSchema).parse(await editionResponse.json())[0] ?? null;
    if (!edition) return jsonError("Event edition not found.", 404);
  }

  const event = z.array(eventDetailSchema.omit({ races: true })).parse(await response.json())[0] ?? null;
  return withSecurityHeaders(
    NextResponse.json({
      edition,
      event: event
        ? {
            ...event,
            organizerDetails: parseOrganizerEventDetails(event.organizer_details),
          }
        : null,
    })
  );
}

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  if (!isAdminUser(auth.user)) {
    const membershipResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?event_id=eq.${parsedParams.data.id}&user_id=eq.${auth.user.id}&revoked_at=is.null&select=id,role&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!membershipResponse.ok) return jsonError("Unable to verify event ownership.", 502);
    const membership = z.array(ownerMembershipSchema).parse(await membershipResponse.json())[0] ?? null;
    if (membership?.role !== "owner") return jsonError("Only the event owner can delete this course.", 403);
  }

  const eventReadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}&select=id,thumbnail_url,races(id,gpx_storage_path,thumbnail_url)&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!eventReadResponse.ok) return jsonError("Unable to load event before delete.", 502);
  const eventRow = z.array(eventDeleteReadSchema).parse(await eventReadResponse.json())[0] ?? null;
  if (!eventRow) return jsonError("Event not found.", 404);

  if ((eventRow.races?.length ?? 0) > 0) {
    const racesDeleteResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?event_id=eq.${parsedParams.data.id}`,
      { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!racesDeleteResponse.ok) return jsonError("Unable to delete event formats.", 502);
  }

  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}`,
    { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete organizer event", await deleteResponse.text());
    return jsonError("Unable to delete event.", 502);
  }

  const storageDeletes: Array<Promise<void>> = [];
  for (const race of eventRow.races ?? []) {
    if (race.gpx_storage_path) storageDeletes.push(deleteStorageObject(auth.serviceConfig, "race-gpx", race.gpx_storage_path));
    const raceImagePath = getPublicRaceImageStoragePath(auth.serviceConfig.supabaseUrl, race.thumbnail_url);
    if (raceImagePath) storageDeletes.push(deleteStorageObject(auth.serviceConfig, "race-images", raceImagePath));
  }
  const eventImagePath = getPublicRaceImageStoragePath(auth.serviceConfig.supabaseUrl, eventRow.thumbnail_url);
  if (eventImagePath) storageDeletes.push(deleteStorageObject(auth.serviceConfig, "race-images", eventImagePath));
  await Promise.all(storageDeletes);

  return withSecurityHeaders(NextResponse.json({ deleted: true, eventId: parsedParams.data.id }));
}

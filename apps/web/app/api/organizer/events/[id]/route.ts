import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  jsonError,
  optionalTextOrNull,
  optionalUrlOrNull,
  type OrganizerAuth,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../../lib/http";
import {
  organizerEventDetailsSchema,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "../../../../../lib/organizer-dashboard-details";

const updateEventSchema = z.object({
  name: z.string().trim().min(1).optional(),
  location: optionalTextOrNull,
  raceDate: optionalTextOrNull,
  thumbnailUrl: optionalUrlOrNull,
  isLive: z.boolean().optional(),
  organizerDetails: organizerEventDetailsSchema.optional(),
});

const eventDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        slug: z.string().nullable().optional(),
        location_text: z.string().nullable().optional(),
        race_date: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
        elevation_loss_m: z.number().nullable().optional(),
        gpx_storage_path: z.string().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        is_live: z.boolean(),
        organizer_details: z.unknown().nullable().optional(),
      })
    )
    .nullable()
    .optional(),
});

const eventPublishReadinessSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
        is_live: z.boolean(),
      })
    )
    .nullable()
    .optional(),
});

const mapEventDetail = (event: z.infer<typeof eventDetailSchema>) => ({
  ...event,
  organizerDetails: parseOrganizerEventDetails(event.organizer_details),
  races: (event.races ?? []).map((race) => ({
    ...race,
    organizerDetails: parseOrganizerRaceDetails(race.organizer_details),
  })),
});

type PublicationReadinessResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      status: number;
    };

async function validateOrganizerEventPublication(
  serviceConfig: OrganizerAuth["serviceConfig"],
  eventId: string,
  nextFields: { name?: string; location?: string | null; raceDate?: string | null }
): Promise<PublicationReadinessResult> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_date,races(id,name,distance_km,elevation_gain_m,is_live)&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to verify organizer event publication readiness", await response.text());
    return { ok: false, message: "Unable to verify event publication readiness.", status: 502 };
  }

  const event = z.array(eventPublishReadinessSchema).parse(await response.json())[0] ?? null;
  if (!event) return { ok: false, message: "Event not found.", status: 404 };

  const name = nextFields.name ?? event.name ?? "";
  const location = nextFields.location !== undefined ? nextFields.location : event.location ?? null;
  const raceDate = nextFields.raceDate !== undefined ? nextFields.raceDate : event.race_date ?? null;
  const hasPublishableRace = (event.races ?? []).some(
    (race) =>
      race.is_live &&
      Boolean(race.name?.trim()) &&
      Number.isFinite(race.distance_km) &&
      race.distance_km > 0 &&
      Number.isFinite(race.elevation_gain_m) &&
      race.elevation_gain_m >= 0
  );

  if (!name.trim()) return { ok: false, message: "Add an event name before publishing.", status: 409 };
  if (!location?.trim()) return { ok: false, message: "Add an event location before publishing.", status: 409 };
  if (!raceDate?.trim()) return { ok: false, message: "Add an event date before publishing.", status: 409 };
  if (!hasPublishableRace) {
    return {
      ok: false,
      message: "Add at least one live format with distance and elevation before publishing.",
      status: 409,
    };
  }

  return { ok: true };
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}&select=id,name,location,race_date,thumbnail_url,is_live,organizer_details,races(id,name,slug,location_text,race_date,distance_km,elevation_gain_m,elevation_loss_m,gpx_storage_path,thumbnail_url,is_live,organizer_details)&limit=1`,
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

  if (parsedBody.data.isLive === true) {
    const readiness = await validateOrganizerEventPublication(auth.serviceConfig, parsedParams.data.id, {
      name: parsedBody.data.name,
      location: parsedBody.data.location,
      raceDate: parsedBody.data.raceDate,
    });
    if (!readiness.ok) return jsonError(readiness.message, readiness.status);
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsedBody.data.name !== undefined) updatePayload.name = parsedBody.data.name;
  if (parsedBody.data.location !== undefined) updatePayload.location = parsedBody.data.location;
  if (parsedBody.data.raceDate !== undefined) updatePayload.race_date = parsedBody.data.raceDate;
  if (parsedBody.data.thumbnailUrl !== undefined) updatePayload.thumbnail_url = parsedBody.data.thumbnailUrl;
  if (parsedBody.data.isLive !== undefined) updatePayload.is_live = parsedBody.data.isLive;
  if (parsedBody.data.organizerDetails !== undefined) updatePayload.organizer_details = parsedBody.data.organizerDetails;

  if (Object.keys(updatePayload).length === 0) return jsonError("No fields to update.", 400);

  const response = await fetch(
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
  );

  if (!response.ok) {
    console.error("Unable to update organizer event", await response.text());
    return jsonError("Unable to update event.", 502);
  }

  const event = z.array(eventDetailSchema.omit({ races: true })).parse(await response.json())[0] ?? null;
  return withSecurityHeaders(
    NextResponse.json({
      event: event
        ? {
            ...event,
            organizerDetails: parseOrganizerEventDetails(event.organizer_details),
          }
        : null,
    })
  );
}

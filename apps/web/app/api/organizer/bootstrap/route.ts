import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import {
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "../../../../lib/organizer-dashboard-details";
import { isAdminUser } from "../../../../lib/supabase";

const eventIdSchema = z.string().uuid();

const raceEventSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
});

const claimRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_id: z.string().uuid(),
  organization_name: z.string(),
  role_title: z.string(),
  contact_email: z.string(),
  official_site_url: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  race_events: raceEventSummarySchema.nullable().optional(),
});

const membershipRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_id: z.string().uuid(),
  role: z.string(),
  race_events: raceEventSummarySchema.nullable().optional(),
});

const editionRequestRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_id: z.string().uuid(),
  source_year: z.number().int(),
  requested_start_date: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
  race_events: raceEventSummarySchema.nullable().optional(),
});

const publicationRequestRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_id: z.string().uuid(),
  race_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
});

const eventEditionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean(),
  is_visible: z.boolean().default(true),
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
  races: z.array(z.object({
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
    participation_mode: z.enum(["solo", "relay", "solo_and_relay"]).nullable().optional(),
    data_status: z.enum(["draft", "complete"]).optional().default("complete"),
    missing_required_fields: z.array(z.enum(["race_date", "distance_km", "elevation_gain_m"])).optional().default([]),
    racebook_is_live: z.boolean().default(false),
    racebook_publication_approved_at: z.string().nullable().optional(),
    organizer_details: z.unknown().nullable().optional(),
    race_aid_stations: z.array(z.object({ id: z.string().uuid() })).nullable().optional(),
  })).nullable().optional(),
});

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

export async function GET(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const requestedEventIdValue = request.nextUrl.searchParams.get("eventId");
  const requestedEventId = requestedEventIdValue ? eventIdSchema.safeParse(requestedEventIdValue) : null;
  if (requestedEventId && !requestedEventId.success) return jsonError("Invalid event id.", 400);

  const headers = serviceHeaders(auth.serviceConfig, "");
  const isAdmin = isAdminUser(auth.user);
  const [claimsResponse, membershipsResponse, editionRequestsResponse, publicationRequestsResponse, adminEventsResponse] = await Promise.all([
    fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?user_id=eq.${auth.user.id}&select=id,created_at,event_id,organization_name,role_title,contact_email,official_site_url,message,status,reviewer_notes,reviewed_at,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=created_at.desc`, { headers, cache: "no-store" }),
    fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?user_id=eq.${auth.user.id}&revoked_at=is.null&select=id,created_at,event_id,role,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=created_at.desc`, { headers, cache: "no-store" }),
    fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests?user_id=eq.${auth.user.id}&select=id,created_at,event_id,source_year,requested_start_date,status,reviewer_notes,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=created_at.desc`, { headers, cache: "no-store" }),
    fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_publication_requests?user_id=eq.${auth.user.id}&select=id,created_at,event_id,race_id,status,reviewer_notes&order=created_at.desc`, { headers, cache: "no-store" }),
    isAdmin
      ? fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,location,race_date,thumbnail_url,is_live&order=name.asc`, { headers, cache: "no-store" })
      : Promise.resolve(null),
  ]);

  if (
    !claimsResponse.ok ||
    !membershipsResponse.ok ||
    !editionRequestsResponse.ok ||
    !publicationRequestsResponse.ok ||
    (adminEventsResponse && !adminEventsResponse.ok)
  ) {
    console.error("Unable to load organizer bootstrap", {
      claims: claimsResponse.ok ? null : await claimsResponse.text(),
      memberships: membershipsResponse.ok ? null : await membershipsResponse.text(),
      editionRequests: editionRequestsResponse.ok ? null : await editionRequestsResponse.text(),
      publicationRequests: publicationRequestsResponse.ok ? null : await publicationRequestsResponse.text(),
      adminEvents: !adminEventsResponse || adminEventsResponse.ok ? null : await adminEventsResponse.text(),
    });
    return jsonError("Unable to load organizer data.", 502);
  }

  const claims = z.array(claimRowSchema).parse(await claimsResponse.json());
  const memberships = z.array(membershipRowSchema).parse(await membershipsResponse.json());
  const editionRequests = z.array(editionRequestRowSchema).parse(await editionRequestsResponse.json());
  const publicationRequests = z.array(publicationRequestRowSchema).parse(await publicationRequestsResponse.json());
  const selectableMemberships = adminEventsResponse
    ? z.array(raceEventSummarySchema).parse(await adminEventsResponse.json()).map((event) => ({
        id: event.id,
        event_id: event.id,
        role: "admin",
        race_events: event,
      }))
    : memberships;

  const selectedEventId = requestedEventId?.success
    ? requestedEventId.data
    : selectableMemberships[0]?.event_id ?? null;

  if (selectedEventId && !selectableMemberships.some((membership) => membership.event_id === selectedEventId)) {
    return jsonError("Not authorized for this event.", 403);
  }

  let event = null;
  if (selectedEventId) {
    const eventResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${selectedEventId}&select=id,name,location,race_date,thumbnail_url,is_live,organizer_details,race_event_editions(id,event_id,edition_year,start_date,end_date,is_current,is_visible),races(id,edition_id,edition_group_id,series_name,name,slug,external_site_url,location_text,race_date,distance_km,elevation_gain_m,elevation_loss_m,gpx_storage_path,thumbnail_url,is_live,participation_mode,data_status,missing_required_fields,racebook_is_live,racebook_publication_approved_at,organizer_details,race_aid_stations(id))&limit=1`,
      { headers, cache: "no-store" }
    );

    if (!eventResponse.ok) {
      console.error("Unable to load organizer bootstrap event", await eventResponse.text());
      return jsonError("Unable to load event.", 502);
    }

    const eventRow = z.array(eventDetailSchema).parse(await eventResponse.json())[0] ?? null;
    if (!eventRow) return jsonError("Event not found.", 404);
    event = mapEventDetail(eventRow);
  }

  return withSecurityHeaders(
    NextResponse.json({ claims, memberships: selectableMemberships, editionRequests, publicationRequests, event })
  );
}

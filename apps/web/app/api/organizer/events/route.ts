import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";
import {
  jsonError,
  optionalTextOrNull,
  optionalUrlOrNull,
  requireOrganizerAuth,
  serviceHeaders,
} from "../../../../lib/organizer";
import { parseOrganizerEventDetails } from "../../../../lib/organizer-dashboard-details";

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

const isoDateSchema = optionalTextOrNull.refine(
  (value) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return !value;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  },
  "Invalid race date."
);

const createEventSchema = z.object({
  name: z.string().trim().min(2).max(180),
  location: optionalTextOrNull,
  editionStartDate: isoDateSchema,
  editionEndDate: isoDateSchema,
  officialSiteUrl: optionalUrlOrNull,
});

const createdEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  is_live: z.boolean(),
});

const createdMembershipSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  role: z.string(),
});

const createdEditionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean(),
});

async function deleteCreatedEvent(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  eventId: string
) {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
  if (response && !response.ok) {
    console.warn("Unable to clean up organizer-created event", await response.text());
  }
}

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

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimitAsync(`organizer-event-create:${auth.user.id}`, 6, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const parsed = createEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid event.", 400);
  if (!parsed.data.editionStartDate || !parsed.data.editionEndDate || parsed.data.editionEndDate < parsed.data.editionStartDate) {
    return jsonError("Invalid edition date range.", 400);
  }

  const organizerDetails = parseOrganizerEventDetails({
    officialWebsiteUrl: parsed.data.officialSiteUrl,
  });
  const eventResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_events`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({
      name: parsed.data.name,
      location: parsed.data.location,
      race_date: parsed.data.editionStartDate,
      thumbnail_url: null,
      is_live: true,
      organizer_details: organizerDetails,
    }),
    cache: "no-store",
  });

  if (!eventResponse.ok) {
    console.error("Unable to create organizer event", await eventResponse.text());
    return jsonError("Unable to create event.", 502);
  }

  const event = z.array(createdEventSchema).parse(await eventResponse.json())[0] ?? null;
  if (!event) return jsonError("Unable to create event.", 502);

  const editionResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({
      event_id: event.id,
      edition_year: Number(parsed.data.editionStartDate.slice(0, 4)),
      start_date: parsed.data.editionStartDate,
      end_date: parsed.data.editionEndDate,
      is_current: true,
    }),
    cache: "no-store",
  });
  if (!editionResponse.ok) {
    console.error("Unable to create initial organizer event edition", await editionResponse.text());
    await deleteCreatedEvent(auth.serviceConfig, event.id);
    return jsonError("Unable to create event edition.", 502);
  }
  const edition = z.array(createdEditionSchema).parse(await editionResponse.json())[0] ?? null;
  if (!edition) {
    await deleteCreatedEvent(auth.serviceConfig, event.id);
    return jsonError("Unable to create event edition.", 502);
  }

  const membershipResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({
      event_id: event.id,
      user_id: auth.user.id,
      claim_id: null,
      role: "owner",
      created_by: auth.user.id,
    }),
    cache: "no-store",
  });

  if (!membershipResponse.ok) {
    console.error("Unable to grant organizer access to created event", await membershipResponse.text());
    await deleteCreatedEvent(auth.serviceConfig, event.id);
    return jsonError("Unable to grant organizer access.", 502);
  }

  const membership = z.array(createdMembershipSchema).parse(await membershipResponse.json())[0] ?? null;
  if (!membership) {
    await deleteCreatedEvent(auth.serviceConfig, event.id);
    return jsonError("Unable to grant organizer access.", 502);
  }

  return withSecurityHeaders(NextResponse.json({ event, edition, membership }, { status: 201 }));
}

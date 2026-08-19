import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import {
  jsonError,
  optionalTextOrNull,
  optionalUrlOrNull,
  requireOrganizerAuth,
  serviceHeaders,
} from "../../../../lib/organizer";
import { isAdminUser } from "../../../../lib/supabase";

const manualEventInputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  location: optionalTextOrNull,
  raceDate: optionalTextOrNull.refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Invalid race date."
  ),
});

const claimInputSchema = z.object({
  eventId: z.string().uuid().optional(),
  manualEvent: manualEventInputSchema.optional(),
  organizationName: z.string().trim().min(2).max(140),
  roleTitle: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email(),
  officialSiteUrl: optionalUrlOrNull,
  message: z.string().trim().max(2000).optional().transform((value) => value || null),
}).superRefine((value, context) => {
  const hasEventId = Boolean(value.eventId);
  const hasManualEvent = Boolean(value.manualEvent);
  if (hasEventId === hasManualEvent) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose an existing event or add one manually.",
      path: ["eventId"],
    });
  }
});

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
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
});

const createdEventRowSchema = z.object({ id: z.string().uuid() });

async function deleteDraftEvent(auth: Awaited<ReturnType<typeof requireOrganizerAuth>>, eventId: string | null) {
  if (!eventId || "error" in auth) return;
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}`, {
    method: "DELETE",
    headers: serviceHeaders(auth.serviceConfig, ""),
    cache: "no-store",
  }).catch((error) => {
    console.warn("Unable to cleanup draft organizer event", error);
    return null;
  });
  if (response && !response.ok) {
    console.warn("Unable to cleanup draft organizer event", await response.text());
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const [claimsResponse, membershipsResponse, editionRequestsResponse, publicationRequestsResponse, adminEventsResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?user_id=eq.${auth.user.id}&select=id,created_at,event_id,organization_name,role_title,contact_email,official_site_url,message,status,reviewer_notes,reviewed_at,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=created_at.desc`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?user_id=eq.${auth.user.id}&revoked_at=is.null&select=id,created_at,event_id,role,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=created_at.desc`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests?user_id=eq.${auth.user.id}&select=id,created_at,event_id,source_year,requested_start_date,status,reviewer_notes,race_events(id,name,location,race_date,thumbnail_url,is_live)&order=created_at.desc`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_publication_requests?user_id=eq.${auth.user.id}&select=id,created_at,event_id,status,reviewer_notes&order=created_at.desc`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    isAdminUser(auth.user)
      ? fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,location,race_date,thumbnail_url,is_live&order=name.asc`,
          {
            headers: serviceHeaders(auth.serviceConfig, ""),
            cache: "no-store",
          }
        )
      : Promise.resolve(null),
  ]);

  if (
    !claimsResponse.ok ||
    !membershipsResponse.ok ||
    !editionRequestsResponse.ok ||
    !publicationRequestsResponse.ok ||
    (adminEventsResponse && !adminEventsResponse.ok)
  ) {
    console.error("Unable to load organizer claims", {
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

  return withSecurityHeaders(
    NextResponse.json({ claims, memberships: selectableMemberships, editionRequests, publicationRequests })
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimitAsync(`organizer-claim:${auth.user.id}`, 8, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const parsed = claimInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid claim.", 400);
  }

  let eventId = parsed.data.eventId ?? null;
  let draftEventId: string | null = null;

  if (parsed.data.manualEvent) {
    const eventResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_events`, {
      method: "POST",
      headers: {
        ...serviceHeaders(auth.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: parsed.data.manualEvent.name,
        location: parsed.data.manualEvent.location,
        race_date: parsed.data.manualEvent.raceDate,
        thumbnail_url: null,
        is_live: false,
      }),
      cache: "no-store",
    });

    if (!eventResponse.ok) {
      console.error("Unable to create draft race event for organizer claim", await eventResponse.text());
      return jsonError("Unable to create event.", 502);
    }

    const createdEvent = z.array(createdEventRowSchema).parse(await eventResponse.json())[0] ?? null;
    if (!createdEvent) {
      return jsonError("Unable to create event.", 502);
    }
    eventId = createdEvent.id;
    draftEventId = createdEvent.id;
  } else if (eventId) {
    const eventResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id&limit=1`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!eventResponse.ok) {
      console.error("Unable to verify claimed race event", await eventResponse.text());
      return jsonError("Unable to verify event.", 502);
    }

    const eventRows = z.array(createdEventRowSchema).parse(await eventResponse.json());
    if (!eventRows[0]) {
      return jsonError("Event not found.", 404);
    }
  }

  if (!eventId) {
    return jsonError("Event not found.", 404);
  }

  const existingResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?user_id=eq.${auth.user.id}&event_id=eq.${eventId}&status=in.(pending,approved)&select=id,status&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!existingResponse.ok) {
    console.error("Unable to inspect existing organizer claims", await existingResponse.text());
    await deleteDraftEvent(auth, draftEventId);
    return jsonError("Unable to create claim.", 502);
  }

  const existing = (await existingResponse.json().catch(() => [])) as Array<{ id?: string; status?: string }>;
  if (existing.length > 0) {
    await deleteDraftEvent(auth, draftEventId);
    return jsonError("You already have an open claim for this event.", 409);
  }

  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: auth.user.id,
      event_id: eventId,
      organization_name: parsed.data.organizationName,
      role_title: parsed.data.roleTitle,
      contact_email: parsed.data.contactEmail,
      official_site_url: parsed.data.officialSiteUrl,
      message: parsed.data.message,
      status: "pending",
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create organizer claim", await insertResponse.text());
    await deleteDraftEvent(auth, draftEventId);
    return jsonError("Unable to create claim.", 502);
  }

  const claim = z.array(claimRowSchema.omit({ race_events: true })).parse(await insertResponse.json())[0];
  return withSecurityHeaders(NextResponse.json({ claim }, { status: 201 }));
}

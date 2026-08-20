import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const publicationRequestSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
  race_events: z.object({
    name: z.string(),
    location: z.string().nullable().optional(),
    race_date: z.string().nullable().optional(),
  }).nullable().optional(),
});

const publicationEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  race_event_editions: z.array(z.object({
    id: z.string().uuid(),
    is_current: z.boolean(),
  })).nullable().optional(),
  races: z.array(z.object({
    id: z.string().uuid(),
    edition_id: z.string().uuid().nullable().optional(),
    name: z.string(),
    race_date: z.string().nullable().optional(),
    racebook_is_live: z.boolean(),
    racebook_publication_approved_at: z.string().nullable().optional(),
  })).nullable().optional(),
});

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  reviewerNotes: z.string().trim().max(2000).optional().default(""),
});

const visibilitySchema = z.object({
  action: z.literal("setRacebookVisibility"),
  eventId: z.string().uuid(),
  isLive: z.boolean(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const [response, eventsResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_publication_requests?status=eq.pending&select=id,created_at,user_id,event_id,status,reviewer_notes,race_events(name,location,race_date)&order=created_at.asc`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,location,race_date,race_event_editions(id,is_current),races(id,edition_id,name,race_date,racebook_is_live,racebook_publication_approved_at)&order=name.asc`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
  ]);
  if (!response.ok || !eventsResponse.ok) return jsonError("Unable to load Racebook publication controls.", 502);

  const publicationRequests = z.array(publicationRequestSchema).parse(await response.json());
  const events = z.array(publicationEventSchema).parse(await eventsResponse.json()).map((event) => {
    const currentEditionId = (event.race_event_editions ?? []).find((edition) => edition.is_current)?.id ?? null;
    return {
      id: event.id,
      name: event.name,
      location: event.location ?? null,
      race_date: event.race_date ?? null,
      races: (event.races ?? [])
        .filter((race) => !currentEditionId || race.edition_id === currentEditionId)
        .sort((left, right) => left.name.localeCompare(right.name, "fr")),
    };
  });
  return withSecurityHeaders(NextResponse.json({ publicationRequests, events }));
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const visibility = visibilitySchema.safeParse(body);
  if (visibility.success) {
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/set_race_event_racebook_visibility`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({
        p_event_id: visibility.data.eventId,
        p_reviewer_id: auth.user.id,
        p_is_live: visibility.data.isLive,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Unable to update admin Racebook visibility", await response.text());
      return jsonError("Unable to update Racebook visibility.", 502);
    }

    return withSecurityHeaders(NextResponse.json({ changedCount: await response.json() }));
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid publication review.", 400);

  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/review_race_event_publication_request`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify({
      p_request_id: parsed.data.requestId,
      p_reviewer_id: auth.user.id,
      p_status: parsed.data.status,
      p_reviewer_notes: parsed.data.reviewerNotes,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Unable to review publication request", await response.text());
    return jsonError("Unable to review publication request.", response.status === 409 ? 409 : 502);
  }

  return withSecurityHeaders(NextResponse.json({ publicationRequest: await response.json() }));
}

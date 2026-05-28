import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import {
  jsonError,
  optionalUrlOrNull,
  requireOrganizerAuth,
  serviceHeaders,
} from "../../../../lib/organizer";

const claimInputSchema = z.object({
  eventId: z.string().uuid(),
  organizationName: z.string().trim().min(2).max(140),
  roleTitle: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email(),
  officialSiteUrl: optionalUrlOrNull,
  message: z.string().trim().max(2000).optional().transform((value) => value || null),
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
  race_events: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
      thumbnail_url: z.string().nullable().optional(),
      is_live: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const membershipRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_id: z.string().uuid(),
  role: z.string(),
  race_events: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
      thumbnail_url: z.string().nullable().optional(),
      is_live: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const [claimsResponse, membershipsResponse] = await Promise.all([
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
  ]);

  if (!claimsResponse.ok || !membershipsResponse.ok) {
    console.error("Unable to load organizer claims", {
      claims: claimsResponse.ok ? null : await claimsResponse.text(),
      memberships: membershipsResponse.ok ? null : await membershipsResponse.text(),
    });
    return jsonError("Unable to load organizer data.", 502);
  }

  const claims = z.array(claimRowSchema).parse(await claimsResponse.json());
  const memberships = z.array(membershipRowSchema).parse(await membershipsResponse.json());

  return withSecurityHeaders(NextResponse.json({ claims, memberships }));
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

  const eventResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsed.data.eventId}&select=id&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!eventResponse.ok) {
    console.error("Unable to verify claimed race event", await eventResponse.text());
    return jsonError("Unable to verify event.", 502);
  }

  const eventRows = z.array(z.object({ id: z.string().uuid() })).parse(await eventResponse.json());
  if (!eventRows[0]) {
    return jsonError("Event not found.", 404);
  }

  const existingResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?user_id=eq.${auth.user.id}&event_id=eq.${parsed.data.eventId}&status=in.(pending,approved)&select=id,status&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!existingResponse.ok) {
    console.error("Unable to inspect existing organizer claims", await existingResponse.text());
    return jsonError("Unable to create claim.", 502);
  }

  const existing = (await existingResponse.json().catch(() => [])) as Array<{ id?: string; status?: string }>;
  if (existing.length > 0) {
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
      event_id: parsed.data.eventId,
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
    return jsonError("Unable to create claim.", 502);
  }

  const claim = z.array(claimRowSchema.omit({ race_events: true })).parse(await insertResponse.json())[0];
  return withSecurityHeaders(NextResponse.json({ claim }, { status: 201 }));
}

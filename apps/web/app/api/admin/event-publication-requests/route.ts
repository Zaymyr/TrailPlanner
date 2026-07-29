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

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  reviewerNotes: z.string().trim().max(2000).optional().default(""),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_publication_requests?status=eq.pending&select=id,created_at,user_id,event_id,status,reviewer_notes,race_events(name,location,race_date)&order=created_at.asc`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) return jsonError("Unable to load publication requests.", 502);

  const publicationRequests = z.array(publicationRequestSchema).parse(await response.json());
  return withSecurityHeaders(NextResponse.json({ publicationRequests }));
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
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

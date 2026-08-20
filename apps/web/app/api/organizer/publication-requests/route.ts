import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import { validateOrganizerEventPublication } from "../../../../lib/organizer-publication";

const requestSchema = z.object({ eventId: z.string().uuid(), raceId: z.string().uuid() });
const rowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  race_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
  created_at: z.string(),
});

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimitAsync(`organizer-publication:${auth.user.id}`, 5, 60_000);
  if (!rateLimit.allowed) return jsonError("Too many requests.", 429);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid publication request.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsed.data.eventId);
  if (organizer !== true) return organizer.error;

  const readiness = await validateOrganizerEventPublication(auth.serviceConfig, parsed.data.eventId, parsed.data.raceId);
  if (!readiness.ok) return jsonError(readiness.message, readiness.status);

  const existingResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_publication_requests?race_id=eq.${parsed.data.raceId}&status=eq.pending&select=id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!existingResponse.ok) return jsonError("Unable to inspect publication requests.", 502);
  if (((await existingResponse.json()) as unknown[]).length > 0) {
    return jsonError("Une demande de publication est déjà en attente pour ce format.", 409);
  }

  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_publication_requests`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: auth.user.id, event_id: parsed.data.eventId, race_id: parsed.data.raceId, status: "pending" }),
    cache: "no-store",
  });
  if (!insertResponse.ok) {
    console.error("Unable to create publication request", await insertResponse.text());
    return jsonError("Unable to create publication request.", 502);
  }

  const publicationRequest = z.array(rowSchema).parse(await insertResponse.json())[0] ?? null;
  return withSecurityHeaders(NextResponse.json({ publicationRequest }, { status: 201 }));
}

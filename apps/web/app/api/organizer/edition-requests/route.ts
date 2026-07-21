import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";

const createEditionRequestSchema = z.object({
  eventId: z.string().uuid(),
  sourceYear: z.number().int().min(2000).max(2100),
  requestedStartDate: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid requested start date."),
});

const editionRequestRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  source_year: z.number().int(),
  requested_start_date: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewer_notes: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsed = createEditionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid edition request.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsed.data.eventId);
  if (organizer !== true) return organizer.error;

  const requestedYear = parsed.data.requestedStartDate.slice(0, 4);
  const nextYear = (Number(requestedYear) + 1).toString();

  const existingEventEditionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?event_id=eq.${parsed.data.eventId}&race_date=gte.${requestedYear}-01-01&race_date=lt.${nextYear}-01-01&select=id&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!existingEventEditionResponse.ok) {
    console.error("Unable to inspect existing event editions", await existingEventEditionResponse.text());
    return jsonError("Unable to inspect existing editions.", 502);
  }

  const existingEdition = z.array(z.object({ id: z.string().uuid() })).parse(await existingEventEditionResponse.json())[0] ?? null;
  if (existingEdition) {
    return jsonError("An edition already exists for that year.", 409);
  }

  const openRequestResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests?event_id=eq.${parsed.data.eventId}&requested_start_date=eq.${parsed.data.requestedStartDate}&status=in.(pending,approved)&select=id&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!openRequestResponse.ok) {
    console.error("Unable to inspect existing edition requests", await openRequestResponse.text());
    return jsonError("Unable to create edition request.", 502);
  }

  const openRequest = z.array(z.object({ id: z.string().uuid() })).parse(await openRequestResponse.json())[0] ?? null;
  if (openRequest) {
    return jsonError("An open edition request already exists for that date.", 409);
  }

  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: auth.user.id,
      event_id: parsed.data.eventId,
      source_year: parsed.data.sourceYear,
      requested_start_date: parsed.data.requestedStartDate,
      status: "pending",
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create organizer edition request", await insertResponse.text());
    return jsonError("Unable to create edition request.", 502);
  }

  const editionRequest = z.array(editionRequestRowSchema).parse(await insertResponse.json())[0] ?? null;
  return withSecurityHeaders(NextResponse.json({ editionRequest }, { status: 201 }));
}

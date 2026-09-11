import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import { loadOrganizerEditionPayments } from "../../../../lib/organizer-payments";

const editionSchema = z.object({ id: z.string().uuid(), edition_year: z.number().int() });

export async function GET(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const eventId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("eventId"));
  if (!eventId.success) return jsonError("Identifiant d’événement invalide.", 400);
  const authorized = await requireEventOrganizer(auth.serviceConfig, auth.user, eventId.data);
  if (authorized !== true) return authorized.error;

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${eventId.data}&select=id,edition_year&order=edition_year.desc`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Impossible de charger les éditions.", 502);
  const editions = z.array(editionSchema).parse(await editionResponse.json());
  const payments = await loadOrganizerEditionPayments(auth.serviceConfig, editions.map((edition) => edition.id));
  const years = new Map(editions.map((edition) => [edition.id, edition.edition_year]));
  const invoices = editions.flatMap((edition) =>
    (payments[edition.id] ?? []).map((payment) => ({ ...payment, editionYear: years.get(edition.id) }))
  ).sort((left, right) => (right.paidAt ?? "").localeCompare(left.paidAt ?? ""));

  return withSecurityHeaders(NextResponse.json({ invoices }));
}

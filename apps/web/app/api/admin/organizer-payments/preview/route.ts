import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import {
  buildOrganizerInvoiceSnapshot,
  generateOrganizerInvoicePdf,
  organizerInvoiceCustomerSchema,
} from "../../../../../lib/organizer-invoice-document";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../lib/organizer";
import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR } from "../../../../../lib/organizer-modules";

const requestSchema = z.object({
  editionId: z.string().uuid(),
  tier: z.enum(["essential", "complete", "signature"]),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer: organizerInvoiceCustomerSchema,
});

const editionSchema = z.object({
  edition_year: z.number().int(),
  race_events: z.object({ name: z.string().min(1) }),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Renseignez toutes les mentions obligatoires de la facture.", 400);

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${body.data.editionId}&select=edition_year,race_events(name)&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Impossible de charger l'édition.", 502);
  const editions = z.array(editionSchema).safeParse(await editionResponse.json());
  const edition = editions.success ? editions.data[0] : null;
  if (!edition) return jsonError("Édition introuvable.", 404);

  const subtotalCents = ORGANIZER_TIER_PRICE_EUR[body.data.tier] * 100;
  const snapshot = buildOrganizerInvoiceSnapshot({
    customer: body.data.customer,
    eventName: edition.race_events.name,
    editionYear: edition.edition_year,
    tierLabel: ORGANIZER_TIER_LABEL[body.data.tier],
    paidDate: body.data.paidDate,
    subtotalCents,
  });
  const pdf = await generateOrganizerInvoicePdf({ snapshot, invoiceNumber: null, issuedAt: new Date() });
  return withSecurityHeaders(new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="projet-facture-pace-yourself.pdf"',
      "Cache-Control": "private, no-store",
    },
  }));
}

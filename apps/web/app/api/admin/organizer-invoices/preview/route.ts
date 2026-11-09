import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { generateOrganizerInvoicePdf } from "../../../../../lib/organizer-invoice-document";
import { buildManualOrganizerInvoice, buildManualOrganizerInvoiceSnapshot, organizerManualInvoiceInputSchema } from "../../../../../lib/organizer-manual-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../lib/organizer";

const editionSchema = z.object({ edition_year: z.number().int(), race_events: z.object({ name: z.string().min(1) }) });
const replacementSchema = z.object({ invoice_number: z.string(), invoice_issued_at: z.string(), edition_id: z.string().uuid(), paid_at: z.string().nullable(), document_status: z.enum(["active", "replaced"]) });

async function loadContext(config: Parameters<typeof buildManualOrganizerInvoice>[0], editionId: string, replacesInvoiceId?: string | null) {
  const editionResponse = await fetch(`${config.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=edition_year,race_events(name)&limit=1`, { headers: serviceHeaders(config, ""), cache: "no-store" });
  if (!editionResponse.ok) throw new Error("Impossible de charger l’édition.");
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0];
  if (!edition) throw new Error("Édition introuvable.");
  if (!replacesInvoiceId) return { edition, replacement: null };
  const response = await fetch(`${config.supabaseUrl}/rest/v1/organizer_invoices?id=eq.${replacesInvoiceId}&select=invoice_number,invoice_issued_at,edition_id,paid_at,document_status&limit=1`, { headers: serviceHeaders(config, ""), cache: "no-store" });
  if (!response.ok) throw new Error("Impossible de charger la facture remplacée.");
  const replacement = z.array(replacementSchema).parse(await response.json())[0];
  if (!replacement || replacement.edition_id !== editionId || replacement.paid_at || replacement.document_status !== "active") throw new Error("Seule une facture active et impayée peut être rectifiée.");
  return { edition, replacement };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const input = organizerManualInvoiceInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(input.error.issues[0]?.message ?? "Facture invalide.", 400);
  try {
    const [{ edition, replacement }, commercial] = await Promise.all([
      loadContext(auth.serviceConfig, input.data.editionId, input.data.replacesInvoiceId),
      buildManualOrganizerInvoice(auth.serviceConfig, input.data),
    ]);
    const snapshot = buildManualOrganizerInvoiceSnapshot({
      customer: input.data.customer,
      eventName: edition.race_events.name,
      editionYear: edition.edition_year,
      tier: input.data.tier,
      serviceDate: input.data.serviceDate,
      dueDate: input.data.dueDate,
      lines: commercial.lines,
      totals: commercial.totals,
      correction: replacement ? { replacesInvoiceNumber: replacement.invoice_number, replacesIssuedAt: replacement.invoice_issued_at } : undefined,
    });
    const bytes = await generateOrganizerInvoicePdf({ snapshot, invoiceNumber: null, issuedAt: new Date() });
    return withSecurityHeaders(new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Impossible de prévisualiser la facture.", 400);
  }
}

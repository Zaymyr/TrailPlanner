import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  buildManualOrganizerInvoice,
  buildManualOrganizerInvoiceSnapshot,
  organizerInvoiceRowSchema,
  organizerManualInvoiceInputSchema,
  renderAndStoreManualOrganizerInvoice,
} from "../../../../lib/organizer-manual-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const editionSchema = z.object({ edition_year: z.number().int(), race_events: z.object({ name: z.string().min(1) }) });
const replacementSchema = z.object({ invoice_number: z.string(), invoice_issued_at: z.string(), edition_id: z.string().uuid(), paid_at: z.string().nullable(), document_status: z.enum(["active", "replaced"]) });

async function loadContext(config: Parameters<typeof buildManualOrganizerInvoice>[0], editionId: string, replacesInvoiceId?: string | null) {
  const [editionResponse, replacementResponse] = await Promise.all([
    fetch(`${config.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=edition_year,race_events(name)&limit=1`, { headers: serviceHeaders(config, ""), cache: "no-store" }),
    replacesInvoiceId
      ? fetch(`${config.supabaseUrl}/rest/v1/organizer_invoices?id=eq.${replacesInvoiceId}&select=invoice_number,invoice_issued_at,edition_id,paid_at,document_status&limit=1`, { headers: serviceHeaders(config, ""), cache: "no-store" })
      : Promise.resolve(null),
  ]);
  if (!editionResponse.ok || replacementResponse && !replacementResponse.ok) throw new Error("Unable to load invoice context.");
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0];
  if (!edition) throw new Error("Édition introuvable.");
  const replacement = replacementResponse ? z.array(replacementSchema).parse(await replacementResponse.json())[0] : null;
  if (replacesInvoiceId && (!replacement || replacement.edition_id !== editionId || replacement.paid_at || replacement.document_status !== "active")) {
    throw new Error("Seule une facture active et impayée peut être rectifiée.");
  }
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
    const issueResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/issue_admin_organizer_invoice`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({
        p_edition_id: input.data.editionId,
        p_admin_id: auth.user.id,
        p_tier: input.data.tier,
        p_service_date: input.data.serviceDate,
        p_due_date: input.data.dueDate,
        p_original_subtotal: commercial.totals.originalSubtotal,
        p_discount_total: commercial.totals.discountTotal,
        p_net_total: commercial.totals.netTotal,
        p_legal_snapshot: snapshot,
        p_replaces_invoice_id: input.data.replacesInvoiceId ?? null,
      }),
      cache: "no-store",
    });
    if (!issueResponse.ok) {
      const detail = await issueResponse.text();
      if (/active unpaid invoice/i.test(detail)) return jsonError("Cette facture ne peut plus être rectifiée.", 409);
      console.error("Organizer invoice RPC failed", detail);
      throw new Error("Impossible d’émettre la facture.");
    }
    const invoice = organizerInvoiceRowSchema.parse(await issueResponse.json());
    try {
      const stored = await renderAndStoreManualOrganizerInvoice(auth.serviceConfig, auth.user.id, invoice);
      return withSecurityHeaders(NextResponse.json({ invoice: stored }, { status: 201 }));
    } catch (error) {
      console.error("Invoice numbered but PDF storage failed", error);
      return withSecurityHeaders(NextResponse.json({ invoice, warning: "La facture est numérotée mais son PDF doit être régénéré." }, { status: 202 }));
    }
  } catch (error) {
    console.error("Unable to issue organizer invoice", error);
    return jsonError(error instanceof Error ? error.message : "Impossible d’émettre la facture.", 400);
  }
}


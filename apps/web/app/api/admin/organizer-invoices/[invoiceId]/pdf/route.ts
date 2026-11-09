import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { organizerInvoiceRowSchema, renderAndStoreManualOrganizerInvoice } from "../../../../../../lib/organizer-manual-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../../lib/organizer";

export async function POST(request: NextRequest, context: { params: { invoiceId?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const invoiceId = z.string().uuid().safeParse(context.params.invoiceId);
  if (!invoiceId.success) return jsonError("Identifiant de facture invalide.", 400);
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_invoices?id=eq.${invoiceId.data}&select=id,edition_id,invoice_number,invoice_sequence,invoice_issued_at,invoice_type,replaces_invoice_id,document_status,tier,service_date,due_date,original_subtotal,discount_total,net_total,currency,legal_snapshot,invoice_storage_path,invoice_original_name,paid_at,payment_reference&limit=1`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" });
  if (!response.ok) return jsonError("Impossible de charger cette facture.", 502);
  const invoice = z.array(organizerInvoiceRowSchema).parse(await response.json())[0];
  if (!invoice) return jsonError("Facture introuvable.", 404);
  if (invoice.invoice_storage_path) return jsonError("Le PDF de cette facture est déjà disponible.", 409);
  try {
    return withSecurityHeaders(NextResponse.json({ invoice: await renderAndStoreManualOrganizerInvoice(auth.serviceConfig, auth.user.id, invoice) }));
  } catch (error) {
    console.error("Unable to regenerate manual organizer invoice PDF", error);
    return jsonError("Impossible de régénérer le PDF.", 502);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { createOrganizerInvoiceDownloadUrl } from "../../../../../../lib/organizer-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../../lib/organizer";

const rowSchema = z.object({ id: z.string().uuid(), invoice_number: z.string(), invoice_storage_path: z.string().nullable(), invoice_original_name: z.string().nullable() });

export async function GET(request: NextRequest, context: { params: { invoiceId?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const invoiceId = z.string().uuid().safeParse(context.params.invoiceId);
  if (!invoiceId.success) return jsonError("Identifiant de facture invalide.", 400);
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_invoices?id=eq.${invoiceId.data}&select=id,invoice_number,invoice_storage_path,invoice_original_name&limit=1`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" });
  if (!response.ok) return jsonError("Impossible de charger cette facture.", 502);
  const invoice = z.array(rowSchema).parse(await response.json())[0];
  if (!invoice) return jsonError("Facture introuvable.", 404);
  if (!invoice.invoice_storage_path) return jsonError("Le PDF doit être régénéré.", 409);
  const url = await createOrganizerInvoiceDownloadUrl(auth.serviceConfig, invoice.invoice_storage_path, invoice.invoice_original_name ?? `${invoice.invoice_number}.pdf`);
  return withSecurityHeaders(NextResponse.json({ url }));
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { organizerInvoiceRowSchema } from "../../../../../../lib/organizer-manual-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../../lib/organizer";

const bodySchema = z.object({ paidAt: z.string().datetime(), paymentReference: z.string().trim().max(120).nullable().optional() });

export async function POST(request: NextRequest, context: { params: { invoiceId?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const invoiceId = z.string().uuid().safeParse(context.params.invoiceId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!invoiceId.success || !body.success) return jsonError("Règlement invalide.", 400);
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/settle_admin_organizer_invoice`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify({ p_invoice_id: invoiceId.data, p_admin_id: auth.user.id, p_paid_at: body.data.paidAt, p_payment_reference: body.data.paymentReference ?? null }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/cannot be settled/i.test(detail)) return jsonError("Cette facture ne peut pas être réglée.", 409);
    return jsonError("Impossible d’enregistrer le règlement.", 502);
  }
  return withSecurityHeaders(NextResponse.json({ invoice: organizerInvoiceRowSchema.parse(await response.json()) }));
}

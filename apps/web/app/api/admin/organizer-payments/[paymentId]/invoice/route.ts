import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  buildOrganizerInvoicePath,
  deleteOrganizerInvoice,
  uploadOrganizerInvoice,
  validateOrganizerInvoice,
} from "../../../../../../lib/organizer-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../../lib/organizer";

const paymentSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  payment_channel: z.literal("bank_transfer"),
  invoice_storage_path: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest, context: { params: { paymentId?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const paymentId = z.string().uuid().safeParse(context.params.paymentId);
  if (!paymentId.success) return jsonError("Identifiant de paiement invalide.", 400);
  const formData = await request.formData().catch(() => null);
  const invoice = formData?.get("invoice");
  if (!(invoice instanceof File)) return jsonError("La facture PDF est obligatoire.", 400);

  const paymentResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${paymentId.data}&select=id,edition_id,payment_channel,invoice_storage_path&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!paymentResponse.ok) return jsonError("Impossible de charger cet achat.", 502);
  const payment = z.array(paymentSchema).safeParse(await paymentResponse.json());
  const current = payment.success ? payment.data[0] : null;
  if (!current) return jsonError("Achat par virement introuvable.", 404);

  let nextPath: string | null = null;
  try {
    const bytes = await validateOrganizerInvoice(invoice);
    nextPath = buildOrganizerInvoicePath(current.edition_id, current.id);
    await uploadOrganizerInvoice(auth.serviceConfig, nextPath, bytes);
    const updateResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${current.id}&payment_channel=eq.bank_transfer`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
        body: JSON.stringify({
          invoice_storage_path: nextPath,
          invoice_original_name: invoice.name,
          invoice_uploaded_at: new Date().toISOString(),
          invoice_uploaded_by: auth.user.id,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );
    if (!updateResponse.ok) throw new Error(await updateResponse.text());
    await deleteOrganizerInvoice(auth.serviceConfig, current.invoice_storage_path);
    return withSecurityHeaders(NextResponse.json({ payment: await updateResponse.json() }));
  } catch (error) {
    await deleteOrganizerInvoice(auth.serviceConfig, nextPath);
    console.error("Unable to replace organizer invoice", error);
    return jsonError(error instanceof Error ? error.message : "Impossible d’enregistrer cette facture.", 400);
  }
}

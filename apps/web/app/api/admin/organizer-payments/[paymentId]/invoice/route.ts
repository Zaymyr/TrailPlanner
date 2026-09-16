import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { generateOrganizerInvoicePdf, organizerInvoiceSnapshotSchema } from "../../../../../../lib/organizer-invoice-document";
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
  invoice_number: z.string().nullable().optional(),
  invoice_issued_at: z.string().nullable().optional(),
  invoice_source: z.enum(["generated", "uploaded"]).nullable().optional(),
  invoice_legal_snapshot: organizerInvoiceSnapshotSchema.nullable().optional(),
});

async function loadPayment(
  serviceConfig: { supabaseUrl: string; supabaseServiceRoleKey: string },
  paymentId: string
) {
  const paymentResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${paymentId}&select=id,edition_id,payment_channel,invoice_storage_path,invoice_number,invoice_issued_at,invoice_source,invoice_legal_snapshot&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!paymentResponse.ok) return { error: jsonError("Impossible de charger cet achat.", 502) } as const;
  const payment = z.array(paymentSchema).safeParse(await paymentResponse.json());
  return { payment: payment.success ? payment.data[0] ?? null : null } as const;
}

export async function PUT(request: NextRequest, context: { params: { paymentId?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const paymentId = z.string().uuid().safeParse(context.params.paymentId);
  if (!paymentId.success) return jsonError("Identifiant de paiement invalide.", 400);
  const formData = await request.formData().catch(() => null);
  const invoice = formData?.get("invoice");
  if (!(invoice instanceof File)) return jsonError("La facture PDF est obligatoire.", 400);

  const loaded = await loadPayment(auth.serviceConfig, paymentId.data);
  if ("error" in loaded) return loaded.error;
  const current = loaded.payment;
  if (!current) return jsonError("Achat par virement introuvable.", 404);
  if (current.invoice_source === "generated") {
    return jsonError("Une facture générée ne peut pas être remplacée manuellement. Utilisez sa régénération sécurisée.", 409);
  }

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

export async function POST(request: NextRequest, context: { params: { paymentId?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const paymentId = z.string().uuid().safeParse(context.params.paymentId);
  if (!paymentId.success) return jsonError("Identifiant de paiement invalide.", 400);
  const loaded = await loadPayment(auth.serviceConfig, paymentId.data);
  if ("error" in loaded) return loaded.error;
  const current = loaded.payment;
  if (!current || current.payment_channel !== "bank_transfer") return jsonError("Achat par virement introuvable.", 404);
  if (current.invoice_source !== "generated" || !current.invoice_number || !current.invoice_issued_at || !current.invoice_legal_snapshot) {
    return jsonError("Cette facture n'a pas de données de génération disponibles.", 409);
  }

  let nextPath: string | null = null;
  try {
    const pdf = await generateOrganizerInvoicePdf({
      snapshot: current.invoice_legal_snapshot,
      invoiceNumber: current.invoice_number,
      issuedAt: new Date(current.invoice_issued_at),
    });
    nextPath = buildOrganizerInvoicePath(current.edition_id, current.id);
    const pdfBytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    await uploadOrganizerInvoice(auth.serviceConfig, nextPath, pdfBytes);
    const invoiceName = `facture-${current.invoice_number}.pdf`;
    const updateResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${current.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({
        invoice_storage_path: nextPath,
        invoice_original_name: invoiceName,
        invoice_uploaded_at: new Date().toISOString(),
        invoice_uploaded_by: auth.user.id,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!updateResponse.ok) throw new Error(await updateResponse.text());
    await deleteOrganizerInvoice(auth.serviceConfig, current.invoice_storage_path);
    return withSecurityHeaders(NextResponse.json({ payment: await updateResponse.json() }));
  } catch (error) {
    await deleteOrganizerInvoice(auth.serviceConfig, nextPath);
    console.error("Unable to regenerate organizer invoice", error);
    return jsonError("Impossible de régénérer cette facture.", 502);
  }
}

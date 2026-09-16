import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  buildOrganizerInvoiceSnapshot,
  generateOrganizerInvoicePdf,
  organizerInvoiceCustomerSchema,
  organizerInvoiceSnapshotSchema,
} from "../../../../lib/organizer-invoice-document";
import { buildOrganizerInvoicePath, deleteOrganizerInvoice, uploadOrganizerInvoice } from "../../../../lib/organizer-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";
import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR } from "../../../../lib/organizer-modules";

const paidTierSchema = z.enum(["essential", "complete", "signature"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});
const editionSchema = z.object({ edition_year: z.number().int(), race_events: z.object({ name: z.string().min(1) }) });
const paymentSchema = z.object({ id: z.string().uuid(), edition_id: z.string().uuid() });
const issuedPaymentSchema = paymentSchema.extend({
  invoice_number: z.string().min(1),
  invoice_issued_at: z.string(),
  invoice_legal_snapshot: organizerInvoiceSnapshotSchema,
});

const currentParisDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("Formulaire d'achat invalide.", 400);

  const editionId = z.string().uuid().safeParse(formData.get("editionId"));
  const tier = paidTierSchema.safeParse(formData.get("tier"));
  const paidDate = dateSchema.safeParse(formData.get("paidDate"));
  const customer = organizerInvoiceCustomerSchema.safeParse({
    legalName: formData.get("customerLegalName"),
    billingAddress: formData.get("customerBillingAddress"),
    siren: formData.get("customerSiren"),
    vatNumber: formData.get("customerVatNumber") ?? undefined,
    purchaseOrderNumber: formData.get("purchaseOrderNumber") ?? undefined,
  });
  if (!editionId.success || !tier.success || !paidDate.success || !customer.success) {
    return jsonError("Renseignez le paiement et toutes les mentions obligatoires du client.", 400);
  }
  if (paidDate.data > currentParisDate()) return jsonError("La date de paiement ne peut pas être future.", 400);

  const amountSubtotal = ORGANIZER_TIER_PRICE_EUR[tier.data] * 100;
  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId.data}&select=edition_year,race_events(name)&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Impossible de charger l'édition.", 502);
  const editions = z.array(editionSchema).safeParse(await editionResponse.json());
  const edition = editions.success ? editions.data[0] : null;
  if (!edition) return jsonError("Édition introuvable.", 404);
  const snapshot = buildOrganizerInvoiceSnapshot({
    customer: customer.data,
    eventName: edition.race_events.name,
    editionYear: edition.edition_year,
    tierLabel: ORGANIZER_TIER_LABEL[tier.data],
    paidDate: paidDate.data,
    subtotalCents: amountSubtotal,
  });

  let invoicePath: string | null = null;
  try {
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/record_admin_organizer_bank_transfer_invoice`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({
        p_edition_id: editionId.data, p_admin_id: auth.user.id, p_tier: tier.data,
        p_paid_at: `${paidDate.data}T00:00:00.000Z`, p_amount_subtotal: amountSubtotal,
        p_invoice_legal_snapshot: snapshot,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Unable to record organizer bank transfer", detail);
      if (/already active|cannot downgrade/i.test(detail)) return jsonError("Ce niveau est déjà actif ou inférieur au niveau actuel.", 409);
      return jsonError("Impossible d'enregistrer ce paiement par virement.", 502);
    }
    const issuedPayment = issuedPaymentSchema.parse(await response.json());
    const payment = paymentSchema.parse(issuedPayment);
    const invoiceName = `facture-${issuedPayment.invoice_number}.pdf`;
    invoicePath = buildOrganizerInvoicePath(payment.edition_id, payment.id);
    const pdf = await generateOrganizerInvoicePdf({
      snapshot: issuedPayment.invoice_legal_snapshot,
      invoiceNumber: issuedPayment.invoice_number,
      issuedAt: new Date(issuedPayment.invoice_issued_at),
    });
    const pdfBytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    await uploadOrganizerInvoice(auth.serviceConfig, invoicePath, pdfBytes);
    const updateResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${payment.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({
        invoice_storage_path: invoicePath, invoice_original_name: invoiceName,
        invoice_uploaded_at: new Date().toISOString(), invoice_uploaded_by: auth.user.id, updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!updateResponse.ok) throw new Error(`Unable to attach generated organizer invoice: ${await updateResponse.text()}`);
    return withSecurityHeaders(NextResponse.json({ payment: await updateResponse.json() }, { status: 201 }));
  } catch (error) {
    await deleteOrganizerInvoice(auth.serviceConfig, invoicePath);
    console.error("Unable to generate organizer invoice", error);
    if (invoicePath) {
      return withSecurityHeaders(NextResponse.json({
        warning: "Le paiement et le numéro de facture sont enregistrés, mais le PDF doit être régénéré depuis la liste.",
      }, { status: 202 }));
    }
    return jsonError("Impossible d'enregistrer cet achat.", 502);
  }
}

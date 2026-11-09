import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { organizerInvoiceRowSchema, renderAndStoreManualOrganizerInvoice } from "../../../../../../lib/organizer-manual-invoices";
import { createOrganizerInvoiceDownloadUrl } from "../../../../../../lib/organizer-invoices";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../../../lib/organizer";
import { getStripeConfig, getStripeJson } from "../../../../../../lib/stripe";

const paymentSchema = z.object({
  id: z.string().uuid(),
  payment_channel: z.enum(["stripe", "bank_transfer"]),
  status: z.enum(["paid", "refunded", "disputed"]),
  stripe_checkout_session_id: z.string().nullable().optional(),
  stripe_invoice_id: z.string().nullable().optional(),
  invoice_storage_path: z.string().nullable().optional(),
  invoice_original_name: z.string().nullable().optional(),
  race_event_editions: z.object({ event_id: z.string().uuid() }),
});

export async function GET(request: NextRequest, context: { params: { paymentId?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const paymentId = z.string().uuid().safeParse(context.params.paymentId);
  if (!paymentId.success) return jsonError("Identifiant de paiement invalide.", 400);
  const manualResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_invoices?id=eq.${paymentId.data}&select=id,edition_id,invoice_number,invoice_sequence,invoice_issued_at,invoice_type,replaces_invoice_id,document_status,tier,service_date,due_date,original_subtotal,discount_total,net_total,currency,legal_snapshot,invoice_storage_path,invoice_original_name,paid_at,payment_reference,race_event_editions(event_id)&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (manualResponse.ok) {
    const manual = z.array(organizerInvoiceRowSchema.extend({
      race_event_editions: z.object({ event_id: z.string().uuid() }),
    })).parse(await manualResponse.json())[0];
    if (manual) {
      const authorized = await requireEventOrganizer(auth.serviceConfig, auth.user, manual.race_event_editions.event_id);
      if (authorized !== true) return authorized.error;
      let availableInvoice = manual;
      if (!availableInvoice.invoice_storage_path) {
        try {
          availableInvoice = { ...availableInvoice, ...await renderAndStoreManualOrganizerInvoice(auth.serviceConfig, auth.user.id, availableInvoice) };
        } catch (error) {
          console.error("Unable to lazily generate organizer invoice PDF", error);
          return jsonError("Impossible de générer le PDF de cette facture.", 502);
        }
      }
      if (!availableInvoice.invoice_storage_path) return jsonError("Cette facture n’est pas disponible.", 502);
      const url = await createOrganizerInvoiceDownloadUrl(auth.serviceConfig, availableInvoice.invoice_storage_path, availableInvoice.invoice_original_name ?? `facture-${availableInvoice.id}.pdf`);
      return withSecurityHeaders(NextResponse.json({ url }));
    }
  }
  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${paymentId.data}&status=in.(paid,refunded,disputed)&select=id,payment_channel,status,stripe_checkout_session_id,stripe_invoice_id,invoice_storage_path,invoice_original_name,race_event_editions(event_id)&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) return jsonError("Impossible de charger cette facture.", 502);
  const parsed = z.array(paymentSchema).safeParse(await response.json());
  const payment = parsed.success ? parsed.data[0] : null;
  if (!payment) return jsonError("Facture introuvable.", 404);
  const authorized = await requireEventOrganizer(auth.serviceConfig, auth.user, payment.race_event_editions.event_id);
  if (authorized !== true) return authorized.error;

  if (payment.payment_channel === "bank_transfer") {
    if (!payment.invoice_storage_path) return jsonError("Cette facture n’est pas encore disponible.", 409);
    try {
      const url = await createOrganizerInvoiceDownloadUrl(
        auth.serviceConfig,
        payment.invoice_storage_path,
        payment.invoice_original_name ?? `facture-${payment.id}.pdf`
      );
      return withSecurityHeaders(NextResponse.json({ url }));
    } catch (error) {
      console.error("Unable to sign organizer invoice", error);
      return jsonError("Impossible de préparer le téléchargement.", 502);
    }
  }

  const stripe = getStripeConfig();
  if (!stripe) return jsonError("Stripe n’est pas configuré.", 503);
  let invoiceId = payment.stripe_invoice_id ?? null;
  try {
    if (!invoiceId && payment.stripe_checkout_session_id) {
      const session = await getStripeJson<{ invoice?: string | null }>(
        `/v1/checkout/sessions/${encodeURIComponent(payment.stripe_checkout_session_id)}`,
        stripe.secretKey
      );
      invoiceId = typeof session.invoice === "string" ? session.invoice : null;
      if (invoiceId) {
        await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${payment.id}`, {
          method: "PATCH",
          headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify({ stripe_invoice_id: invoiceId, updated_at: new Date().toISOString() }),
          cache: "no-store",
        });
      }
    }
    if (!invoiceId) return jsonError("La facture Stripe est encore en préparation.", 409);
    const invoice = await getStripeJson<{ invoice_pdf?: string | null }>(
      `/v1/invoices/${encodeURIComponent(invoiceId)}`,
      stripe.secretKey
    );
    if (!invoice.invoice_pdf) return jsonError("La facture Stripe est encore en préparation.", 409);
    return withSecurityHeaders(NextResponse.json({ url: invoice.invoice_pdf }));
  } catch (error) {
    console.error("Unable to resolve Stripe organizer invoice", error);
    return withSecurityHeaders(jsonError("Impossible de récupérer la facture Stripe.", 502));
  }
}

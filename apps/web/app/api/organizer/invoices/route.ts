import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import { loadOrganizerEditionPayments } from "../../../../lib/organizer-payments";
import { organizerInvoiceRowSchema } from "../../../../lib/organizer-manual-invoices";

const editionSchema = z.object({ id: z.string().uuid(), edition_year: z.number().int() });

export async function GET(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const eventId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("eventId"));
  if (!eventId.success) return jsonError("Identifiant d’événement invalide.", 400);
  const authorized = await requireEventOrganizer(auth.serviceConfig, auth.user, eventId.data);
  if (authorized !== true) return authorized.error;

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${eventId.data}&select=id,edition_year&order=edition_year.desc`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Impossible de charger les éditions.", 502);
  const editions = z.array(editionSchema).parse(await editionResponse.json());
  const editionIds = editions.map((edition) => edition.id);
  const [payments, manualResponse] = await Promise.all([
    loadOrganizerEditionPayments(auth.serviceConfig, editionIds),
    editionIds.length === 0 ? null : fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_invoices?edition_id=in.(${editionIds.join(",")})&select=id,edition_id,invoice_number,invoice_sequence,invoice_issued_at,invoice_type,replaces_invoice_id,document_status,tier,service_date,due_date,original_subtotal,discount_total,net_total,currency,legal_snapshot,invoice_storage_path,invoice_original_name,paid_at,payment_reference&order=invoice_issued_at.desc`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    ),
  ]);
  if (manualResponse && !manualResponse.ok) return jsonError("Impossible de charger les factures.", 502);
  const years = new Map(editions.map((edition) => [edition.id, edition.edition_year]));
  const legacyInvoices = editions.flatMap((edition) =>
    (payments[edition.id] ?? []).map((payment) => ({ ...payment, editionYear: years.get(edition.id), invoiceStatus: payment.status === "paid" ? "paid" : payment.status }))
  );
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const manualInvoices = manualResponse ? z.array(organizerInvoiceRowSchema).parse(await manualResponse.json()).map((invoice) => ({
    id: invoice.id,
    tier: invoice.tier,
    status: invoice.paid_at ? "paid" : "pending",
    paymentChannel: "bank_transfer" as const,
    amountSubtotal: invoice.net_total,
    amountTax: 0,
    amountTotal: invoice.net_total,
    currency: invoice.currency,
    paidAt: invoice.paid_at ?? null,
    hasInvoice: Boolean(invoice.invoice_storage_path),
    invoiceFileName: invoice.invoice_original_name ?? `${invoice.invoice_number}.pdf`,
    invoiceNumber: invoice.invoice_number,
    invoiceIssuedAt: invoice.invoice_issued_at,
    editionYear: years.get(invoice.edition_id),
    invoiceStatus: invoice.document_status === "replaced" ? "replaced" : invoice.net_total === 0 ? "no_payment_due" : invoice.paid_at ? "paid" : invoice.due_date < today ? "overdue" : "unpaid",
    dueDate: invoice.due_date,
    serviceDate: invoice.service_date,
    originalSubtotal: invoice.original_subtotal,
    discountTotal: invoice.discount_total,
    netTotal: invoice.net_total,
    replacesInvoiceId: invoice.replaces_invoice_id,
    giftedFeatures: (invoice.legal_snapshot.lines ?? []).filter((line) => Boolean(line.featureKey)).map((line) => line.description),
  })) : [];
  const invoices = [...manualInvoices, ...legacyInvoices].sort((left, right) => (right.invoiceIssuedAt ?? right.paidAt ?? "").localeCompare(left.invoiceIssuedAt ?? left.paidAt ?? ""));

  return withSecurityHeaders(NextResponse.json({ invoices }));
}

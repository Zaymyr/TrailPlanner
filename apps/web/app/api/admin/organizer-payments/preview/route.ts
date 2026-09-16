import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import {
  buildOrganizerInvoiceSnapshot,
  generateOrganizerInvoicePdf,
  organizerInvoiceCustomerSchema,
} from "../../../../../lib/organizer-invoice-document";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../lib/organizer";
import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR } from "../../../../../lib/organizer-modules";

const newPaymentRequestSchema = z.object({
  editionId: z.string().uuid(),
  tier: z.enum(["essential", "complete", "signature"]),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer: organizerInvoiceCustomerSchema,
});

const historicalPaymentRequestSchema = z.object({
  paymentId: z.string().uuid(),
  customer: organizerInvoiceCustomerSchema,
});

const requestSchema = z.union([newPaymentRequestSchema, historicalPaymentRequestSchema]);

const editionSchema = z.object({
  edition_year: z.number().int(),
  race_events: z.object({ name: z.string().min(1) }),
});

const historicalPaymentRowSchema = z.object({
  edition_id: z.string().uuid(),
  status: z.string(),
  payment_channel: z.string(),
  to_tier: z.string(),
  amount_subtotal: z.number().int().nullable(),
  amount_tax: z.number().int().nullable(),
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  paid_at: z.string().nullable(),
  invoice_storage_path: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  invoice_source: z.enum(["generated", "uploaded"]).nullable().optional(),
});

const historicalPaymentSchema = historicalPaymentRowSchema.extend({
  status: z.literal("paid"),
  payment_channel: z.literal("bank_transfer"),
  to_tier: z.enum(["essential", "complete", "signature"]),
  amount_subtotal: z.number().int().positive(),
  amount_tax: z.literal(0),
  amount_total: z.number().int().positive(),
  currency: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("eur")),
  paid_at: z.string().min(1),
});

const parisCalendarDate = (value: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Renseignez toutes les mentions obligatoires de la facture.", 400);

  let editionId: string;
  let tier: "essential" | "complete" | "signature";
  let paidDate: string;
  let subtotalCents: number;

  if ("paymentId" in body.data) {
    const paymentResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${body.data.paymentId}&select=edition_id,status,payment_channel,to_tier,amount_subtotal,amount_tax,amount_total,currency,paid_at,invoice_storage_path,invoice_number,invoice_source&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!paymentResponse.ok) return jsonError("Impossible de charger ce paiement.", 502);
    const payments = z.array(historicalPaymentRowSchema).safeParse(await paymentResponse.json());
    const paymentRow = payments.success ? payments.data[0] : null;
    if (!paymentRow) return jsonError("Paiement par virement introuvable.", 404);
    if (paymentRow.invoice_source || paymentRow.invoice_storage_path || paymentRow.invoice_number) {
      return jsonError("Ce paiement possède déjà une facture.", 409);
    }
    const eligiblePayment = historicalPaymentSchema.safeParse(paymentRow);
    if (!eligiblePayment.success) return jsonError("Ce paiement historique ne peut pas recevoir une facture automatique.", 409);
    const payment = eligiblePayment.data;
    if (payment.amount_total !== payment.amount_subtotal) {
      return jsonError("Ce paiement historique ne peut pas recevoir une facture automatique.", 409);
    }
    editionId = payment.edition_id;
    tier = payment.to_tier;
    paidDate = parisCalendarDate(payment.paid_at);
    subtotalCents = payment.amount_subtotal;
  } else {
    editionId = body.data.editionId;
    tier = body.data.tier;
    paidDate = body.data.paidDate;
    subtotalCents = ORGANIZER_TIER_PRICE_EUR[body.data.tier] * 100;
  }

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=edition_year,race_events(name)&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Impossible de charger l'édition.", 502);
  const editions = z.array(editionSchema).safeParse(await editionResponse.json());
  const edition = editions.success ? editions.data[0] : null;
  if (!edition) return jsonError("Édition introuvable.", 404);

  const snapshot = buildOrganizerInvoiceSnapshot({
    customer: body.data.customer,
    eventName: edition.race_events.name,
    editionYear: edition.edition_year,
    tierLabel: ORGANIZER_TIER_LABEL[tier],
    paidDate,
    subtotalCents,
  });
  const pdf = await generateOrganizerInvoicePdf({ snapshot, invoiceNumber: null, issuedAt: new Date() });
  return withSecurityHeaders(new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="projet-facture-pace-yourself.pdf"',
      "Cache-Control": "private, no-store",
    },
  }));
}

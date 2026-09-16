import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  buildOrganizerInvoiceSnapshot,
  generateOrganizerInvoicePdf,
  organizerInvoiceCustomerSchema,
  organizerInvoiceSnapshotSchema,
} from "../../../../../../lib/organizer-invoice-document";
import {
  buildOrganizerInvoicePath,
  deleteOrganizerInvoice,
  uploadOrganizerInvoice,
  validateOrganizerInvoice,
} from "../../../../../../lib/organizer-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../../lib/organizer";
import { ORGANIZER_TIER_LABEL } from "../../../../../../lib/organizer-modules";

const paymentSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  payment_channel: z.literal("bank_transfer"),
  invoice_storage_path: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  invoice_issued_at: z.string().nullable().optional(),
  invoice_source: z.enum(["generated", "uploaded"]).nullable().optional(),
  invoice_legal_snapshot: organizerInvoiceSnapshotSchema.nullable().optional(),
  status: z.string().optional(),
  to_tier: z.string().optional(),
  amount_subtotal: z.number().int().nullable().optional(),
  amount_tax: z.number().int().nullable().optional(),
  amount_total: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
});

const historicalPaymentSchema = paymentSchema.extend({
  status: z.literal("paid"),
  to_tier: z.enum(["essential", "complete", "signature"]),
  amount_subtotal: z.number().int().positive(),
  amount_tax: z.literal(0),
  amount_total: z.number().int().positive(),
  currency: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("eur")),
  paid_at: z.string().min(1),
});

const issuedPaymentSchema = paymentSchema.extend({
  invoice_number: z.string().min(1),
  invoice_issued_at: z.string().min(1),
  invoice_source: z.literal("generated"),
  invoice_legal_snapshot: organizerInvoiceSnapshotSchema,
});

const customerRequestSchema = z.object({ customer: organizerInvoiceCustomerSchema });

const editionSchema = z.object({
  edition_year: z.number().int(),
  race_events: z.object({ name: z.string().min(1) }),
});

const parisCalendarDate = (value: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

async function loadPayment(
  serviceConfig: { supabaseUrl: string; supabaseServiceRoleKey: string },
  paymentId: string
) {
  const paymentResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${paymentId}&select=id,edition_id,payment_channel,status,to_tier,amount_subtotal,amount_tax,amount_total,currency,paid_at,invoice_storage_path,invoice_number,invoice_issued_at,invoice_source,invoice_legal_snapshot&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!paymentResponse.ok) return { error: jsonError("Impossible de charger cet achat.", 502) } as const;
  const payment = z.array(paymentSchema).safeParse(await paymentResponse.json());
  return { payment: payment.success ? payment.data[0] ?? null : null } as const;
}

async function renderAndAttachGeneratedInvoice(input: {
  serviceConfig: { supabaseUrl: string; supabaseServiceRoleKey: string };
  adminId: string;
  payment: z.infer<typeof issuedPaymentSchema>;
}) {
  let nextPath: string | null = null;
  try {
    const pdf = await generateOrganizerInvoicePdf({
      snapshot: input.payment.invoice_legal_snapshot,
      invoiceNumber: input.payment.invoice_number,
      issuedAt: new Date(input.payment.invoice_issued_at),
    });
    nextPath = buildOrganizerInvoicePath(input.payment.edition_id, input.payment.id);
    const pdfBytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    await uploadOrganizerInvoice(input.serviceConfig, nextPath, pdfBytes);
    const invoiceName = `facture-${input.payment.invoice_number}.pdf`;
    const updateResponse = await fetch(`${input.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${input.payment.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(input.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({
        invoice_storage_path: nextPath,
        invoice_original_name: invoiceName,
        invoice_uploaded_at: new Date().toISOString(),
        invoice_uploaded_by: input.adminId,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!updateResponse.ok) throw new Error(await updateResponse.text());
    await deleteOrganizerInvoice(input.serviceConfig, input.payment.invoice_storage_path);
    return withSecurityHeaders(NextResponse.json({ payment: await updateResponse.json() }));
  } catch (error) {
    await deleteOrganizerInvoice(input.serviceConfig, nextPath);
    throw error;
  }
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
  const existingGenerated = issuedPaymentSchema.safeParse(current);
  if (existingGenerated.success) {
    try {
      return await renderAndAttachGeneratedInvoice({
        serviceConfig: auth.serviceConfig,
        adminId: auth.user.id,
        payment: existingGenerated.data,
      });
    } catch (error) {
      console.error("Unable to regenerate organizer invoice", error);
      return jsonError("Impossible de régénérer cette facture.", 502);
    }
  }
  if (current.invoice_source || current.invoice_storage_path || current.invoice_number) {
    return jsonError("Ce paiement possède déjà une facture.", 409);
  }

  const body = customerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Renseignez toutes les mentions obligatoires du client.", 400);
  const historicalPayment = historicalPaymentSchema.safeParse(current);
  if (!historicalPayment.success || historicalPayment.data.amount_total !== historicalPayment.data.amount_subtotal) {
    return jsonError("Ce paiement historique ne peut pas recevoir une facture automatique.", 409);
  }

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${historicalPayment.data.edition_id}&select=edition_year,race_events(name)&limit=1`,
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
    tierLabel: ORGANIZER_TIER_LABEL[historicalPayment.data.to_tier],
    paidDate: parisCalendarDate(historicalPayment.data.paid_at),
    subtotalCents: historicalPayment.data.amount_subtotal,
  });
  const issueResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/issue_admin_organizer_invoice`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify({
      p_payment_id: historicalPayment.data.id,
      p_admin_id: auth.user.id,
      p_invoice_legal_snapshot: snapshot,
    }),
    cache: "no-store",
  });
  if (!issueResponse.ok) {
    const detail = await issueResponse.text();
    console.error("Unable to issue historical organizer invoice", detail);
    if (/already has an issued invoice/i.test(detail)) return jsonError("Ce paiement possède déjà une facture.", 409);
    return jsonError("Impossible d'émettre cette facture.", 502);
  }
  const issuedPayment = issuedPaymentSchema.safeParse(await issueResponse.json());
  if (!issuedPayment.success) return jsonError("La facture a été numérotée mais sa réponse est invalide.", 502);

  try {
    return await renderAndAttachGeneratedInvoice({
      serviceConfig: auth.serviceConfig,
      adminId: auth.user.id,
      payment: issuedPayment.data,
    });
  } catch (error) {
    console.error("Unable to store historical organizer invoice", error);
    return withSecurityHeaders(NextResponse.json({
      warning: "La facture a été numérotée, mais le PDF doit être régénéré depuis la liste.",
    }, { status: 202 }));
  }
}

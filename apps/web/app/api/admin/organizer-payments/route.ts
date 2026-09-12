import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  buildOrganizerInvoicePath,
  deleteOrganizerInvoice,
  uploadOrganizerInvoice,
  validateOrganizerInvoice,
} from "../../../../lib/organizer-invoices";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";
import { ORGANIZER_TIER_PRICE_EUR } from "../../../../lib/organizer-modules";

const paidTierSchema = z.enum(["essential", "complete", "signature"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});
const ORGANIZER_VAT_RATE = 0.2;
const applyVatSchema = z.enum(["true", "false"]).default("true");

const currentParisDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("Formulaire d’achat invalide.", 400);

  const editionId = z.string().uuid().safeParse(formData.get("editionId"));
  const tier = paidTierSchema.safeParse(formData.get("tier"));
  const paidDate = dateSchema.safeParse(formData.get("paidDate"));
  const applyVat = applyVatSchema.safeParse(formData.get("applyVat") ?? undefined);
  const invoiceValue = formData.get("invoice");
  const invoice = invoiceValue instanceof File && invoiceValue.size > 0 ? invoiceValue : null;
  if (!editionId.success || !tier.success || !paidDate.success || !applyVat.success) {
    return jsonError("Renseignez un pack et une date de paiement valides.", 400);
  }
  if (paidDate.data > currentParisDate()) return jsonError("La date de paiement ne peut pas être future.", 400);
  const amountSubtotal = ORGANIZER_TIER_PRICE_EUR[tier.data] * 100;
  const amountTax = applyVat.data === "true" ? Math.round(amountSubtotal * ORGANIZER_VAT_RATE) : 0;

  let invoicePath: string | null = null;
  try {
    if (invoice) {
      const bytes = await validateOrganizerInvoice(invoice);
      invoicePath = buildOrganizerInvoicePath(editionId.data);
      await uploadOrganizerInvoice(auth.serviceConfig, invoicePath, bytes);
    }
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/record_admin_organizer_bank_transfer`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({
        p_edition_id: editionId.data,
        p_admin_id: auth.user.id,
        p_tier: tier.data,
        p_paid_at: `${paidDate.data}T00:00:00.000Z`,
        p_amount_subtotal: amountSubtotal,
        p_amount_tax: amountTax,
        p_invoice_storage_path: invoicePath,
        p_invoice_original_name: invoice?.name ?? null,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Unable to record organizer bank transfer", detail);
      await deleteOrganizerInvoice(auth.serviceConfig, invoicePath);
      if (/already active|cannot downgrade/i.test(detail)) return jsonError("Ce niveau est déjà actif ou inférieur au niveau actuel.", 409);
      return jsonError("Impossible d’enregistrer ce paiement par virement.", 502);
    }
    return withSecurityHeaders(NextResponse.json({ payment: await response.json() }, { status: 201 }));
  } catch (error) {
    await deleteOrganizerInvoice(auth.serviceConfig, invoicePath);
    return jsonError(error instanceof Error ? error.message : "Impossible d’enregistrer cet achat.", 400);
  }
}

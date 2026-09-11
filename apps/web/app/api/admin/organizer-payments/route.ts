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

const paidTierSchema = z.enum(["essential", "complete", "signature"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});
const POSTGRES_INTEGER_MAX = 2_147_483_647;

const parseMinorAmount = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [units, decimals = ""] = normalized.split(".");
  const amount = Number(units) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= POSTGRES_INTEGER_MAX ? amount : null;
};

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
  const amountSubtotal = parseMinorAmount(formData.get("amountSubtotal"));
  const amountTax = parseMinorAmount(formData.get("amountTax"));
  const invoiceValue = formData.get("invoice");
  const invoice = invoiceValue instanceof File && invoiceValue.size > 0 ? invoiceValue : null;
  if (
    !editionId.success || !tier.success || !paidDate.success || amountSubtotal === null || amountTax === null
    || amountSubtotal + amountTax > POSTGRES_INTEGER_MAX
  ) {
    return jsonError("Renseignez un pack, une date, un montant HT et une TVA valides.", 400);
  }
  if (paidDate.data > currentParisDate()) return jsonError("La date de paiement ne peut pas être future.", 400);

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
        p_paid_at: `${paidDate.data}T12:00:00.000Z`,
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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeOrganizerInvoice, normalizeOrganizerPayment } from "../../../../lib/admin-billing";
import { bankTransferFormData } from "./BankTransferDialog";
import { invoiceDownloadUrl, invoiceRegenerateUrl, settlementPaidAt } from "./BillingEntryDrawer";
import { editionBillingHref, summarizeEditionBilling } from "./EditionBillingSummary";

const read = (file: string) => readFileSync(resolve(process.cwd(), "app/admin/_components/billing", file), "utf8");
const EDITION = "11111111-1111-4111-8111-111111111111";

describe("billing dialogs moved from the Organisateurs tab", () => {
  it("keeps the manual invoice dialog and its rules", () => {
    const source = read("OrganizerInvoiceDialog.tsx");
    expect(source).toContain("Créer une facture");
    expect(source).toContain("Rectifier la facture");
    expect(source).toContain("Cette facture et son règlement ne modifient aucun droit d’accès");
    expect(source).toContain("Montant réellement facturé HT");
    expect(source).toContain("— OFFERT");
    expect(source).toContain("Émettre la rectificative");
    expect(source).toContain("/api/admin/organizer-invoices/preview");
    expect(source).toContain("replacesInvoiceId: correctedInvoiceId");
    expect(source).not.toContain("unit_price_cents");
  });

  it("keeps the historical bank-transfer invoice dialog", () => {
    const source = read("HistoricalInvoiceDialog.tsx");
    expect(source).toContain("Générer une facture");
    expect(source).toContain("Générer et rendre disponible");
    expect(source).toContain("Le paiement et les droits existants ne seront pas modifiés");
    expect(source).toContain("paymentId: target.paymentId");
  });

  it("gives POST /api/admin/organizer-payments a VAT-exempt screen", () => {
    const source = read("BankTransferDialog.tsx");
    expect(source).toContain("Enregistrer un virement");
    expect(source).toContain("Émettre la facture et enregistrer le virement");
    expect(source).toContain("TVA non applicable, art. 293 B du CGI");
    expect(source).toContain("Total à payer");
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR[candidate]");
    expect(source).toContain('"/api/admin/organizer-payments"');
    expect(source).not.toContain('form.set("applyVat"');
    expect(read("InvoiceCustomerFields.tsx")).toContain("SIREN (si l’organisation en possède un)");
  });

  it("sends the multipart fields the route reads", () => {
    const form = bankTransferFormData({
      editionId: EDITION,
      tier: "complete",
      paidDate: "2026-11-20",
      customer: { legalName: "Asso", billingAddress: "1 rue X", siren: "", vatNumber: "", purchaseOrderNumber: "BC-1" },
    });
    expect(Object.fromEntries(form.entries())).toEqual({
      editionId: EDITION,
      tier: "complete",
      paidDate: "2026-11-20",
      customerLegalName: "Asso",
      customerBillingAddress: "1 rue X",
      customerSiren: "",
      customerVatNumber: "",
      purchaseOrderNumber: "BC-1",
    });
    // No amount from the browser: the route derives it from the pack.
    expect([...form.keys()].some((key) => /amount|price|total/i.test(key))).toBe(false);
  });
});

describe("drawer actions", () => {
  const invoice = normalizeOrganizerInvoice({
    id: "inv-1", edition_id: EDITION, invoice_number: "PY-2026-000001", invoice_issued_at: "2026-11-01T10:00:00.000Z", invoice_type: "standard", document_status: "active",
    tier: "essential", service_date: "2026-11-01", due_date: "2026-12-01", original_subtotal: 19900, discount_total: 0, net_total: 19900, legal_snapshot: {}, invoice_storage_path: null, paid_at: null,
  }).entry;
  const payment = normalizeOrganizerPayment({
    id: "pay-1", edition_id: EDITION, created_at: "2026-11-01T10:00:00.000Z", purchase_kind: "essential_direct", to_tier: "essential", status: "paid", payment_channel: "stripe", stripe_checkout_session_id: "cs_1", paid_at: "2026-11-01T10:00:00.000Z",
  })!.entry;

  it("routes invoice downloads and regenerations to the existing routes", () => {
    expect(invoiceDownloadUrl(invoice)).toBe("/api/admin/organizer-invoices/inv-1/download");
    expect(invoiceRegenerateUrl(invoice)).toBe("/api/admin/organizer-invoices/inv-1/pdf");
    expect(invoiceDownloadUrl(payment)).toBe("/api/organizer/invoices/pay-1/download");
    expect(invoiceRegenerateUrl(payment)).toBe("/api/admin/organizer-payments/pay-1/invoice");
  });

  it("dates a settlement now for today and at noon UTC for a past day", () => {
    const now = new Date("2026-11-20T15:30:00.000Z");
    expect(settlementPaidAt("2026-11-20", "2026-11-20", now)).toBe("2026-11-20T15:30:00.000Z");
    expect(settlementPaidAt("2026-11-12", "2026-11-20", now)).toBe("2026-11-12T12:00:00.000Z");
  });
});

describe("edition billing summary in Organisateurs", () => {
  it("counts active invoices, unpaid and overdue ones, and paid payments", () => {
    expect(summarizeEditionBilling(
      [
        { document_status: "active", net_total: 19900, paid_at: null, due_date: "2026-11-01" },
        { document_status: "active", net_total: 34900, paid_at: null, due_date: "2026-12-31" },
        { document_status: "active", net_total: 0, paid_at: null, due_date: "2026-11-01" },
        { document_status: "replaced", net_total: 19900, paid_at: null, due_date: "2026-11-01" },
      ],
      [{ status: "paid", amount_total: 23880 }, { status: "refunded", amount_total: 23880 }],
      "2026-11-20",
    )).toEqual({ invoiceCount: 3, dueCount: 2, dueMinor: 54800, overdueCount: 1, paidCount: 1, paidMinor: 23880 });
  });

  it("links to the register filtered on the edition over its whole history", () => {
    expect(editionBillingHref(EDITION)).toBe(`/admin/billing?periode=tout&edition=${EDITION}`);
  });
});

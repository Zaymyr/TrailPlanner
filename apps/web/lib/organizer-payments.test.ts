import { describe, expect, it } from "vitest";

import {
  organizerPaymentRowSchema,
  selectEffectiveOrganizerPurchase,
  toOrganizerPurchaseSummary,
} from "./organizer-payments";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  edition_id: "22222222-2222-2222-2222-222222222222",
  purchase_kind: "direct",
  to_tier: "complete",
  status: "paid" as const,
  amount_subtotal: 10000,
  amount_tax: 2000,
  amount_total: 12000,
  currency: "eur",
  paid_at: "2026-09-10T12:00:00.000Z",
  created_at: "2026-09-10T12:00:00.000Z",
  stripe_checkout_session_id: null,
  stripe_invoice_id: null,
  invoice_storage_path: "edition/payment/invoice.pdf",
  invoice_original_name: "facture.pdf",
};

describe("organizer payment summaries", () => {
  it("keeps old rows compatible by defaulting their channel to Stripe", () => {
    expect(organizerPaymentRowSchema.parse(row).payment_channel).toBe("stripe");
  });

  it("returns only organizer-safe fields for a bank transfer", () => {
    const summary = toOrganizerPurchaseSummary(organizerPaymentRowSchema.parse({
      ...row,
      payment_channel: "bank_transfer",
    }));
    expect(summary).toMatchObject({
      tier: "complete",
      paymentChannel: "bank_transfer",
      amountTotal: 12000,
      hasInvoice: true,
      invoiceFileName: "facture.pdf",
    });
    expect(summary).not.toHaveProperty("invoice_storage_path");
    expect(summary).not.toHaveProperty("stripe_invoice_id");
  });

  it("selects the paid transaction that supplies the effective tier", () => {
    const refunded = toOrganizerPurchaseSummary(organizerPaymentRowSchema.parse({
      ...row,
      status: "refunded",
      to_tier: "signature",
      payment_channel: "stripe",
    }))!;
    const paid = toOrganizerPurchaseSummary(organizerPaymentRowSchema.parse({
      ...row,
      payment_channel: "bank_transfer",
    }))!;
    expect(selectEffectiveOrganizerPurchase([refunded, paid], "complete")).toBe(paid);
    expect(selectEffectiveOrganizerPurchase([paid], "signature")).toBeNull();
  });
});

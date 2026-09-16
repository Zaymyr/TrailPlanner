import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildOrganizerInvoiceSnapshot,
  generateOrganizerInvoicePdf,
  ORGANIZER_INVOICE_SELLER,
  organizerInvoiceCustomerSchema,
} from "./organizer-invoice-document";

describe("organizer invoice document", () => {
  it("normalizes the SIREN and freezes VAT-exempt legal facts", () => {
    const customer = organizerInvoiceCustomerSchema.parse({
      legalName: "Association des Crêtes",
      billingAddress: "1 rue du Trail\n69000 Lyon",
      siren: "123 456 789",
      vatNumber: "",
      purchaseOrderNumber: "BC-42",
    });
    const snapshot = buildOrganizerInvoiceSnapshot({
      customer,
      eventName: "Trail des Crêtes",
      editionYear: 2026,
      tierLabel: "Complet",
      paidDate: "2026-09-10",
      subtotalCents: 19900,
    });

    expect(snapshot.seller).toEqual(ORGANIZER_INVOICE_SELLER);
    expect(snapshot.customer.siren).toBe("123456789");
    expect(snapshot.amounts).toEqual({ subtotalCents: 19900, taxCents: 0, totalCents: 19900, currency: "EUR" });
    expect(snapshot.service.category).toBe("Prestations de services");
  });

  it("accepts an organization without a SIREN", () => {
    const customer = organizerInvoiceCustomerSchema.parse({
      legalName: "Association non immatriculée",
      billingAddress: "2 chemin des Sommets\n74000 Annecy",
      siren: "",
    });

    expect(customer.siren).toBeNull();
  });

  it("creates a one-page final PDF with stable invoice metadata", async () => {
    const snapshot = buildOrganizerInvoiceSnapshot({
      customer: organizerInvoiceCustomerSchema.parse({
        legalName: "Association des Crêtes",
        billingAddress: "1 rue du Trail\n69000 Lyon",
        siren: "",
      }),
      eventName: "Trail des Crêtes",
      editionYear: 2026,
      tierLabel: "Complet",
      paidDate: "2026-09-10",
      subtotalCents: 19900,
    });
    const bytes = await generateOrganizerInvoicePdf({
      snapshot,
      invoiceNumber: "PY-2026-000001",
      issuedAt: new Date("2026-09-15T08:00:00.000Z"),
    });
    const pdf = await PDFDocument.load(bytes);

    expect(bytes.slice(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Facture PY-2026-000001");
    expect(pdf.getAuthor()).toBe("Pace Yourself");
  });
});

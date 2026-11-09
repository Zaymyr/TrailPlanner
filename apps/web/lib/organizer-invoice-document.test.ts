import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildOrganizerInvoiceSnapshot,
  generateOrganizerInvoicePdf,
  ORGANIZER_INVOICE_SELLER,
  organizerInvoiceCustomerSchema,
  organizerInvoiceSnapshotSchema,
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

  it("renders an unpaid corrective invoice without valuing offered features", async () => {
    const snapshot = organizerInvoiceSnapshotSchema.parse({
      seller: ORGANIZER_INVOICE_SELLER,
      customer: organizerInvoiceCustomerSchema.parse({ legalName: "Club Trail", billingAddress: "1 rue des Cimes\n75001 Paris", siren: "" }),
      service: { description: "Pack Essentiel", category: "Prestations de services", serviceDate: "2026-11-09", dueDate: "2026-12-09" },
      amounts: { subtotalCents: 5000, taxCents: 0, totalCents: 5000, currency: "EUR" },
      lines: [
        { description: "Pack Essentiel", unitPriceCents: 9900, discountCents: 4900, netCents: 5000, offered: false },
        ...Array.from({ length: 14 }, (_, index) => ({ featureKey: `feature.${index + 1}`, description: `Option offerte ${index + 1}`, offered: true })),
      ],
      commercialTotals: { originalSubtotalCents: 9900, discountTotalCents: 4900, netTotalCents: 5000 },
      correction: { replacesInvoiceNumber: "PY-2026-000001", replacesIssuedAt: "2026-11-01T12:00:00Z" },
    });
    const bytes = await generateOrganizerInvoicePdf({ snapshot, invoiceNumber: "PY-2026-000002", issuedAt: new Date("2026-11-09T12:00:00Z") });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe("Facture PY-2026-000002");
  });

  it("keeps legacy valued gift snapshots readable", () => {
    const snapshot = organizerInvoiceSnapshotSchema.parse({
      seller: ORGANIZER_INVOICE_SELLER,
      customer: organizerInvoiceCustomerSchema.parse({ legalName: "Club Trail", billingAddress: "1 rue des Cimes\n75001 Paris", siren: "" }),
      service: { description: "Pack Essentiel", category: "Prestations de services", serviceDate: "2026-11-09", dueDate: "2026-12-09" },
      amounts: { subtotalCents: 9900, taxCents: 0, totalCents: 9900, currency: "EUR" },
      lines: [
        { description: "Pack Essentiel", unitPriceCents: 9900, discountCents: 0, netCents: 9900, offered: false },
        { featureKey: "module.services", description: "Services", unitPriceCents: 1250, discountCents: 1250, netCents: 0, offered: true },
      ],
      commercialTotals: { originalSubtotalCents: 11150, discountTotalCents: 1250, netTotalCents: 9900 },
    });

    expect(snapshot.lines?.[1]?.unitPriceCents).toBe(1250);
  });
});

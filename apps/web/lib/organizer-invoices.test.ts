import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOrganizerInvoiceDownloadUrl,
  MAX_ORGANIZER_INVOICE_SIZE,
  validateOrganizerInvoice,
} from "./organizer-invoices";

afterEach(() => vi.unstubAllGlobals());

describe("organizer invoice validation", () => {
  it("accepts a PDF MIME type with a PDF signature", async () => {
    const file = new File(["%PDF-1.7\ninvoice"], "facture.pdf", { type: "application/pdf" });
    const bytes = await validateOrganizerInvoice(file);
    expect(bytes.byteLength).toBe(file.size);
  });

  it("rejects a renamed non-PDF file", async () => {
    const file = new File(["plain text"], "facture.pdf", { type: "application/pdf" });
    await expect(validateOrganizerInvoice(file)).rejects.toThrow("PDF valide");
  });

  it("rejects a wrong MIME type and files above 10 MB", async () => {
    await expect(validateOrganizerInvoice(new File(["%PDF-"], "facture.txt", { type: "text/plain" })))
      .rejects.toThrow("doit être un PDF");
    const large = new File([new Uint8Array(MAX_ORGANIZER_INVOICE_SIZE + 1)], "facture.pdf", {
      type: "application/pdf",
    });
    await expect(validateOrganizerInvoice(large)).rejects.toThrow("10 Mo");
  });
});

describe("organizer invoice download URL", () => {
  it("keeps the Storage API prefix for a Supabase relative signed path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      signedURL: "/object/sign/organizer-invoices/edition/payment/invoice.pdf?token=secret",
    })));

    const url = await createOrganizerInvoiceDownloadUrl(
      { supabaseUrl: "https://project.supabase.co", supabaseServiceRoleKey: "service-key" },
      "edition/payment/invoice.pdf",
      "facture-PY-2026-000001.pdf"
    );

    expect(url).toBe("https://project.supabase.co/storage/v1/object/sign/organizer-invoices/edition/payment/invoice.pdf?token=secret&download=facture-PY-2026-000001.pdf");
  });

  it("does not duplicate an already rooted Storage API prefix", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      signedUrl: "/storage/v1/object/sign/organizer-invoices/edition/payment/invoice.pdf?token=secret",
    })));

    const url = await createOrganizerInvoiceDownloadUrl(
      { supabaseUrl: "https://project.supabase.co", supabaseServiceRoleKey: "service-key" },
      "edition/payment/invoice.pdf",
      "facture.pdf"
    );

    expect(url).toContain("/storage/v1/object/sign/organizer-invoices/");
    expect(url).not.toContain("/storage/v1/storage/v1/");
  });
});

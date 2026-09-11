import { describe, expect, it } from "vitest";

import { MAX_ORGANIZER_INVOICE_SIZE, validateOrganizerInvoice } from "./organizer-invoices";

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

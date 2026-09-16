import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ORGANIZER_INVOICE_SELLER } from "../../../../lib/organizer-invoice-document";
import { deleteOrganizerInvoice, uploadOrganizerInvoice } from "../../../../lib/organizer-invoices";
import { POST } from "./route";

const editionId = "11111111-1111-1111-1111-111111111111";
const paymentId = "22222222-2222-2222-2222-222222222222";

const requestWith = (values: Record<string, string> = {}) => {
  const data = new FormData();
  Object.entries({
    editionId,
    tier: "complete",
    paidDate: "2026-09-10",
    customerLegalName: "Association Trail Test",
    customerBillingAddress: "12 rue des Crêtes\n69000 Lyon",
    customerSiren: "123 456 789",
    customerVatNumber: "",
    purchaseOrderNumber: "BC-42",
    ...values,
  }).forEach(([key, value]) => data.set(key, value));
  return new NextRequest("http://localhost/api/admin/organizer-payments", {
    method: "POST",
    headers: { authorization: "Bearer admin-token" },
    body: data,
  });
};

const issuedSnapshot = {
  seller: ORGANIZER_INVOICE_SELLER,
  customer: {
    legalName: "Association Trail Test",
    billingAddress: "12 rue des Crêtes\n69000 Lyon",
    siren: "123456789",
    vatNumber: null,
    purchaseOrderNumber: "BC-42",
  },
  service: {
    description: "Pack Complet Pace Yourself - Trail Test, édition 2026",
    category: "Prestations de services",
    serviceDate: "2026-09-10",
  },
  amounts: { subtotalCents: 19900, taxCents: 0, totalCents: 19900, currency: "EUR" },
  payment: { channel: "Virement bancaire", paidDate: "2026-09-10" },
};

describe("POST /api/admin/organizer-payments", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("records the VAT-exempt payment, allocates a number, renders and attaches the PDF", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ edition_year: 2026, race_events: { name: "Trail Test" } }]))
      .mockResolvedValueOnce(Response.json({
        id: paymentId,
        edition_id: editionId,
        invoice_number: "PY-2026-000001",
        invoice_issued_at: "2026-09-15T08:00:00.000Z",
        invoice_legal_snapshot: issuedSnapshot,
      }))
      .mockResolvedValueOnce(Response.json([{ id: paymentId, invoice_storage_path: "edition/payment/invoice.pdf" }]));

    const response = await POST(requestWith());

    expect(response.status).toBe(201);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toMatchObject({
      p_amount_subtotal: 19900,
      p_invoice_legal_snapshot: { customer: { siren: "123456789" } },
    });
    expect(uploadOrganizerInvoice).toHaveBeenCalledOnce();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toMatchObject({
      invoice_original_name: "facture-PY-2026-000001.pdf",
    });
  });

  it("rejects incomplete legal customer details before writing", async () => {
    const response = await POST(requestWith({ customerSiren: "123" }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects future payment dates before writing", async () => {
    const response = await POST(requestWith({ paidDate: "2099-01-01" }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes the generated object if attaching its ledger reference fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ edition_year: 2026, race_events: { name: "Trail Test" } }]))
      .mockResolvedValueOnce(Response.json({
        id: paymentId,
        edition_id: editionId,
        invoice_number: "PY-2026-000001",
        invoice_issued_at: "2026-09-15T08:00:00.000Z",
        invoice_legal_snapshot: issuedSnapshot,
      }))
      .mockResolvedValueOnce(new Response("failure", { status: 500 }));

    const response = await POST(requestWith());
    expect(response.status).toBe(202);
    expect(deleteOrganizerInvoice).toHaveBeenCalledWith(expect.anything(), "edition/payment/invoice.pdf");
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000099" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));
vi.mock("../../../../lib/organizer-invoices", () => ({
  buildOrganizerInvoicePath: () => "edition/payment/invoice.pdf",
  deleteOrganizerInvoice: vi.fn(() => Promise.resolve()),
  uploadOrganizerInvoice: vi.fn(() => Promise.resolve()),
}));

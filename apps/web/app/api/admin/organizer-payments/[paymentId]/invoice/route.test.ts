import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteOrganizerInvoice, uploadOrganizerInvoice } from "../../../../../../lib/organizer-invoices";
import { POST, PUT } from "./route";

const paymentId = "11111111-1111-1111-1111-111111111111";
const editionId = "22222222-2222-2222-2222-222222222222";
const generatedSnapshot = {
  seller: {
    legalName: "Faustin Bertrand", tradingName: "Pace Yourself", legalForm: "Entrepreneur individuel - micro-entreprise",
    address: "10 avenue Félix Faure\n69580 Sathonay-Camp, France", siren: "109 903 757", siret: "109 903 757 00010",
    registration: "RCS Lyon n° 109 903 757", email: "faustin@pace-yourself.com", vatStatement: "TVA non applicable, art. 293 B du CGI",
  },
  customer: { legalName: "Trail Test", billingAddress: "1 rue du Trail", siren: "123456789", vatNumber: null, purchaseOrderNumber: null },
  service: { description: "Pack Essentiel", category: "Prestations de services", serviceDate: "2026-09-10" },
  amounts: { subtotalCents: 9900, taxCents: 0, totalCents: 9900, currency: "EUR" },
  payment: { channel: "Virement bancaire", paidDate: "2026-09-10" },
};

const createRequest = () => {
  const data = new FormData();
  data.set("invoice", new File(["%PDF-1.7"], "nouvelle.pdf", { type: "application/pdf" }));
  return new NextRequest(`http://localhost/api/admin/organizer-payments/${paymentId}/invoice`, {
    method: "PUT",
    headers: { authorization: "Bearer admin-token" },
    body: data,
  });
};

describe("PUT /api/admin/organizer-payments/[paymentId]/invoice", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("updates the ledger before removing the old private object", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{
        id: paymentId,
        edition_id: editionId,
        payment_channel: "bank_transfer",
        invoice_storage_path: "old/invoice.pdf",
      }]))
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]));

    const response = await PUT(createRequest(), { params: { paymentId } });
    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toMatchObject({
      invoice_original_name: "nouvelle.pdf",
      invoice_storage_path: "edition/payment/new.pdf",
    });
    expect(deleteOrganizerInvoice).toHaveBeenCalledWith(expect.anything(), "old/invoice.pdf");
  });

  it("does not attach a manual PDF to a Stripe transaction", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{
      id: paymentId,
      edition_id: editionId,
      payment_channel: "stripe",
      invoice_storage_path: null,
    }]));
    const response = await PUT(createRequest(), { params: { paymentId } });
    expect(response.status).toBe(404);
  });

  it("rejects manual replacement of an issued generated invoice", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{
      id: paymentId,
      edition_id: editionId,
      payment_channel: "bank_transfer",
      invoice_storage_path: "issued/invoice.pdf",
      invoice_number: "PY-2026-000001",
      invoice_source: "generated",
    }]));

    const response = await PUT(createRequest(), { params: { paymentId } });

    expect(response.status).toBe(409);
    expect(uploadOrganizerInvoice).not.toHaveBeenCalled();
  });

  it("issues and stores an invoice for an older paid bank transfer", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{
        id: paymentId,
        edition_id: editionId,
        payment_channel: "bank_transfer",
        status: "paid",
        to_tier: "essential",
        amount_subtotal: 9900,
        amount_tax: 0,
        amount_total: 9900,
        currency: "eur",
        paid_at: "2026-09-11T00:00:00.000Z",
        invoice_storage_path: null,
        invoice_number: null,
        invoice_source: null,
      }]))
      .mockResolvedValueOnce(Response.json([{ edition_year: 2026, race_events: { name: "Trail Mon Château" } }]))
      .mockResolvedValueOnce(Response.json({
        id: paymentId,
        edition_id: editionId,
        payment_channel: "bank_transfer",
        invoice_storage_path: null,
        invoice_number: "PY-2026-000002",
        invoice_issued_at: "2026-09-16T08:00:00.000Z",
        invoice_source: "generated",
        invoice_legal_snapshot: generatedSnapshot,
      }))
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]));

    const response = await POST(new NextRequest(`http://localhost/api/admin/organizer-payments/${paymentId}/invoice`, {
      method: "POST",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({ customer: generatedSnapshot.customer }),
    }), { params: { paymentId } });

    expect(response.status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("/rpc/issue_admin_organizer_invoice");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toMatchObject({
      p_payment_id: paymentId,
      p_invoice_legal_snapshot: {
        customer: { legalName: "Trail Test" },
        amounts: { subtotalCents: 9900, taxCents: 0, totalCents: 9900 },
      },
    });
    expect(uploadOrganizerInvoice).toHaveBeenCalledOnce();
  });

  it("regenerates a missing automatic PDF from its immutable snapshot", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{
        id: paymentId,
        edition_id: editionId,
        payment_channel: "bank_transfer",
        invoice_storage_path: null,
        invoice_number: "PY-2026-000001",
        invoice_issued_at: "2026-09-15T08:00:00.000Z",
        invoice_source: "generated",
        invoice_legal_snapshot: generatedSnapshot,
      }]))
      .mockResolvedValueOnce(Response.json([{ id: paymentId }]));

    const response = await POST(new NextRequest(`http://localhost/api/admin/organizer-payments/${paymentId}/invoice`, {
      method: "POST",
      headers: { authorization: "Bearer admin-token" },
    }), { params: { paymentId } });

    expect(response.status).toBe(200);
    expect(uploadOrganizerInvoice).toHaveBeenCalledOnce();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toMatchObject({
      invoice_original_name: "facture-PY-2026-000001.pdf",
    });
  });
});

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000099" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));
vi.mock("../../../../../../lib/organizer-invoices", () => ({
  buildOrganizerInvoicePath: () => "edition/payment/new.pdf",
  deleteOrganizerInvoice: vi.fn(() => Promise.resolve()),
  uploadOrganizerInvoice: vi.fn(() => Promise.resolve()),
  validateOrganizerInvoice: vi.fn((file: File) => file.arrayBuffer()),
}));

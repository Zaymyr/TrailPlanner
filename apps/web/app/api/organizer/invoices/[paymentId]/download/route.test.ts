import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOrganizerInvoiceDownloadUrl } from "../../../../../../lib/organizer-invoices";
import { renderAndStoreManualOrganizerInvoice } from "../../../../../../lib/organizer-manual-invoices";
import { getStripeJson } from "../../../../../../lib/stripe";
import { GET } from "./route";

const paymentId = "11111111-1111-1111-1111-111111111111";
const eventId = "22222222-2222-2222-2222-222222222222";
const authState = vi.hoisted(() => ({ allowed: true }));

const request = () => new NextRequest(`http://localhost/api/organizer/invoices/${paymentId}/download`, {
  headers: { authorization: "Bearer organizer-token" },
});

const payment = (overrides: Record<string, unknown>) => ({
  id: paymentId,
  payment_channel: "bank_transfer",
  status: "paid",
  stripe_checkout_session_id: null,
  stripe_invoice_id: null,
  invoice_storage_path: "edition/payment/invoice.pdf",
  invoice_original_name: "facture.pdf",
  race_event_editions: { event_id: eventId },
  ...overrides,
});

const manualInvoice = {
  id: paymentId,
  edition_id: "33333333-3333-4333-8333-333333333333",
  invoice_number: "PY-2026-000003",
  invoice_sequence: 3,
  invoice_issued_at: "2026-11-09T19:30:00Z",
  invoice_type: "corrective",
  replaces_invoice_id: "44444444-4444-4444-8444-444444444444",
  document_status: "active",
  tier: "essential",
  service_date: "2026-11-09",
  due_date: "2026-12-09",
  original_subtotal: 9900,
  discount_total: 0,
  net_total: 9900,
  currency: "EUR",
  legal_snapshot: {
    seller: {
      legalName: "Faustin Bertrand",
      tradingName: "Pace Yourself",
      legalForm: "Entrepreneur individuel",
      address: "10 avenue Félix Faure\n69580 Sathonay-Camp, France",
      siren: "109 903 757",
      siret: "109 903 757 00010",
      registration: "RCS Lyon",
      email: "support@example.com",
      vatStatement: "TVA non applicable",
    },
    customer: { legalName: "Club Trail", billingAddress: "1 rue du Trail\n75001 Paris", siren: null },
    service: { description: "Pack Essentiel", category: "Prestations de services", serviceDate: "2026-11-09", dueDate: "2026-12-09" },
    amounts: { subtotalCents: 9900, taxCents: 0, totalCents: 9900, currency: "EUR" },
    lines: [
      { description: "Pack Essentiel", unitPriceCents: 9900, discountCents: 0, netCents: 9900, offered: false },
      { featureKey: "module.services", description: "Services & alentours", offered: true },
    ],
    commercialTotals: { originalSubtotalCents: 9900, discountTotalCents: 0, netTotalCents: 9900 },
  },
  invoice_storage_path: null,
  invoice_original_name: null,
  paid_at: null,
  payment_reference: null,
  race_event_editions: { event_id: eventId },
};

describe("GET /api/organizer/invoices/[paymentId]/download", () => {
  beforeEach(() => {
    authState.allowed = true;
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns a short private signed URL for an event member", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json([payment({})]));
    const response = await GET(request(), { params: { paymentId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://signed.example/facture.pdf" });
    expect(createOrganizerInvoiceDownloadUrl).toHaveBeenCalledWith(
      expect.anything(), "edition/payment/invoice.pdf", "facture.pdf"
    );
  });

  it("generates and stores a missing independent invoice PDF on first download", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([manualInvoice]));
    vi.mocked(renderAndStoreManualOrganizerInvoice).mockResolvedValueOnce({
      ...manualInvoice,
      invoice_storage_path: "edition/invoice/generated.pdf",
      invoice_original_name: "PY-2026-000003.pdf",
    });

    const response = await GET(request(), { params: { paymentId } });

    expect(response.status).toBe(200);
    expect(renderAndStoreManualOrganizerInvoice).toHaveBeenCalledOnce();
    expect(createOrganizerInvoiceDownloadUrl).toHaveBeenCalledWith(
      expect.anything(), "edition/invoice/generated.pdf", "PY-2026-000003.pdf"
    );
  });

  it("denies a revoked or unrelated member before signing", async () => {
    authState.allowed = false;
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json([payment({})]));
    const response = await GET(request(), { params: { paymentId } });
    expect(response.status).toBe(403);
    expect(createOrganizerInvoiceDownloadUrl).not.toHaveBeenCalled();
  });

  it("resolves and persists a legacy Stripe invoice on first download", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([payment({
        payment_channel: "stripe",
        stripe_checkout_session_id: "cs_old",
        invoice_storage_path: null,
        invoice_original_name: null,
      })]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.mocked(getStripeJson)
      .mockResolvedValueOnce({ invoice: "in_resolved" })
      .mockResolvedValueOnce({ invoice_pdf: "https://stripe.example/invoice.pdf" });

    const response = await GET(request(), { params: { paymentId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://stripe.example/invoice.pdf" });
    expect(getStripeJson).toHaveBeenNthCalledWith(1, "/v1/checkout/sessions/cs_old", "sk_test");
    expect(getStripeJson).toHaveBeenNthCalledWith(2, "/v1/invoices/in_resolved", "sk_test");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toMatchObject({
      stripe_invoice_id: "in_resolved",
    });
  });

  it("reports a Stripe invoice that is still being prepared", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json([payment({
      payment_channel: "stripe",
      stripe_checkout_session_id: "cs_pending",
      invoice_storage_path: null,
      invoice_original_name: null,
    })]));
    vi.mocked(getStripeJson).mockResolvedValueOnce({ invoice: null });
    const response = await GET(request(), { params: { paymentId } });
    expect(response.status).toBe(409);
  });
});

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  requireEventOrganizer: () => Promise.resolve(authState.allowed
    ? true
    : { error: Response.json({ message: "Interdit" }, { status: 403 }) }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));
vi.mock("../../../../../../lib/organizer-invoices", () => ({
  createOrganizerInvoiceDownloadUrl: vi.fn(() => Promise.resolve("https://signed.example/facture.pdf")),
}));
vi.mock("../../../../../../lib/organizer-manual-invoices", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../../../../lib/organizer-manual-invoices")>(),
  renderAndStoreManualOrganizerInvoice: vi.fn(),
}));
vi.mock("../../../../../../lib/stripe", () => ({
  getStripeConfig: () => ({ secretKey: "sk_test" }),
  getStripeJson: vi.fn(),
}));

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";
const editionId = "22222222-2222-2222-2222-222222222222";
const paymentId = "33333333-3333-3333-3333-333333333333";
const authState = vi.hoisted(() => ({ allowed: true }));

describe("GET /api/organizer/invoices", () => {
  beforeEach(() => {
    authState.allowed = true;
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns event-scoped history without provider ids or private paths", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, edition_year: 2026 }]))
      .mockResolvedValueOnce(Response.json([{
        id: paymentId,
        edition_id: editionId,
        purchase_kind: "complete_direct",
        to_tier: "complete",
        status: "paid",
        payment_channel: "bank_transfer",
        amount_subtotal: 10000,
        amount_tax: 2000,
        amount_total: 12000,
        currency: "eur",
        paid_at: "2026-09-10T12:00:00.000Z",
        created_at: "2026-09-10T12:00:00.000Z",
        stripe_checkout_session_id: null,
        stripe_invoice_id: null,
        invoice_storage_path: "private/invoice.pdf",
        invoice_original_name: "facture.pdf",
      }]));

    const response = await GET(new NextRequest(`http://localhost/api/organizer/invoices?eventId=${eventId}`, {
      headers: { authorization: "Bearer organizer-token" },
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.invoices[0]).toMatchObject({ id: paymentId, editionYear: 2026, hasInvoice: true });
    expect(payload.invoices[0]).not.toHaveProperty("stripe_checkout_session_id");
    expect(payload.invoices[0]).not.toHaveProperty("invoice_storage_path");
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(`event_id=eq.${eventId}`);
  });

  it("does not query invoice history after membership revocation", async () => {
    authState.allowed = false;
    const response = await GET(new NextRequest(`http://localhost/api/organizer/invoices?eventId=${eventId}`));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  requireEventOrganizer: () => Promise.resolve(authState.allowed
    ? true
    : { error: Response.json({ message: "Interdit" }, { status: 403 }) }),
  serviceHeaders: () => ({}),
}));

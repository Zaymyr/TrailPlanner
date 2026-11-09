import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const invoiceId = "22222222-2222-4222-8222-222222222222";
const request = () => new NextRequest(`http://localhost/api/admin/organizer-invoices/${invoiceId}/settlement`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer admin" },
  body: JSON.stringify({ paidAt: "2026-11-09T12:00:00.000Z", paymentReference: "VIR-42" }),
});

describe("POST /api/admin/organizer-invoices/[invoiceId]/settlement", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: invoiceId, paid_at: "2026-11-09T12:00:00.000Z" }))));
  afterEach(() => vi.restoreAllMocks());

  it("records a complete settlement through the service-only RPC", async () => {
    const response = await POST(request(), { params: { invoiceId } });
    const call = vi.mocked(fetch).mock.calls[0];

    expect(response.status).toBe(200);
    expect(call?.[0]).toBe("https://supabase.test/rest/v1/rpc/settle_admin_organizer_invoice");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      p_invoice_id: invoiceId,
      p_admin_id: "99999999-9999-4999-8999-999999999999",
      p_paid_at: "2026-11-09T12:00:00.000Z",
      p_payment_reference: "VIR-42",
    });
  });

  it("rejects an invalid invoice id before any database call", async () => {
    const response = await POST(request(), { params: { invoiceId: "invalid" } });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({ user: { id: "99999999-9999-4999-8999-999999999999" }, serviceConfig: { supabaseUrl: "https://supabase.test", supabaseServiceRoleKey: "key" } }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));
vi.mock("../../../../../../lib/organizer-manual-invoices", () => ({ organizerInvoiceRowSchema: { parse: (value: unknown) => value } }));

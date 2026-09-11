import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteOrganizerInvoice, uploadOrganizerInvoice } from "../../../../lib/organizer-invoices";
import { POST } from "./route";

const editionId = "11111111-1111-1111-1111-111111111111";

const requestWith = (values: Record<string, string | File>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return new NextRequest("http://localhost/api/admin/organizer-payments", {
    method: "POST",
    headers: { authorization: "Bearer admin-token" },
    body: data,
  });
};

describe("POST /api/admin/organizer-payments", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("records EUR minor amounts through the atomic service RPC", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ id: "22222222-2222-2222-2222-222222222222" }));
    const response = await POST(requestWith({
      editionId,
      tier: "complete",
      paidDate: "2026-09-10",
      amountSubtotal: "99,50",
      amountTax: "19.90",
    }));

    expect(response.status).toBe(201);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/record_admin_organizer_bank_transfer");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_edition_id: editionId,
      p_tier: "complete",
      p_amount_subtotal: 9950,
      p_amount_tax: 1990,
    });
  });

  it("rejects future dates before writing", async () => {
    const response = await POST(requestWith({
      editionId,
      tier: "essential",
      paidDate: "2099-01-01",
      amountSubtotal: "99",
      amountTax: "0",
    }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects impossible dates and totals outside PostgreSQL integer range", async () => {
    const invalidDate = await POST(requestWith({
      editionId,
      tier: "essential",
      paidDate: "2026-02-31",
      amountSubtotal: "99",
      amountTax: "0",
    }));
    const oversized = await POST(requestWith({
      editionId,
      tier: "essential",
      paidDate: "2026-09-10",
      amountSubtotal: "21474836.47",
      amountTax: "0.01",
    }));
    expect(invalidDate.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes an uploaded invoice when the atomic RPC fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("already active", { status: 409 }));
    const response = await POST(requestWith({
      editionId,
      tier: "complete",
      paidDate: "2026-09-10",
      amountSubtotal: "100",
      amountTax: "20",
      invoice: new File(["%PDF-1.7"], "facture.pdf", { type: "application/pdf" }),
    }));
    expect(response.status).toBe(409);
    expect(uploadOrganizerInvoice).toHaveBeenCalledOnce();
    expect(deleteOrganizerInvoice).toHaveBeenCalledOnce();
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
  validateOrganizerInvoice: vi.fn((file: File) => file.arrayBuffer()),
}));

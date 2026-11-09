import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const editionId = "11111111-1111-4111-8111-111111111111";

const request = () => new NextRequest("http://localhost/api/admin/organizer-invoices/preview", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer admin" },
  body: JSON.stringify({
    editionId,
    tier: "essential",
    packNetCents: 5000,
    giftedFeatures: ["module.services"],
    serviceDate: "2026-11-09",
    dueDate: "2026-12-09",
    customer: { legalName: "Club Test", billingAddress: "1 rue du Trail\n75001 Paris", siren: "" },
  }),
});

describe("POST /api/admin/organizer-invoices/preview", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ edition_year: 2026, race_events: { name: "Trail Test" } }]))));
  afterEach(() => vi.restoreAllMocks());

  it("returns a PDF preview without issuing or settling an invoice", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.method).toBeUndefined();
  });
});

vi.mock("../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({ user: { id: "99999999-9999-4999-8999-999999999999" }, serviceConfig: { supabaseUrl: "https://supabase.test", supabaseServiceRoleKey: "key" } }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));
vi.mock("../../../../../lib/organizer-manual-invoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../lib/organizer-manual-invoices")>();
  return {
    ...actual,
    buildManualOrganizerInvoice: vi.fn().mockResolvedValue({
      lines: [{ description: "Pack Essentiel", unitPriceCents: 9900, discountCents: 4900, netCents: 5000, offered: false }],
      totals: { originalSubtotal: 11150, discountTotal: 6150, netTotal: 5000 },
    }),
  };
});

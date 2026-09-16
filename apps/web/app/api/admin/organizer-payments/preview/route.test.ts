import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const request = (siren = "123 456 789") => new NextRequest("http://localhost/api/admin/organizer-payments/preview", {
  method: "POST",
  headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
  body: JSON.stringify({
    editionId: "11111111-1111-1111-1111-111111111111",
    tier: "complete",
    paidDate: "2026-09-10",
    customer: {
      legalName: "Association Trail Test",
      billingAddress: "12 rue des Crêtes\n69000 Lyon",
      siren,
      vatNumber: "",
      purchaseOrderNumber: "BC-42",
    },
  }),
});

describe("POST /api/admin/organizer-payments/preview", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("returns an inline, non-cacheable PDF preview", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ edition_year: 2026, race_events: { name: "Trail Test" } }]));
    const response = await POST(request());
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new TextDecoder("ascii").decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("rejects an invalid client SIREN before querying the edition", async () => {
    const response = await POST(request("123"));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000099" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));

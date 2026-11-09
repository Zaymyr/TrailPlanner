import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

const catalogRow = {
  feature_key: "module.services",
  label: "Services & alentours",
  minimum_tier: "complete",
  is_active: true,
  sort_order: 10,
};

describe("organizer feature catalog admin API", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("returns availability without standalone prices", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([catalogRow]));
    const response = await GET(new NextRequest("http://localhost/api/admin/organizer-feature-catalog", {
      headers: { authorization: "Bearer admin" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ features: [catalogRow] });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).not.toContain("unit_price_cents");
  });

  it("updates availability without accepting or forwarding a price", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...catalogRow, is_active: false }));
    const response = await PATCH(new NextRequest("http://localhost/api/admin/organizer-feature-catalog", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer admin" },
      body: JSON.stringify({ featureKey: "module.services", isActive: false }),
    }));

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      p_admin_id: "99999999-9999-4999-8999-999999999999",
      p_feature_key: "module.services",
      p_is_active: false,
    });
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({
    user: { id: "99999999-9999-4999-8999-999999999999" },
    serviceConfig: { supabaseUrl: "https://supabase.test", supabaseServiceRoleKey: "key" },
  }),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));

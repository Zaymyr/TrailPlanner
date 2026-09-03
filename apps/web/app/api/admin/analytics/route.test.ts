import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/admin/analytics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the aggregate RPC with a bounded reporting period", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      totals: { popupOpens: 200, clicks: 30, uniquePopupSessions: 150, uniqueClickSessions: 25, ctr: 15 },
      productStats: [],
      recentEvents: [],
    })));

    const response = await GET(new NextRequest(
      "http://localhost/api/admin/analytics?range=custom&start=2026-08-01&end=2026-08-31",
      { headers: { authorization: "Bearer admin-token" } }
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.totals).toMatchObject({ popupOpens: 200, clicks: 30, ctr: 15 });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("rpc/get_admin_affiliate_metrics");
    expect(JSON.parse(String(init?.body))).toEqual({
      p_start_date: "2026-08-01",
      p_end_date: "2026-09-01",
      p_timezone: "Europe/Paris",
    });
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () => Promise.resolve({ id: "admin", appMetadata: { role: "admin" } }),
  isAdminUser: () => true,
}));

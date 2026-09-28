import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

const rows = [
  {
    partner_key: "booking",
    standard_url: "https://www.booking.com/",
    affiliate_url: null,
    affiliate_enabled: false,
    is_enabled: true,
    updated_at: "2026-09-28T10:00:00.000Z",
  },
  {
    partner_key: "decathlon",
    standard_url: "https://www.decathlon.fr/",
    affiliate_url: null,
    affiliate_enabled: false,
    is_enabled: true,
    updated_at: "2026-09-28T10:00:00.000Z",
  },
];

describe("/api/admin/partner-links", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(rows)));
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads the two service-managed partner configurations", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/partner-links", {
      headers: { authorization: "Bearer admin-token" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.settings.map((setting: { partnerKey: string }) => setting.partnerKey)).toEqual(["booking", "decathlon"]);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("partner_link_settings");
  });

  it("upserts both settings atomically with the trusted admin id", async () => {
    const response = await PUT(new NextRequest("http://localhost/api/admin/partner-links", {
      method: "PUT",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        settings: [
          { partnerKey: "booking", standardUrl: "https://www.booking.com/", affiliateUrl: "", affiliateEnabled: false, isEnabled: true },
          { partnerKey: "decathlon", standardUrl: "https://www.decathlon.fr/", affiliateUrl: "https://track.example/decathlon", affiliateEnabled: true, isEnabled: true },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call?.[0])).toContain("on_conflict=partner_key");
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.headers).toMatchObject({ Prefer: "resolution=merge-duplicates,return=representation" });
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ partner_key: "booking", affiliate_url: null, updated_by: "99999999-9999-9999-9999-999999999999" });
  });

  it("rejects affiliate mode without an affiliate URL", async () => {
    const response = await PUT(new NextRequest("http://localhost/api/admin/partner-links", {
      method: "PUT",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        settings: [
          { partnerKey: "booking", standardUrl: "https://www.booking.com/", affiliateUrl: null, affiliateEnabled: true, isEnabled: true },
          { partnerKey: "decathlon", standardUrl: "https://www.decathlon.fr/", affiliateUrl: null, affiliateEnabled: false, isEnabled: true },
        ],
      }),
    }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () => Promise.resolve({ id: "99999999-9999-9999-9999-999999999999", appMetadata: { role: "admin" } }),
  isAdminUser: () => true,
}));

import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://db.example.com",
    supabaseServiceRoleKey: "service",
  }),
}));

vi.mock("../../../lib/organizer", () => ({
  serviceHeaders: () => ({}),
}));

describe("GET /api/partner-links", () => {
  it("returns only enabled resolved destinations", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([
      {
        partner_key: "booking",
        standard_url: "https://www.booking.com/",
        affiliate_url: "https://affiliate.example/booking",
        affiliate_enabled: true,
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
    ]), { status: 200 }));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      links: [
        { partnerKey: "booking", url: "https://affiliate.example/booking", isAffiliate: true },
        { partnerKey: "decathlon", url: "https://www.decathlon.fr/", isAffiliate: false },
      ],
    });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("is_enabled=eq.true");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("max-age=300");
  });

  it("does not expose configuration when the database read fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("nope", { status: 500 }));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "Unable to load partner links." });
  });
});

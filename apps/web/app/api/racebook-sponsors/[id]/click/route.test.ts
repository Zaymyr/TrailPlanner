import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ checkRateLimitAsync: vi.fn() }));

vi.mock("../../../../../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/http")>("../../../../../lib/http");
  return { ...actual, checkRateLimitAsync: mocks.checkRateLimitAsync };
});
vi.mock("../../../../../lib/organizer", () => ({ serviceHeaders: () => ({}) }));
vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));

const sponsorId = "44444444-4444-4444-8444-444444444444";
const raceId = "11111111-1111-4111-8111-111111111111";
const editionId = "33333333-3333-4333-8333-333333333333";

afterEach(() => vi.restoreAllMocks());

describe("GET /api/racebook-sponsors/[id]/click", () => {
  it("counts an allowed click and redirects", async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true });
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ website_url: "https://example.com/sponsor", edition_id: editionId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: raceId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("https://example.com/sponsor"), { status: 200 }));

    const response = await GET(
      new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`, { headers: { "x-forwarded-for": "192.0.2.1" } }),
      { params: { id: sponsorId } },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/sponsor");
    expect(fetchMock.mock.calls[2]?.[0]).toContain("increment_racebook_sponsor_click");
  });

  it("still redirects when the network identifier is rate limited", async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false });
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ website_url: "https://example.com/sponsor", edition_id: editionId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: raceId }]), { status: 200 }));

    const response = await GET(
      new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`),
      { params: { id: sponsorId } },
    );
    expect(response.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still redirects when click rate-limit storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.checkRateLimitAsync.mockRejectedValue(new Error("rate store unavailable"));
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ website_url: "https://example.com/sponsor", edition_id: editionId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: raceId }]), { status: 200 }));

    const response = await GET(
      new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`),
      { params: { id: sponsorId } },
    );
    expect(response.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a disabled or missing sponsor", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const response = await GET(
      new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`),
      { params: { id: sponsorId } },
    );
    expect(response.status).toBe(410);
  });
});

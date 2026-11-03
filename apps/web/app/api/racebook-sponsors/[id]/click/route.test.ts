import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ checkRateLimitAsync: vi.fn(), loadCurrent: vi.fn(), loadEntitlement: vi.fn() }));
vi.mock("../../../../../lib/http", async () => ({
  ...(await vi.importActual<typeof import("../../../../../lib/http")>("../../../../../lib/http")),
  checkRateLimitAsync: mocks.checkRateLimitAsync,
}));
vi.mock("../../../../../lib/organizer", () => ({ serviceHeaders: () => ({}) }));
vi.mock("../../../../../lib/racebook-publications", () => ({ loadCurrentRacebookPublication: mocks.loadCurrent }));
vi.mock("../../../../../lib/organizer-entitlements", () => ({ loadOrganizerEditionEntitlement: mocks.loadEntitlement }));
vi.mock("../../../../../lib/supabase", () => ({ getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }) }));

const sponsorId = "44444444-4444-4444-8444-444444444444";
const raceId = "11111111-1111-4111-8111-111111111111";
const editionId = "33333333-3333-4333-8333-333333333333";
const published = { content: { modules: { sponsors: true }, sponsors: [{ id: sponsorId, destinationUrl: "https://example.com/sponsor" }] } };

beforeEach(() => {
  mocks.loadCurrent.mockResolvedValue({ publication: published });
  mocks.loadEntitlement.mockResolvedValue({ status: "active", tier: "signature" });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("GET /api/racebook-sponsors/[id]/click", () => {
  it("counts only a sponsor present in the current publication and redirects", async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true });
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(Response.json([{ id: raceId, edition_id: editionId }]))
      .mockResolvedValueOnce(Response.json(1));
    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`), { params: { id: sponsorId } });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/sponsor");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("increment_racebook_sponsor_click");
  });

  it("redirects without counting when rate limited", async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false });
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json([{ id: raceId, edition_id: editionId }]));
    expect((await GET(new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`), { params: { id: sponsorId } })).status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a sponsor absent from the publication", async () => {
    mocks.loadCurrent.mockResolvedValue({ publication: { content: { modules: { sponsors: true }, sponsors: [] } } });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json([{ id: raceId, edition_id: editionId }]));
    expect((await GET(new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`), { params: { id: sponsorId } })).status).toBe(410);
  });

  it("masks sponsor links immediately after an entitlement downgrade", async () => {
    mocks.loadEntitlement.mockResolvedValue({ status: "active", tier: "essential" });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json([{ id: raceId, edition_id: editionId }]));
    expect((await GET(new NextRequest(`http://localhost/api/racebook-sponsors/${sponsorId}/click?raceId=${raceId}`), { params: { id: sponsorId } })).status).toBe(410);
  });
});

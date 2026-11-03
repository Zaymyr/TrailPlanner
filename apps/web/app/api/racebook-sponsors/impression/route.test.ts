import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ checkRateLimit: vi.fn(), loadCurrent: vi.fn(), loadEntitlement: vi.fn() }));
vi.mock("../../../../lib/http", async () => ({
  ...(await vi.importActual<typeof import("../../../../lib/http")>("../../../../lib/http")),
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("../../../../lib/organizer", () => ({ serviceHeaders: () => ({}) }));
vi.mock("../../../../lib/racebook-publications", () => ({ loadCurrentRacebookPublication: mocks.loadCurrent }));
vi.mock("../../../../lib/organizer-entitlements", () => ({ loadOrganizerEditionEntitlement: mocks.loadEntitlement }));
vi.mock("../../../../lib/supabase", () => ({ getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }) }));

const sponsorId = "44444444-4444-4444-8444-444444444444";
const raceId = "11111111-1111-4111-8111-111111111111";
const viewId = "55555555-5555-4555-8555-555555555555";
const editionId = "33333333-3333-4333-8333-333333333333";
const published = {
  edition_id: editionId,
  content: { modules: { sponsors: true }, sponsors: [{ id: sponsorId, showOnLoading: true, showInBanner: true, contextualPlacement: "services" }] },
};
const request = (overrides: Record<string, unknown> = {}) => new NextRequest("http://localhost/api/racebook-sponsors/impression", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ raceId, sponsorId, viewId, placement: "hero", tier: "official", ...overrides }),
});

beforeEach(() => {
  mocks.loadCurrent.mockResolvedValue({ publication: published });
  mocks.loadEntitlement.mockResolvedValue({ status: "active", tier: "signature" });
  mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 1 });
});
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("POST /api/racebook-sponsors/impression", () => {
  it("counts one eligible sponsor from the current publication", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(1));
    expect((await POST(request())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("increment_racebook_sponsor_impression");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ p_sponsor_id: sponsorId, p_race_id: raceId, p_placement: "hero" });
  });

  it("deduplicates a repeated view without calling the counter", async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false }).mockReturnValueOnce({ allowed: true });
    const fetchMock = vi.spyOn(global, "fetch");
    expect((await POST(request())).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a placement absent from the publication", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    expect((await POST(request({ placement: "access" }))).status).toBe(204);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("masks impressions after an entitlement downgrade", async () => {
    mocks.loadEntitlement.mockResolvedValue({ status: "active", tier: "essential" });
    expect((await POST(request())).status).toBe(204);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads", async () => {
    expect((await POST(request({ viewId: "invalid" }))).status).toBe(400);
    expect(mocks.loadCurrent).not.toHaveBeenCalled();
  });
});

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ loadCurrent: vi.fn(), fetchUser: vi.fn(), isOrganizer: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: (value: string | null) => value?.replace("Bearer ", "") ?? null,
  fetchSupabaseUser: mocks.fetchUser,
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseAnonKey: "anon" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));
vi.mock("../../../lib/organizer", () => ({ serviceHeaders: () => ({}), isOrganizerForEvent: mocks.isOrganizer }));
vi.mock("../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlement: () => Promise.resolve({ status: "active", tier: "signature" }),
}));
vi.mock("../../../lib/racebook-publications", () => ({ loadCurrentRacebookPublication: mocks.loadCurrent }));

const raceId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const editionId = "33333333-3333-4333-8333-333333333333";
const sponsorId = "44444444-4444-4444-8444-444444444444";
const access = [{ id: raceId, event_id: eventId, edition_id: editionId, is_live: true, racebook_is_live: true, racebook_preview_is_visible: true, race_events: { is_live: true } }];
const publication = {
  id: "55555555-5555-4555-8555-555555555555", source_draft_revision: 3, published_at: "2026-11-03T12:00:00Z",
  content: {
    modules: { sponsors: true, branding: true },
    branding: { logoUrl: "https://example.com/logo.png", primaryColor: "#123456", accentColor: "#ABCDEF" },
    sponsors: [{
      id: sponsorId, name: "Partenaire", logoUrl: "https://example.com/sponsor.png", destinationUrl: "https://sponsor.example.com",
      tier: "principal", category: "Nutrition", contextualPlacement: "aid_stations", showOnLoading: true, showInBanner: true, position: 0,
    }],
  },
};

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("GET /api/racebook-sponsors", () => {
  it("projects sponsors and branding from the same publication", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access));
    mocks.loadCurrent.mockResolvedValue({ publication });
    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors?raceId=${raceId}`));
    const payload = await response.json();
    expect(payload).toMatchObject({ publicationId: publication.id, publicationRevision: 3, branding: publication.content.branding });
    expect(payload.loadingSponsors[0].clickUrl).toContain(`/api/racebook-sponsors/${sponsorId}/click`);
    expect(JSON.stringify(payload)).not.toContain("destinationUrl");
    expect(JSON.stringify(payload)).not.toContain("sponsor.example.com");
  });

  it("does not read draft sponsor tables when no publication exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access));
    mocks.loadCurrent.mockResolvedValue({ publication: null });
    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors?raceId=${raceId}`));
    expect(response.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

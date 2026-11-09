import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  loadCurrent: vi.fn(),
  fetchUser: vi.fn(),
  isOrganizer: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: (value: string | null) => value?.replace("Bearer ", "") ?? null,
  fetchSupabaseUser: mocks.fetchUser,
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseAnonKey: "anon" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));
vi.mock("../../../lib/organizer", () => ({ serviceHeaders: () => ({}), isOrganizerForEvent: mocks.isOrganizer }));
vi.mock("../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlement: () => Promise.resolve({ status: "active", tier: "signature" }),
  loadOrganizerEditionCapabilityGrants: () => Promise.resolve({}),
}));
vi.mock("../../../lib/racebook-publications", () => ({
  loadCurrentRacebookPublication: mocks.loadCurrent,
  moduleMask: (published: Record<string, boolean>, allowed: Record<string, boolean>) =>
    Object.fromEntries(Object.entries(published).map(([key, value]) => [key, value && allowed[key] !== false])),
  publicSnapshot: (publication: any) => ({
    ...publication.content,
    sponsors: publication.content.sponsors.map(({ destinationUrl: _destinationUrl, ...sponsor }: any) => sponsor),
    publicationId: publication.id,
    publicationRevision: publication.source_draft_revision,
    publishedAt: publication.published_at,
  }),
}));

const raceId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const editionId = "33333333-3333-4333-8333-333333333333";
const access = (live: boolean) => [{
  id: raceId, event_id: eventId, edition_id: editionId, is_live: live,
  racebook_is_live: live, racebook_preview_is_visible: true, race_events: { is_live: live },
}];
const publication = {
  id: "44444444-4444-4444-8444-444444444444",
  source_draft_revision: 7,
  published_at: "2026-11-03T12:00:00.000Z",
  content: {
    schemaVersion: 1,
    raceRow: { id: raceId }, stationRows: [{ id: "station" }], relayPointRows: [], startWaveRows: [],
    awardRows: [], editionServiceRows: [], supporterPointRows: [], sponsors: [],
    branding: { logoUrl: null, primaryColor: "#2D5016", accentColor: "#3F6F8F" },
    modules: { aid_stations: true, supporter_points: true, relay: true, start_waves: true, awards: true, services: true, sponsors: true, branding: true },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("GET /api/racebook-data", () => {
  it("serves every section from one immutable publication", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access(true)));
    mocks.loadCurrent.mockResolvedValue({ publication });
    const response = await GET(new NextRequest(`http://localhost/api/racebook-data?raceId=${raceId}`));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ publicationId: publication.id, publicationRevision: 7, organizerPreview: false });
    expect(payload.stationRows).toEqual([{ id: "station" }]);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("max-age=3600");
  });

  it("lets an organizer read the last publication of a private format", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access(false)));
    mocks.fetchUser.mockResolvedValue({ id: "user-1" });
    mocks.isOrganizer.mockResolvedValue(true);
    mocks.loadCurrent.mockResolvedValue({ publication });
    const response = await GET(new NextRequest(`http://localhost/api/racebook-data?raceId=${raceId}`, { headers: { authorization: "Bearer token" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).organizerPreview).toBe(true);
  });

  it("returns unavailable without a first publication", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json(access(true)));
    mocks.loadCurrent.mockResolvedValue({ publication: null });
    const response = await GET(new NextRequest(`http://localhost/api/racebook-data?raceId=${raceId}`));
    expect(response.status).toBe(404);
  });
});

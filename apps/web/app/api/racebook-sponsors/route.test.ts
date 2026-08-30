import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  fetchSupabaseUser: vi.fn(),
  isOrganizerForEvent: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: (value: string | null) => value?.replace("Bearer ", "") ?? null,
  fetchSupabaseUser: mocks.fetchSupabaseUser,
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseAnonKey: "anon" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));

vi.mock("../../../lib/organizer", () => ({
  isOrganizerForEvent: mocks.isOrganizerForEvent,
  serviceHeaders: () => ({}),
}));

const raceId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const editionId = "33333333-3333-4333-8333-333333333333";

const racePayload = (live: boolean) => [{
  id: raceId,
  event_id: eventId,
  edition_id: editionId,
  is_live: live,
  racebook_is_live: live,
  participation_mode: "relay",
  organizer_details: {},
  race_events: { is_live: live, organizer_details: {} },
}];

const sponsor = (id: string, loading: boolean, banner: boolean) => ({
  id,
  edition_id: editionId,
  name: `Sponsor ${id}`,
  logo_url: `https://example.com/${id}.png`,
  website_url: "https://example.com",
  is_active: true,
  show_on_loading: loading,
  show_in_banner: banner,
  position: 0,
  click_count: 0,
});

afterEach(() => vi.restoreAllMocks());

describe("GET /api/racebook-sponsors", () => {
  it("returns only the requested placements for a public RaceBook", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(racePayload(true)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        sponsor("44444444-4444-4444-8444-444444444444", true, true),
        sponsor("55555555-5555-4555-8555-555555555555", false, true),
      ]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors?raceId=${raceId}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.loadingSponsors).toHaveLength(1);
    expect(payload.bannerSponsors).toHaveLength(2);
    expect(payload.loadingSponsors[0].clickUrl).toContain(`/api/racebook-sponsors/44444444-4444-4444-8444-444444444444/click`);
    expect(payload.loadingSponsors[0]).not.toHaveProperty("websiteUrl");
  });

  it("allows an authenticated organizer preview", async () => {
    mocks.fetchSupabaseUser.mockResolvedValue({ id: "user-1" });
    mocks.isOrganizerForEvent.mockResolvedValue(true);
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(racePayload(false)), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors?raceId=${raceId}`, {
      headers: { Authorization: "Bearer token" },
    }));
    expect(response.status).toBe(200);
  });

  it("refuses a private RaceBook to anonymous callers", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(racePayload(false)), { status: 200 }));
    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors?raceId=${raceId}`));
    expect(response.status).toBe(404);
  });

  it("refuses sponsors when a published solo RaceBook has no organizer content", async () => {
    const emptyRaceBook = [{
      ...racePayload(true)[0],
      participation_mode: "solo",
    }];
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(emptyRaceBook), { status: 200 }),
    );

    const response = await GET(new NextRequest(`http://localhost/api/racebook-sponsors?raceId=${raceId}`));

    expect(response.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

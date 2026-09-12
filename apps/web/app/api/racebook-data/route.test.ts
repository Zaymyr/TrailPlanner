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
  name: "Trail test",
  distance_km: 42,
  elevation_gain_m: 1800,
  elevation_loss_m: 1800,
  race_date: "2026-09-20",
  is_live: live,
  racebook_is_live: live,
  racebook_preview_is_visible: true,
  thumbnail_url: null,
  location_text: "Annecy",
  participation_mode: "relay",
  start_lat: null,
  start_lng: null,
  organizer_details: {},
  race_events: {
    id: eventId,
    name: "Événement test",
    location: "Annecy",
    race_date: "2026-09-20",
    thumbnail_url: null,
    is_live: live,
    organizer_details: {},
  },
}];

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("GET /api/racebook-data", () => {
  it("returns a CDN-cacheable public snapshot", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(racePayload(true)), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/racebook-data?raceId=${raceId}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ organizerPreview: false, stationRows: [], relayPointRows: [] });
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("max-age=300");
    expect(response.headers.get("Vercel-Cache-Tag")).toContain(`racebook:edition:${editionId}`);
  });

  it("keeps organizer previews private", async () => {
    mocks.fetchSupabaseUser.mockResolvedValue({ id: "user-1" });
    mocks.isOrganizerForEvent.mockResolvedValue(true);
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(racePayload(false)), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/racebook-data?raceId=${raceId}`, {
      headers: { Authorization: "Bearer token" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).organizerPreview).toBe(true);
  });

  it("does not expose a private snapshot anonymously", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(racePayload(false)), { status: 200 }),
    );

    const response = await GET(new NextRequest(`http://localhost/api/racebook-data?raceId=${raceId}`));

    expect(response.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

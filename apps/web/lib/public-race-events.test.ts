import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicRaceDetail, getPublicRaces } = vi.hoisted(() => ({
  getPublicRaceDetail: vi.fn(),
  getPublicRaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./public-races", () => ({
  getPublicRaces,
  PUBLIC_RACES_REVALIDATE_SECONDS: 900,
}));
vi.mock("./public-race-detail", () => ({ getPublicRaceDetail }));

import { resolvePublicRaceEventEditionSlug } from "./public-race-events";

const editionId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const raceId = "33333333-3333-4333-8333-333333333333";
const nextEditionId = "44444444-4444-4444-8444-444444444444";

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const publicRace = {
  id: raceId,
  eventId,
  editionId,
  eventEditionSlug: "festival-des-cimes-2026",
  slug: "trail-des-cimes-42-km-2026",
  name: "Trail des Cimes 42 km",
  eventName: "Festival des Cimes",
  date: "2026-09-12",
  location: "Annecy",
  distanceKm: 42,
  elevationGainM: 2100,
  thumbnailUrl: null,
  updatedAt: "2026-04-01T10:00:00.000Z",
};

describe("public event edition slug resolution", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    getPublicRaces.mockResolvedValue([publicRace]);
    getPublicRaceDetail.mockResolvedValue({ commonPractical: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads a canonical edition with its public formats, ravitos, and next public edition", async () => {
    getPublicRaces.mockResolvedValue([
      publicRace,
      { ...publicRace, id: "55555555-5555-4555-8555-555555555555", editionId: nextEditionId, eventEditionSlug: "festival-des-cimes-2027" },
    ]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("slug=eq.festival-des-cimes-2026")) return jsonResponse([{ id: editionId, event_id: eventId, slug: "festival-des-cimes-2026", edition_year: 2026, start_date: "2026-09-12", end_date: "2026-09-13", updated_at: null }]);
      if (url.includes("race_events?")) return jsonResponse([{ id: eventId, name: "Festival des Cimes", location: "Annecy", thumbnail_url: null, website_url: "https://example.com", updated_at: null }]);
      if (url.includes("race_aid_stations?")) return jsonResponse([{ race_id: raceId }, { race_id: raceId }]);
      if (url.includes("order=start_date.asc")) return jsonResponse([
        { id: editionId, event_id: eventId, slug: "festival-des-cimes-2026", edition_year: 2026, start_date: "2026-09-12", end_date: "2026-09-13", updated_at: null },
        { id: nextEditionId, event_id: eventId, slug: "festival-des-cimes-2027", edition_year: 2027, start_date: "2027-09-11", end_date: "2027-09-12", updated_at: null },
      ]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resolution = await resolvePublicRaceEventEditionSlug("festival-des-cimes-2026");

    expect(resolution).toEqual(expect.objectContaining({ shouldRedirect: false }));
    expect(resolution?.edition.formats[0]).toEqual(expect.objectContaining({ aidStationCount: 2 }));
    expect(resolution?.edition.nextEdition).toEqual(expect.objectContaining({ slug: "festival-des-cimes-2027" }));
  });

  it("resolves a historical slug and keeps hidden events unavailable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ edition_id: editionId }]))
      .mockResolvedValueOnce(jsonResponse([{ id: editionId, event_id: eventId, slug: "festival-des-cimes-2026", edition_year: 2026, start_date: "2026-09-12", end_date: "2026-09-13", updated_at: null }]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePublicRaceEventEditionSlug("ancien-festival-2026")).resolves.toBeNull();
    expect(fetchMock.mock.calls[1]?.[0]).toContain("race_event_edition_slug_redirects?");
    expect(fetchMock.mock.calls[3]?.[0]).toContain("is_live=eq.true");
  });
});

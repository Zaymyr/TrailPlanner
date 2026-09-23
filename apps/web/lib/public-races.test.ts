import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getPublicRaceRegistrationUrl,
  getPublicRaces,
  PUBLIC_RACES_REVALIDATE_SECONDS,
  resolvePublicRaceSlug,
  type PublicRace,
} from "./public-races";

const race = {
  id: "11111111-1111-4111-8111-111111111111",
  event_id: null,
  edition_id: null,
  slug: "trail-canonique",
  name: "Trail canonique",
  race_date: "2026-09-12",
  location_text: "Annecy",
  location: null,
  distance_km: 42,
  elevation_gain_m: 2100,
  thumbnail_url: null,
  external_site_url: null,
};

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("public race slug resolution", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("excludes catalog formats whose parent event is not live", async () => {
    const visibleEventId = "22222222-2222-4222-8222-222222222222";
    const hiddenEventId = "33333333-3333-4333-8333-333333333333";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("race_event_editions?")) return jsonResponse([]);
      if (url.includes("race_events?")) {
        return jsonResponse([
          {
            id: visibleEventId,
            name: "Événement public",
            location: "Annecy",
            location_city: "Annecy",
            location_department: "Haute-Savoie",
            location_region: "Auvergne-Rhône-Alpes",
            location_country: "France",
            race_date: "2026-09-12",
            thumbnail_url: "https://images.example/event.png",
            website_url: "https://event.example/",
          },
        ]);
      }

      return jsonResponse([
        race,
        { ...race, id: "44444444-4444-4444-8444-444444444444", slug: "visible", event_id: visibleEventId },
        { ...race, id: "55555555-5555-4555-8555-555555555555", slug: "cache", event_id: hiddenEventId },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicRaces()).resolves.toEqual([
      expect.objectContaining({ slug: race.slug, editionId: null, raceThumbnailUrl: null, eventThumbnailUrl: null }),
      expect.objectContaining({
        slug: "visible",
        eventName: "Événement public",
        raceThumbnailUrl: null,
        eventThumbnailUrl: "https://images.example/event.png",
        thumbnailUrl: "https://images.example/event.png",
        eventWebsiteUrl: "https://event.example/",
        searchTerms: ["Annecy", "Haute-Savoie", "Auvergne-Rhône-Alpes", "France"],
      }),
    ]);
  });

  it("excludes a live race whose edition is hidden and uses one cache contract", async () => {
    const eventId = "22222222-2222-4222-8222-222222222222";
    const visibleEditionId = "33333333-3333-4333-8333-333333333333";
    const hiddenEditionId = "44444444-4444-4444-8444-444444444444";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("race_event_editions?")) {
        return jsonResponse([{ id: visibleEditionId, event_id: eventId }]);
      }
      if (url.includes("race_events?")) {
        return jsonResponse([{
          id: eventId,
          name: "Festival public",
          location: "Annecy",
          race_date: "2026-09-12",
          thumbnail_url: null,
          website_url: null,
        }]);
      }
      return jsonResponse([
        { ...race, event_id: eventId, edition_id: visibleEditionId, slug: "edition-visible" },
        { ...race, id: "55555555-5555-4555-8555-555555555555", event_id: eventId, edition_id: hiddenEditionId, slug: "edition-cachee" },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicRaces()).resolves.toEqual([
      expect.objectContaining({ slug: "edition-visible", editionId: visibleEditionId }),
    ]);
    const editionCall = fetchMock.mock.calls.find(([url]) => String(url).includes("race_event_editions?"));
    expect(editionCall?.[0]).toContain("is_visible=eq.true");
    expect(editionCall?.[1]).toEqual(expect.objectContaining({
      next: { revalidate: PUBLIC_RACES_REVALIDATE_SECONDS },
    }));
    expect(editionCall?.[1]?.headers).toEqual(expect.objectContaining({ apikey: "service-key" }));
  });

  it("rejects a canonical race attached to an invisible edition", async () => {
    const eventRace = {
      ...race,
      event_id: "22222222-2222-4222-8222-222222222222",
      edition_id: "33333333-3333-4333-8333-333333333333",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([eventRace]))
      .mockResolvedValueOnce(jsonResponse([{
        id: eventRace.event_id,
        name: "Festival public",
        location: "Annecy",
        race_date: "2026-09-12",
        thumbnail_url: null,
        website_url: null,
      }]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePublicRaceSlug(eventRace.slug)).resolves.toBeNull();
    expect(fetchMock.mock.calls[2]?.[0]).toContain("is_visible=eq.true");
    expect(fetchMock.mock.calls[2]?.[0]).toContain(`id=eq.${eventRace.edition_id}`);
  });

  it("keeps a canonical public slug without consulting redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([race]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePublicRaceSlug(race.slug)).resolves.toEqual({
      race: expect.objectContaining({ slug: race.slug }),
      shouldRedirect: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("slug=eq.trail-canonique");
  });

  it("resolves an old slug to its canonical live public race", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ race_id: race.id }]))
      .mockResolvedValueOnce(jsonResponse([race]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePublicRaceSlug("ancien-trail")).resolves.toEqual({
      race: expect.objectContaining({ id: race.id, slug: race.slug }),
      shouldRedirect: true,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("race_slug_redirects?select=race_id&old_slug=eq.ancien-trail");
    expect(fetchMock.mock.calls[2]?.[0]).toContain(`id=eq.${race.id}&is_live=eq.true&is_public=eq.true`);
  });

  it("preserves not-found behavior when the mapped race is no longer public", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ race_id: race.id }]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePublicRaceSlug("ancien-trail")).resolves.toBeNull();
  });

  it("rejects a mapped format whose parent event is not live", async () => {
    const eventRace = { ...race, event_id: "22222222-2222-4222-8222-222222222222" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ race_id: race.id }]))
      .mockResolvedValueOnce(jsonResponse([eventRace]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePublicRaceSlug("ancien-trail")).resolves.toBeNull();
    expect(fetchMock.mock.calls[3]?.[0]).toContain("race_events?");
    expect(fetchMock.mock.calls[3]?.[0]).toContain("is_live=eq.true");
  });

  it("uses the event website for registration and rejects unsafe or missing links", () => {
    const publicRace = {
      eventWebsiteUrl: "https://event.example/",
      externalSiteUrl: "https://event.example/format",
    } as PublicRace;

    expect(getPublicRaceRegistrationUrl(publicRace)).toBe("https://event.example/");
    expect(getPublicRaceRegistrationUrl({ ...publicRace, eventWebsiteUrl: "javascript:alert(1)" })).toBe(
      "https://event.example/format",
    );
    expect(getPublicRaceRegistrationUrl({ ...publicRace, eventWebsiteUrl: null, externalSiteUrl: null })).toBeNull();
  });
});

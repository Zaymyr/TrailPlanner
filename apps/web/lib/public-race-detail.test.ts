import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildPublicRaceRoutePreview, getPublicRaceDetail } from "./public-race-detail";
import type { PublicRace } from "./public-races";

const baseRace: PublicRace = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  editionId: "33333333-3333-4333-8333-333333333333",
  slug: "trail-public",
  name: "Trail public",
  eventName: "Festival public",
  date: "2026-09-12",
  location: "Annecy",
  distanceKm: 42,
  elevationGainM: 2100,
  raceThumbnailUrl: "https://images.example/race.png",
  eventThumbnailUrl: "https://images.example/event.png",
  thumbnailUrl: "https://images.example/race.png",
  externalSiteUrl: "https://format.example",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("public race detail", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a sanitized runner-facing detail without emergency or last-minute content", async () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="45" lon="6"><ele>500</ele></trkpt>
      <trkpt lat="45.01" lon="6.01"><ele>700</ele></trkpt>
    </trkseg></trk></gpx>`;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/rest/v1/races?")) {
        return jsonResponse([{
          id: baseRace.id,
          event_id: baseRace.eventId,
          edition_id: baseRace.editionId,
          elevation_loss_m: 1800,
          min_alt_m: 500,
          max_alt_m: 1700,
          gpx_storage_path: "catalog/race.gpx",
          participation_mode: "solo",
          organizer_details: { schedule: { startTime: "06:00", finishCutoffTime: "18:00" } },
        }]);
      }
      if (url.includes("/rest/v1/race_events?")) {
        return jsonResponse([{
          id: baseRace.eventId,
          is_live: true,
          organizer_details: {
            officialWebsiteUrl: "https://event.example",
            instagramUrl: "https://instagram.com/event",
            emergencyContact: { name: "PC course", phone: "0612345678" },
            services: { supporters: "Zone supporters", lastMinuteMessage: "message privé" },
          },
        }]);
      }
      if (url.includes("/rest/v1/race_event_editions?")) {
        return jsonResponse([{
          id: baseRace.editionId,
          event_id: baseRace.eventId,
          end_date: "2026-09-13",
          is_visible: true,
        }]);
      }
      if (url.includes("/rest/v1/race_aid_stations?")) {
        return jsonResponse([{
          id: "44444444-4444-4444-8444-444444444444",
          name: "Refuge",
          km: 20,
          water_available: true,
          solid_available: true,
          assistance_allowed: false,
          notes: "Soupe chaude",
          order_index: 0,
          organizer_details: { altitudeM: 1200, cutoffTime: "12:30", dropBagAvailable: true },
        }]);
      }
      if (url.includes("/storage/v1/object/race-gpx/")) return new Response(gpx, { status: 200 });
      return jsonResponse([], 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getPublicRaceDetail(baseRace);

    expect(detail).toEqual(expect.objectContaining({
      officialWebsiteUrl: "https://event.example",
      eventEndDate: "2026-09-13",
      elevationLossM: 1800,
      participationMode: "solo",
      routePreview: expect.objectContaining({ points: expect.any(Array) }),
    }));
    expect(detail?.aidStations[0]).toEqual(expect.objectContaining({ name: "Refuge", altitudeM: 1200, dropBagAvailable: true }));
    expect(detail?.practical.services.supporters).toBe("Zone supporters");
    expect(JSON.stringify(detail)).not.toContain("0612345678");
    expect(JSON.stringify(detail)).not.toContain("message privé");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("is_live=eq.true&is_public=eq.true");
  });

  it("refuses rich content when the parent event is no longer public", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        id: baseRace.id,
        event_id: baseRace.eventId,
        gpx_storage_path: "catalog/private.gpx",
        organizer_details: {},
      }]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicRaceDetail(baseRace)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("downsamples long GPX files while preserving the first and last points", () => {
    const points = Array.from({ length: 1_201 }, (_, index) =>
      `<trkpt lat="45.${String(index).padStart(4, "0")}" lon="6"><ele>${500 + index}</ele></trkpt>`,
    ).join("");
    const preview = buildPublicRaceRoutePreview(`<gpx><trk><trkseg>${points}</trkseg></trk></gpx>`);

    expect(preview.points.length).toBeLessThanOrEqual(602);
    expect(preview.points[0]?.elevationM).toBe(500);
    expect(preview.points.at(-1)?.elevationM).toBe(1700);
  });

  it("keeps the detail available when the GPX is invalid", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const standaloneRace = { ...baseRace, eventId: null, editionId: null };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/rest/v1/races?")) {
        return jsonResponse([{
          id: standaloneRace.id,
          event_id: null,
          edition_id: null,
          gpx_storage_path: "catalog/invalid.gpx",
          organizer_details: {},
        }]);
      }
      if (url.includes("/rest/v1/race_aid_stations?")) return jsonResponse([]);
      if (url.includes("/storage/v1/object/race-gpx/")) return new Response("not a GPX file", { status: 200 });
      return jsonResponse([], 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getPublicRaceDetail(standaloneRace);

    expect(detail).not.toBeNull();
    expect(detail?.routePreview).toBeNull();
  });

  it("does not request Storage when no GPX object exists", async () => {
    const standaloneRace = { ...baseRace, eventId: null, editionId: null };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/rest/v1/races?")) {
        return jsonResponse([{
          id: standaloneRace.id,
          event_id: null,
          edition_id: null,
          gpx_storage_path: null,
          organizer_details: {},
        }]);
      }
      if (url.includes("/rest/v1/race_aid_stations?")) return jsonResponse([]);
      return jsonResponse([], 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getPublicRaceDetail(standaloneRace);

    expect(detail?.routePreview).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/storage/v1/object/"))).toBe(false);
  });
});

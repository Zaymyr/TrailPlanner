import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPublished: vi.fn() }));
vi.mock("./racebook-public-data", () => ({ loadPublishedRacebookData: mocks.loadPublished }));

import { loadSupporterGuide } from "./supporter-guide";

const editionId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const raceId = "33333333-3333-4333-8333-333333333333";
const config = { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "service" };

describe("Supporter Guide aggregator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.loadPublished.mockReset();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("race_event_editions")) return Response.json([{ id: editionId, event_id: eventId, start_date: "2027-06-01", end_date: "2027-06-02", race_events: { name: "Trail Test", location: "Annecy", thumbnail_url: null } }]);
      if (url.includes("partner_link_settings")) return Response.json([{ partner_key: "booking", standard_url: "https://booking.example.com", affiliate_url: "https://affiliate.example.com", affiliate_enabled: true, is_enabled: true, updated_at: "2027-01-01T00:00:00Z" }]);
      return Response.json([{ id: raceId, event_id: eventId, edition_id: editionId, name: "42 km", is_live: true, racebook_is_live: true, racebook_preview_is_visible: true }]);
    }));
  });

  it("normalizes only immutable, effective publication content", async () => {
    mocks.loadPublished.mockResolvedValue({
      raceRow: { id: raceId, name: "42 km", distance_km: 42, race_date: "2027-06-01", organizer_details: { schedule: { startTime: "07:00", finishCutoffTime: "18:00" } }, race_events: { organizer_details: { emergencyContact: { phone: "+33123456789" }, officialWebsiteUrl: "https://trail.test" } } },
      stationRows: [{ id: "s1", name: "Col", km: 20, assistance_allowed: true, organizer_details: { supportersAccess: "restricted", maxStopMinutes: 5, amenities: ["toilettes"], cutoffTime: "13:00" } }],
      supporterPointRows: [{ id: "p1", name: "Village", km: 10, encouragement_allowed: true, assistance_allowed: false, latitude: 45, longitude: 6 }],
      startWaveRows: [{ id: "w1", name: "Élite", start_time: "07:00:00" }], awardRows: [{ id: "a1", category_label: "Scratch", podium_time: "16:00:00", podium_location: "Village" }],
      editionServiceRows: [{ id: "e1", service_type: "restaurant", name: "La Table", address: "Centre" }], partnerSlots: [],
      publicationId: "44444444-4444-4444-8444-444444444444", publishedAt: "2027-05-20T10:00:00Z",
      modules: { supporter_guide: true, access: true, bib_pickup: true },
    });
    const guide = await loadSupporterGuide(config, editionId, false);
    expect(guide?.formats[0]).toMatchObject({ name: "42 km", startTime: "07:00", finishCutoffTime: "18:00" });
    expect(guide?.formats[0]?.supporterPoints).toHaveLength(1);
    expect(guide?.formats[0]?.aidStations[0]).toMatchObject({ supportersAccess: "restricted", maxStopMinutes: 5 });
    expect(guide?.stayServices[0]?.name).toBe("La Table");
    expect(guide?.practical.emergencyPhone).toBe("+33123456789");
    expect(guide?.practical.links).toEqual([{ kind: "official", url: "https://trail.test" }]);
    expect(guide?.lodgingPartner).toMatchObject({ mode: "affiliate", clickUrl: "https://affiliate.example.com" });
  });

  it("resolves organizer cutoff wording over several days and sorts the programme", async () => {
    const secondRaceId = "55555555-5555-4555-8555-555555555555";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("race_event_editions")) return Response.json([{ id: editionId, event_id: eventId, start_date: "2026-11-13", end_date: "2026-11-15", race_events: { name: "Bibracte", location: "Glux", thumbnail_url: null } }]);
      if (url.includes("partner_link_settings")) return Response.json([]);
      return Response.json([
        { id: raceId, event_id: eventId, edition_id: editionId, name: "Ultra", is_live: true, racebook_is_live: true, racebook_preview_is_visible: true },
        { id: secondRaceId, event_id: eventId, edition_id: editionId, name: "Court", is_live: true, racebook_is_live: true, racebook_preview_is_visible: true },
      ]);
    }));
    const base = { awardRows: [], supporterPointRows: [], editionServiceRows: [], partnerSlots: [], publishedAt: "2026-11-01T10:00:00Z", modules: { supporter_guide: true } };
    mocks.loadPublished.mockImplementation(async (_config: unknown, race: { id: string }) => race.id === raceId ? {
      ...base,
      publicationId: "66666666-6666-4666-8666-666666666666",
      raceRow: { id: raceId, name: "Ultra", distance_km: 184.7, race_date: "2026-11-13", organizer_details: { schedule: { startTime: "14:00", finishCutoffTime: "dim. 15/11 à 14h" } } },
      startWaveRows: [],
      stationRows: [
        { id: "r1", name: "Roussillon", km: 27, order_index: 1, organizer_details: { cutoffTime: "sam. 01h00" } },
        { id: "r2", name: "Saint-Prix", km: 120, order_index: 2, organizer_details: { cutoffTime: "samedi 21h" } },
        { id: "f", name: "Arrivée", km: 184.7, order_index: 3, organizer_details: {} },
      ],
    } : {
      ...base,
      publicationId: "77777777-7777-4777-8777-777777777777",
      raceRow: { id: secondRaceId, name: "Court", distance_km: 13.1, race_date: "2026-11-13", organizer_details: { schedule: { startTime: "10:00" } } },
      startWaveRows: [{ id: "w2", name: "SAS 2", start_time: "09:30:00", order_index: 2 }, { id: "w1", name: "SAS 1", start_time: "09:00:00", order_index: 1 }],
      stationRows: [],
    });

    const guide = await loadSupporterGuide(config, editionId, false);
    expect(guide?.formats.map((format) => format.name)).toEqual(["Court", "Ultra"]);
    const ultra = guide!.formats[1]!;
    expect(ultra.aidStations.map((station) => station.cutoff)).toEqual([
      { date: "2026-11-14", time: "01:00", dayOffset: 1 },
      { date: "2026-11-14", time: "21:00", dayOffset: 1 },
      { date: "2026-11-15", time: "14:00", dayOffset: 2 },
    ]);
    expect(ultra.aidStations[0]?.cutoffTime).toBe("01:00");
    expect(ultra.aidStations[2]?.isFinish).toBe(true);
    expect(ultra.finishCutoff).toEqual({ date: "2026-11-15", time: "14:00", dayOffset: 2 });
    expect(guide?.timeline?.map((entry) => `${entry.date} ${entry.time} ${entry.kind} ${entry.label ?? entry.raceName}`)).toEqual([
      "2026-11-13 09:00 start SAS 1",
      "2026-11-13 09:30 start SAS 2",
      "2026-11-13 14:00 start Ultra",
      "2026-11-15 14:00 finish_cutoff Ultra",
    ]);
  });

  it("is unavailable without an enabled published guide", async () => {
    mocks.loadPublished.mockResolvedValue(null);
    await expect(loadSupporterGuide(config, editionId, false)).resolves.toBeNull();
  });
});

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

  it("is unavailable without an enabled published guide", async () => {
    mocks.loadPublished.mockResolvedValue(null);
    await expect(loadSupporterGuide(config, editionId, false)).resolves.toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { bindPlanShareSnapshotToRace, type PlanShareSnapshot } from "./plan-share";
import * as publicData from "./racebook-public-data";
import { loadPlanShareRaceContext, matchPlanCheckpointToPublishedStation, matchStationSupporterPoint } from "./plan-share-race-context";

const snapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Plan",
  distanceKm: 42,
  elevationGainM: 1200,
  waterBagLiters: 1.5,
  targetCarbsPerHour: 60,
  targetWaterPerHour: 500,
  targetSodiumPerHour: 400,
  totalDurationMin: 360,
  totalProductUnits: 0,
  totalCarbsG: 0,
  totalSodiumMg: 0,
  productTotals: [],
  checkpoints: [],
} satisfies PlanShareSnapshot;

describe("plan share race context", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("always binds raceId from the owned plan and ignores a client value", () => {
    const client = { ...snapshot, raceId: "22222222-2222-4222-8222-222222222222" };
    expect(bindPlanShareSnapshotToRace(client, "33333333-3333-4333-8333-333333333333").raceId)
      .toBe("33333333-3333-4333-8333-333333333333");
    expect(bindPlanShareSnapshotToRace(client, null).raceId).toBeNull();
  });

  it("matches a checkpoint by stable source id before its distance", () => {
    const stations = [{ id: "official", km: 20 }, { id: "nearby", km: 10.02 }];
    expect(matchPlanCheckpointToPublishedStation({ sourceAidStationId: "official", distanceKm: 10 }, stations)?.id).toBe("official");
  });

  it("uses the documented 150 m legacy tolerance only for one unambiguous station", () => {
    expect(matchPlanCheckpointToPublishedStation({ sourceAidStationId: null, distanceKm: 10 }, [{ id: "near", km: 10.14 }])?.id).toBe("near");
    expect(matchPlanCheckpointToPublishedStation({ sourceAidStationId: null, distanceKm: 10 }, [{ id: "far", km: 10.16 }])).toBeNull();
    expect(matchPlanCheckpointToPublishedStation({ sourceAidStationId: null, distanceKm: 10 }, [{ id: "a", km: 9.9 }, { id: "b", km: 10.1 }])).toBeNull();
  });

  it("finds aid-station directions by place name within 2 km, then by the 150 m tolerance", () => {
    const point = (id: string, name: string, km: number, assistanceAllowed: boolean) => ({ id, name, km, assistanceAllowed });
    expect(matchStationSupporterPoint({ name: "St-Martin", km: 20 }, [
      point("cheer", "Saint Martin", 20.4, false),
      point("crew", "saint-martin", 21.5, true),
    ])?.id).toBe("crew");
    expect(matchStationSupporterPoint({ name: "Col", km: 20 }, [point("near", "Parking", 20.1, false)])?.id).toBe("near");
    expect(matchStationSupporterPoint({ name: "Col", km: 20 }, [point("a", "A", 19.95, false), point("b", "B", 20.05, false)])).toBeNull();
    expect(matchStationSupporterPoint({ name: "Col", km: 20 }, [point("a", "A", 19.95, true), point("b", "B", 20.05, false)])?.id).toBe("a");
    expect(matchStationSupporterPoint({ name: "Col", km: 20 }, [point("far", "Col", 23, true)])).toBeNull();
  });

  it("returns no context when the visible race has no immutable publication", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: "33333333-3333-4333-8333-333333333333", edition_id: "44444444-4444-4444-8444-444444444444",
      is_live: true, racebook_is_live: true, racebook_preview_is_visible: true, race_events: { is_live: true },
    }]), { status: 200 })));
    vi.spyOn(publicData, "loadPublishedRacebookData").mockResolvedValue(null);
    const result = await loadPlanShareRaceContext({ supabaseUrl: "https://example.test", supabaseServiceRoleKey: "service" }, {
      ...snapshot, raceId: "33333333-3333-4333-8333-333333333333",
    });
    expect(result).toBeNull();
  });

  it("omits sections whose publication modules are inactive", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: "33333333-3333-4333-8333-333333333333", edition_id: "44444444-4444-4444-8444-444444444444",
      is_live: true, racebook_is_live: true, racebook_preview_is_visible: true, race_events: { is_live: true },
    }]), { status: 200 })));
    vi.spyOn(publicData, "loadPublishedRacebookData").mockResolvedValue({
      raceRow: { id: "33333333-3333-4333-8333-333333333333", name: "Course", race_date: "2027-06-20", organizer_details: {}, race_events: { is_live: true, organizer_details: {} } },
      stationRows: [], supporterPointRows: [], startWaveRows: [], relayPointRows: [], awardRows: [], editionServiceRows: [], sponsors: [], partnerSlots: [],
      branding: { logoUrl: null, primaryColor: "#2D5016", accentColor: "#3F6F8F" },
      modules: { equipment: false, bib_pickup: false, access: false, services: false, branding: false, sponsors: false, aid_stations: false, supporter_points: false, start_waves: false, awards: false, relay: false, official_products: false },
      schemaVersion: 1, publicationId: "55555555-5555-4555-8555-555555555555", publicationRevision: 1, publishedAt: "2026-11-15T00:00:00Z",
    } as any);
    const result = await loadPlanShareRaceContext({ supabaseUrl: "https://example.test", supabaseServiceRoleKey: "service" }, {
      ...snapshot, raceId: "33333333-3333-4333-8333-333333333333",
    });
    expect(result).toMatchObject({ supporterPoints: [], checkpointContexts: [], access: null, bibPickup: null });
  });
});

import { describe, expect, it } from "vitest";

import { buildRaceDataGaps, type GapFormat } from "./race-data-gaps";

const TODAY = "2026-11-20";
const format = (overrides: Partial<GapFormat>): GapFormat => ({
  raceId: "r", eventName: "Événement", name: "Trail 45 km", distanceKm: 45, elevationGainM: 1_500,
  hasGpx: false, aidStationCount: 0, participationMode: "solo", date: "2026-12-05", ...overrides,
});

describe("buildRaceDataGaps", () => {
  it("says what is missing, what it unlocks and by when for the reel", () => {
    const [gap] = buildRaceDataGaps([format({ raceId: "menestrail", name: "Grand Menestrail — 56 km", distanceKm: 56 })], TODAY, 3);
    expect(gap).toMatchObject({ raceId: "menestrail", missing: ["gpx", "aid_stations"], unlocks: ["reel", "plan", "brief"], reelDeadline: "2026-11-25", reelTooLate: false });
  });

  it("marks a reel as too late once the deadline is past, and keeps the carousels", () => {
    const [gap] = buildRaceDataGaps([format({ date: "2026-11-28" })], TODAY, 3);
    expect(gap).toMatchObject({ reelDeadline: "2026-11-18", reelTooLate: true, unlocks: ["reel", "plan", "brief"] });
  });

  it("skips complete, past, distant, team, kids and short formats", () => {
    const gaps = buildRaceDataGaps([
      format({ raceId: "complete", hasGpx: true, aidStationCount: 3 }),
      format({ raceId: "past", date: "2026-11-19" }),
      format({ raceId: "far", date: "2027-02-01" }),
      format({ raceId: "relay", name: "Relais 4 × 10 km" }),
      format({ raceId: "kids", name: "Kid's Trail 2,5 km", distanceKm: 2.5 }),
      format({ raceId: "short", name: "Trail 9 km", distanceKm: 9 }),
    ], TODAY, 3);
    expect(gaps).toEqual([]);
  });

  it("lists a short format only for the carousels, and a long one with only its D+ missing", () => {
    const gaps = buildRaceDataGaps([
      format({ raceId: "medium", distanceKm: 23, name: "Trail 23 km" }),
      format({ raceId: "dplus", hasGpx: true, aidStationCount: 2, elevationGainM: null }),
    ], TODAY, 3);
    expect(gaps.find((gap) => gap.raceId === "medium")?.unlocks).toEqual(["plan", "brief"]);
    expect(gaps.find((gap) => gap.raceId === "dplus")).toMatchObject({ missing: ["elevation_gain"], unlocks: ["plan"], reelDeadline: null });
  });

  it("puts the reels still reachable first, soonest deadline first", () => {
    const gaps = buildRaceDataGaps([
      format({ raceId: "late", date: "2026-11-27" }),
      format({ raceId: "medium", distanceKm: 20, date: "2026-11-22" }),
      format({ raceId: "dec10", date: "2026-12-10" }),
      format({ raceId: "dec04", date: "2026-12-04" }),
    ], TODAY, 3);
    expect(gaps.map((gap) => gap.raceId)).toEqual(["dec04", "dec10", "medium", "late"]);
  });
});

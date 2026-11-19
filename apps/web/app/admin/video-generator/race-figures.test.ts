import { afterEach, describe, expect, it, vi } from "vitest";

import type { VideoAidStation } from "../../../lib/video-generator";
import {
  buildRaceFigures,
  formatElevationM,
  formatKm,
  formatKmFixed,
  formatTotalElevationM,
  formatTotalKm,
  getAnnouncedElevationGainM,
  roundTotalKm,
  toAnnouncedElevationM,
  toAnnouncedKm,
  toRouteAidStations,
  toRouteKm,
} from "./race-figures";

// fr-FR groups thousands with a narrow no-break space.
const plain = (text: string | null) => text?.replace(/ | /g, " ") ?? null;

const station: VideoAidStation = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Sainte-Eulalie-de-Cernon",
  distanceKm: 30.2,
  waterAvailable: true,
  foodAvailable: true,
  assistanceAllowed: true,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
};

describe("buildRaceFigures", () => {
  afterEach(() => vi.restoreAllMocks());

  it("takes the race record as the announced truth and rescales the GPX to it", () => {
    const figures = buildRaceFigures({ raceDistanceKm: 66.63, raceElevationGainM: 2276, routeDistanceKm: 64.9, routeElevationGainM: 2100 });
    expect(figures.distanceSource).toBe("race");
    expect(figures.elevationSource).toBe("race");
    expect(figures.distanceKm).toBe(66.63);
    expect(figures.kmScale).toBeCloseTo(66.63 / 64.9, 9);
    expect(figures.gainScale).toBeCloseTo(2276 / 2100, 9);
    // The counter ends exactly on the announced total, the badge figure.
    expect(toAnnouncedKm(figures, 64.9)).toBeCloseTo(66.63, 9);
    expect(toAnnouncedElevationM(figures, 2100)).toBeCloseTo(2276, 9);
    expect(figures.warnings).toEqual([]);
  });

  it("falls back to the GPX when the race figure is implausible, and says why", () => {
    const figures = buildRaceFigures({ raceDistanceKm: 120, raceElevationGainM: 9000, routeDistanceKm: 64.9, routeElevationGainM: 2100 });
    expect(figures.distanceSource).toBe("route");
    expect(figures.distanceKm).toBe(64.9);
    expect(figures.kmScale).toBe(1);
    expect(figures.elevationSource).toBe("route");
    expect(figures.gainScale).toBe(1);
    expect(figures.warnings).toHaveLength(2);
  });

  it("accepts a race distance up to 15 % off and a D+ up to 35 % off", () => {
    expect(buildRaceFigures({ raceDistanceKm: 74, raceElevationGainM: null, routeDistanceKm: 65, routeElevationGainM: 0 }).distanceSource).toBe("race");
    expect(buildRaceFigures({ raceDistanceKm: 76, raceElevationGainM: null, routeDistanceKm: 65, routeElevationGainM: 0 }).distanceSource).toBe("route");
    expect(buildRaceFigures({ raceDistanceKm: 65, raceElevationGainM: 2800, routeDistanceKm: 65, routeElevationGainM: 2100 }).elevationSource).toBe("race");
    expect(buildRaceFigures({ raceDistanceKm: 65, raceElevationGainM: 2900, routeDistanceKm: 65, routeElevationGainM: 2100 }).elevationSource).toBe("route");
  });

  it("uses the GPX D+ when the race has none, and none at all on a flat route without D+", () => {
    const withGpxGain = buildRaceFigures({ raceDistanceKm: 30, raceElevationGainM: null, routeDistanceKm: 30, routeElevationGainM: 612 });
    expect(withGpxGain.elevationSource).toBe("route");
    expect(plain(formatTotalElevationM(withGpxGain))).toBe("610");
    expect(getAnnouncedElevationGainM(withGpxGain)).toBe(610);
    const flat = buildRaceFigures({ raceDistanceKm: 10, raceElevationGainM: null, routeDistanceKm: 10, routeElevationGainM: 0 });
    expect(flat.elevationGainM).toBeNull();
    expect(formatTotalElevationM(flat)).toBeNull();
  });

  it("converts organizer stations to route kilometres and back without drift", () => {
    const figures = buildRaceFigures({ raceDistanceKm: 66.63, raceElevationGainM: 2276, routeDistanceKm: 64.9, routeElevationGainM: 2100 });
    const [onRoute] = toRouteAidStations(figures, [station]);
    expect(onRoute.distanceKm).toBeCloseTo(30.2 / (66.63 / 64.9), 9);
    expect(toAnnouncedKm(figures, onRoute.distanceKm)).toBeCloseTo(30.2, 9);
    expect(toRouteKm(figures, 66.63)).toBeCloseTo(64.9, 9);
    // No rescale: the very same objects.
    const identity = buildRaceFigures({ raceDistanceKm: null, raceElevationGainM: null, routeDistanceKm: 64.9, routeElevationGainM: 2100 });
    const stations = [station];
    expect(toRouteAidStations(identity, stations)).toBe(stations);
  });
});

describe("rounding policy", () => {
  it("shows totals in whole kilometres from 10 km, one decimal below", () => {
    expect(formatTotalKm(66.63)).toBe("67");
    expect(formatTotalKm(184.7)).toBe("185");
    expect(formatTotalKm(8.46)).toBe("8,5");
    expect(formatTotalKm(9)).toBe("9");
    expect(roundTotalKm(66.63)).toBe(67);
  });

  it("shows positions with one decimal, dropping ,0 in text but not on the counter", () => {
    expect(formatKm(12.44)).toBe("12,4");
    expect(formatKm(30.02)).toBe("30");
    expect(formatKmFixed(30.02)).toBe("30,0");
    expect(formatKmFixed(66.63)).toBe("66,6");
  });

  it("rounds a GPX D+ to the nearest 10 m and keeps the announced D+ as announced", () => {
    expect(formatElevationM(544)).toBe("540");
    expect(formatElevationM(545)).toBe("550");
    expect(plain(formatElevationM(2276))).toBe("2 280");
    const figures = buildRaceFigures({ raceDistanceKm: 66.63, raceElevationGainM: 2276, routeDistanceKm: 64.9, routeElevationGainM: 2100 });
    expect(plain(formatTotalElevationM(figures))).toBe("2 276");
    expect(getAnnouncedElevationGainM(figures)).toBe(2276);
  });
});

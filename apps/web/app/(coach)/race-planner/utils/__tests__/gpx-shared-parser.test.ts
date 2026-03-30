import { describe, expect, it } from "vitest";
import { parseGpx } from "../../../../../lib/gpx/parseGpx";
import { buildPlannerGpx } from "../gpx";
import type { FormValues } from "../../types";

const baseValues: FormValues = {
  raceDistanceKm: 12,
  elevationGain: 300,
  paceType: "pace",
  paceMinutes: 6,
  paceSeconds: 0,
  speedKph: 10,
  targetIntakePerHour: 60,
  waterIntakePerHour: 600,
  sodiumIntakePerHour: 500,
  waterBagLiters: 1,
  aidStations: [{ name: "AS1", distanceKm: 6, waterRefill: true }],
};

describe("shared GPX parser", () => {
  it("re-imports a GPX exported by the planner", () => {
    const exported = buildPlannerGpx(baseValues, [
      { distanceKm: 0, elevationM: 100, lat: 45, lon: 3 },
      { distanceKm: 6, elevationM: 180, lat: 45.02, lon: 3.02 },
      { distanceKm: 12, elevationM: 120, lat: 45.04, lon: 3.04 },
    ]);

    const parsed = parseGpx(exported);

    expect(parsed.points.length).toBeGreaterThanOrEqual(2);
    expect(parsed.waypoints.some((wpt) => wpt.name === "AS1")).toBe(true);
    expect(parsed.stats.distanceKm).toBeGreaterThan(0);
  });

  it("rejects clearly invalid GPX content", () => {
    expect(() => parseGpx("<gpx><trk></trk></gpx>")).toThrow("No track points found in GPX.");
  });
});

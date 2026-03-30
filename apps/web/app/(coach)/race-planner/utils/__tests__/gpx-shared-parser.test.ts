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

  it("parses self-closing track points (trkpt />)", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ChatGPT" xmlns="http://www.topografix.com/GPX/1/1" xmlns:tp="https://trailplanner.app/gpx">
  <wpt lat="44.969030" lon="3.646060"><name>Start</name><extensions><tp:index>0</tp:index><tp:distance>0</tp:distance></extensions></wpt>
  <trk><name>Sample</name><trkseg>
    <trkpt lat="44.969030" lon="3.646060"/>
    <trkpt lat="44.968260" lon="3.647540"/>
    <trkpt lat="44.968220" lon="3.647660"/>
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx);
    expect(parsed.points.length).toBe(3);
    expect(parsed.waypoints.length).toBe(1);
    expect(parsed.stats.distanceKm).toBeGreaterThan(0);
  });
});

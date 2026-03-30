import { describe, expect, it } from "vitest";
import type { RacePlannerTranslations } from "../../../../../locales/types";
import type { FormValues } from "../../types";
import { buildPlannerGpx, parseGpx } from "../gpx";

const copy = {
  defaults: { finish: "Finish" },
  gpx: {
    fallbackAidStation: "Aid station",
    errors: {
      invalidPlannerState: "invalid planner state",
      invalidCoordinates: "invalid coordinates",
      noTrackPoints: "no track points",
      unableToImport: "unable to import",
    },
  },
} as unknown as RacePlannerTranslations;

const baseValues: FormValues = {
  raceDistanceKm: 10,
  elevationGain: 0,
  paceType: "pace",
  paceMinutes: 6,
  paceSeconds: 0,
  speedKph: 10,
  targetIntakePerHour: 60,
  waterIntakePerHour: 600,
  sodiumIntakePerHour: 500,
  waterBagLiters: 1,
  aidStations: [{ name: "AS1", distanceKm: 5 }],
};

describe("race planner GPX", () => {
  it("imports a minimal standard GPX with track points only", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="45.0000" lon="3.0000"><ele>100</ele></trkpt>
    <trkpt lat="45.0010" lon="3.0010"><ele>120</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx, copy);

    expect(parsed.distanceKm).toBeGreaterThan(0);
    expect(parsed.elevationProfile.length).toBe(2);
    expect(parsed.elevationProfile[0]?.lat).toBe(45);
    expect(parsed.aidStations.some((s) => s.name === "Finish")).toBe(true);
  });

  it("imports standard GPX with self-closing trkpt tags", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="45.0000" lon="3.0000" />
    <trkpt lat="45.0010" lon="3.0010" />
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx, copy);
    expect(parsed.distanceKm).toBeGreaterThan(0);
    expect(parsed.elevationProfile.length).toBe(2);
  });

  it("imports a standard GPX with waypoints", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="45.0005" lon="3.0005"><name>Ravito 1</name></wpt>
  <trk><trkseg>
    <trkpt lat="45.0000" lon="3.0000"><ele>100</ele></trkpt>
    <trkpt lat="45.0010" lon="3.0010"><ele>120</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx, copy);

    expect(parsed.aidStations.some((s) => s.name === "Ravito 1")).toBe(true);
  });

  it("uses tp:index/tp:distance extensions when provided", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:tp="https://pace-yourself.app/gpx">
  <wpt lat="45.0005" lon="3.0005">
    <name>Ravito 1</name>
    <extensions><tp:index>0</tp:index><tp:distance>2500</tp:distance></extensions>
  </wpt>
  <trk><trkseg>
    <trkpt lat="45.0000" lon="3.0000"><ele>100</ele></trkpt>
    <trkpt lat="45.0010" lon="3.0010"><ele>120</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx, copy);
    const station = parsed.aidStations.find((s) => s.name === "Ravito 1");

    expect(station?.distanceKm).toBe(2.5);
  });

  it("imports legacy GPX when trailplanner:state exists", () => {
    const plannerState = Buffer.from(JSON.stringify({ values: { raceDistanceKm: 42.2, aidStations: [{ name: "AS", distanceKm: 10 }] } })).toString(
      "base64"
    );

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:trailplanner="https://trailplanner.app/gpx">
  <metadata><extensions><trailplanner:state>${plannerState}</trailplanner:state></extensions></metadata>
  <trk><trkseg>
    <trkpt lat="45.0000" lon="3.0000"><ele>100</ele></trkpt>
    <trkpt lat="45.0010" lon="3.0010"><ele>120</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx, copy);

    expect(parsed.distanceKm).toBe(42.2);
    expect(parsed.plannerValues?.raceDistanceKm).toBe(42.2);
  });

  it("exports standard GPX without legacy planner state", () => {
    const xml = buildPlannerGpx(baseValues, [
      { distanceKm: 0, elevationM: 100, lat: 45, lon: 3 },
      { distanceKm: 10, elevationM: 120, lat: 45.01, lon: 3.01 },
    ]);

    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain("<trkpt lat=");
    expect(xml).toContain("<wpt lat=");
    expect(xml).toContain("<tp:index>");
    expect(xml).toContain("<tp:distance>");
    expect(xml).not.toContain("trailplanner:state");
  });

  it("keeps a reasonable standard round-trip", () => {
    const exported = buildPlannerGpx(baseValues, [
      { distanceKm: 0, elevationM: 100, lat: 45, lon: 3 },
      { distanceKm: 5, elevationM: 110, lat: 45.005, lon: 3.005 },
      { distanceKm: 10, elevationM: 120, lat: 45.01, lon: 3.01 },
    ]);

    const parsed = parseGpx(exported, copy);

    expect(parsed.distanceKm).toBeGreaterThan(0);
    expect(parsed.aidStations.some((s) => s.name === "AS1")).toBe(true);
    expect(parsed.elevationProfile.length).toBeGreaterThanOrEqual(2);
  });
});

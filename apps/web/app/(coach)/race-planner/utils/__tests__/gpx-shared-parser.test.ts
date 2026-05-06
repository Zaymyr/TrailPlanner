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
    expect(() => parseGpx("<gpx><trk></trk></gpx>")).toThrow(
      "No track, route, or waypoint coordinates found in GPX."
    );
  });

  it("rejects point tags with invalid coordinates", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="hello" lon="3.0000" />
    <trkpt lat="95.0000" lon="181.0000" />
  </trkseg></trk>
</gpx>`;

    expect(() => parseGpx(gpx)).toThrow("Track, route, or waypoint coordinates are present but invalid.");
  });

  it("accepts GPX content with embedded null bytes", () => {
    const gpx = `\u0000<\u0000g\u0000p\u0000x\u0000 \u0000v\u0000e\u0000r\u0000s\u0000i\u0000o\u0000n\u0000=\u0000"\u00001\u0000.\u00001\u0000"\u0000 \u0000x\u0000m\u0000l\u0000n\u0000s\u0000=\u0000"\u0000h\u0000t\u0000t\u0000p\u0000:\u0000/\u0000/\u0000w\u0000w\u0000w\u0000.\u0000t\u0000o\u0000p\u0000o\u0000g\u0000r\u0000a\u0000f\u0000i\u0000x\u0000.\u0000c\u0000o\u0000m\u0000/\u0000G\u0000P\u0000X\u0000/\u00001\u0000/\u00001\u0000"\u0000>\u0000
\u0000 \u0000 \u0000<\u0000t\u0000r\u0000k\u0000>\u0000<\u0000t\u0000r\u0000k\u0000s\u0000e\u0000g\u0000>\u0000
\u0000 \u0000 \u0000 \u0000 \u0000<\u0000t\u0000r\u0000k\u0000p\u0000t\u0000 \u0000l\u0000a\u0000t\u0000=\u0000"\u00004\u00005\u0000.\u00000\u00000\u00000\u0000"\u0000 \u0000l\u0000o\u0000n\u0000=\u0000"\u00003\u0000.\u00000\u00000\u00000\u0000"\u0000/\u0000>\u0000
\u0000 \u0000 \u0000 \u0000 \u0000<\u0000t\u0000r\u0000k\u0000p\u0000t\u0000 \u0000l\u0000a\u0000t\u0000=\u0000"\u00004\u00005\u0000.\u00000\u00000\u00001\u0000"\u0000 \u0000l\u0000o\u0000n\u0000=\u0000"\u00003\u0000.\u00000\u00000\u00001\u0000"\u0000/\u0000>\u0000
\u0000 \u0000 \u0000<\u0000/\u0000t\u0000r\u0000k\u0000s\u0000e\u0000g\u0000>\u0000<\u0000/\u0000t\u0000r\u0000k\u0000>\u0000
\u0000<\u0000/\u0000g\u0000p\u0000x\u0000>\u0000`;

    const parsed = parseGpx(gpx);

    expect(parsed.pointSource).toBe("track");
    expect(parsed.points).toHaveLength(2);
  });

  it("rejects KML files with a clearer message", () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document />
</kml>`;

    expect(() => parseGpx(kml)).toThrow("This file is KML, not GPX. Export it as a .gpx file and try again.");
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
    expect(parsed.pointSource).toBe("track");
    expect(parsed.waypoints.length).toBe(1);
    expect(parsed.stats.distanceKm).toBeGreaterThan(0);
  });

  it("falls back to route points when a GPX has no track", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte><name>Route only</name>
    <rtept lon='3,0000' lat='45,0000'><ele>-10</ele></rtept>
    <rtept lon='3,0010' lat='45,0010'><ele>20</ele></rtept>
  </rte>
</gpx>`;

    const parsed = parseGpx(gpx);
    expect(parsed.pointSource).toBe("route");
    expect(parsed.points.length).toBe(2);
    expect(parsed.stats.distanceKm).toBeGreaterThan(0);
    expect(parsed.stats.gainM).toBeGreaterThan(0);
  });

  it("falls back to waypoint coordinates when no track or route exists", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="45.0000" lon="3.0000"><name>A</name></wpt>
  <wpt lat="45.0010" lon="3.0010"><name>B</name></wpt>
</gpx>`;

    const parsed = parseGpx(gpx);
    expect(parsed.pointSource).toBe("waypoint");
    expect(parsed.points.length).toBe(2);
    expect(parsed.stats.distanceKm).toBeGreaterThan(0);
  });

  it("decodes waypoint names with numeric entities", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="45.0000" lon="3.0000"><name>D&#233;part d&apos;&#233;t&#233;</name></wpt>
  <trk><trkseg>
    <trkpt lat="45.0000" lon="3.0000" />
    <trkpt lat="45.0010" lon="3.0010" />
  </trkseg></trk>
</gpx>`;

    const parsed = parseGpx(gpx);
    expect(parsed.waypoints[0]?.name).toBe("Départ d'été");
  });
});

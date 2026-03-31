import { describe, expect, it } from "vitest";
import { normalizeImportedWaypoints } from "../../../../../lib/gpx/normalizeImportedWaypoints";
import type { GpxPoint, GpxWaypoint } from "../../../../../lib/gpx/parseGpx";

const points: GpxPoint[] = [
  { lat: 45, lng: 3, ele: null, distKmCum: 0 },
  { lat: 45.01, lng: 3.01, ele: null, distKmCum: 5 },
  { lat: 45.02, lng: 3.02, ele: null, distKmCum: 10 },
];

const wp = (lat: number, lng: number, name: string): GpxWaypoint => ({ lat, lng, name });

describe("normalizeImportedWaypoints", () => {
  it("picks explicit start waypoint and avoids km0 duplicate", () => {
    const result = normalizeImportedWaypoints(points, [wp(45, 3, "Départ officiel"), wp(45.01, 3.01, "AS 1")]);

    expect(result.startName).toBe("Départ officiel");
    expect(result.aidStations.some((s) => s.distanceKm === 0)).toBe(false);
  });

  it("picks explicit finish waypoint and avoids end duplicate", () => {
    const result = normalizeImportedWaypoints(points, [wp(45.02, 3.02, "Arrivée arche"), wp(45.01, 3.01, "AS 1")]);

    expect(result.finishName).toBe("Arrivée arche");
    expect(result.aidStations.some((s) => s.distanceKm >= 9.8)).toBe(false);
  });

  it("falls back to default names when no endpoint waypoint exists", () => {
    const result = normalizeImportedWaypoints(points, [wp(45.01, 3.01, "Ravito")], {
      startName: "Départ",
      finishName: "Arrivée",
    });

    expect(result.startName).toBe("Départ");
    expect(result.finishName).toBe("Arrivée");
    expect(result.aidStations).toHaveLength(1);
  });

  it("deduplicates identical waypoint names/distances", () => {
    const result = normalizeImportedWaypoints(points, [wp(45.01, 3.01, "Ravito"), wp(45.01, 3.01, "Ravito")]);

    expect(result.aidStations).toHaveLength(1);
  });
});

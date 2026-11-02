import { describe, expect, it } from "vitest";

import {
  buildMarkerGeoJson,
  buildRouteGeoJson,
  findClosestRoutePoint,
  type VideoRoutePoint,
} from "./video-generator";

const points: VideoRoutePoint[] = [
  { lat: 45, lon: 6, elevationM: 450, distanceKm: 0 },
  { lat: 45.1, lon: 6.1, elevationM: null, distanceKm: 4.5 },
  { lat: 45.2, lon: 6.2, elevationM: 900, distanceKm: 10 },
];

describe("video generator geometry", () => {
  it("keeps every route point in its original order", () => {
    expect(buildRouteGeoJson(points).features[0].geometry.coordinates).toEqual([
      [6, 45],
      [6.1, 45.1],
      [6.2, 45.2],
    ]);
  });

  it("finds the closest cumulative-distance point with a binary search", () => {
    expect(findClosestRoutePoint(points, 4)?.distanceKm).toBe(4.5);
    expect(findClosestRoutePoint(points, -1)?.distanceKm).toBe(0);
    expect(findClosestRoutePoint(points, 30)?.distanceKm).toBe(10);
  });

  it("adds start, finish and projected aid-station markers", () => {
    const markers = buildMarkerGeoJson(points, [
      { id: "11111111-1111-4111-8111-111111111111", name: "Col", distanceKm: 4 },
    ]);

    expect(markers.features.map((feature) => feature.properties.kind)).toEqual(["start", "finish", "aid"]);
    expect(markers.features[2].geometry.coordinates).toEqual([6.1, 45.1]);
  });

  it("keeps both semantic endpoints for a one-point route", () => {
    const markers = buildMarkerGeoJson([points[0]], []);
    expect(markers.features.map((feature) => feature.properties.label)).toEqual(["Départ", "Arrivée"]);
  });

  it("returns empty feature collections for an empty route", () => {
    expect(buildRouteGeoJson([]).features).toEqual([]);
    expect(buildMarkerGeoJson([], []).features).toEqual([]);
    expect(findClosestRoutePoint([], 1)).toBeNull();
  });
});

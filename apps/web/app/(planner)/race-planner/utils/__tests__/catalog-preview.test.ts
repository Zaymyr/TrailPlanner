import { describe, expect, it } from "vitest";

import { elevationGainFromProfile, mapCatalogAidStations, resolvePreviewElevationGain } from "../catalog-preview";

const profile = [
  { distanceKm: 0, elevationM: 300 },
  { distanceKm: 5, elevationM: 450 },
  { distanceKm: 10, elevationM: 380 },
  { distanceKm: 15, elevationM: 520 },
];

describe("catalog preview helpers", () => {
  it("sums only positive elevation deltas", () => {
    expect(elevationGainFromProfile(profile)).toBe(290);
    expect(elevationGainFromProfile([])).toBe(0);
  });

  it("maps catalog aid stations in order, without the finish or stations beyond the course", () => {
    const stations = mapCatalogAidStations(
      [
        { id: "b", name: "Col", km: 18.6, water_available: true, solid_available: true, assistance_allowed: true, order_index: 1 },
        { id: "a", name: "Plateau", km: 9.5, water_available: true, solid_available: false, assistance_allowed: false, order_index: 0 },
        { name: "Arrivée", km: 25, order_index: 2 },
      ],
      25,
    );
    expect(stations).toEqual([
      { name: "Plateau", distanceKm: 9.5, sourceAidStationId: "a", waterRefill: true, solidRefill: false, assistanceAllowed: false },
      { name: "Col", distanceKm: 18.6, sourceAidStationId: "b", waterRefill: true, solidRefill: true, assistanceAllowed: true },
    ]);
  });

  it("prefers the catalog D+, then the profile gain, then the fallback", () => {
    expect(resolvePreviewElevationGain(470, profile, 2200)).toBe(470);
    expect(resolvePreviewElevationGain(null, profile, 2200)).toBe(290);
    expect(resolvePreviewElevationGain(undefined, [], 2200)).toBe(2200);
  });
});

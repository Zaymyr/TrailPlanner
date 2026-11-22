import { describe, expect, it } from "vitest";

import { buildAidStationTimelineEntries, getDisplayedElevationLossM, getSiblingFormatLabel } from "./catalog-display";

const station = (id: string, name: string, distanceKm: number) => ({ id, name, distanceKm, waterAvailable: true, solidAvailable: false });

describe("course detail display helpers", () => {
  it("labels sibling formats by name and distance so equal distances stay distinguishable", () => {
    expect(getSiblingFormatLabel({ name: "Course 7,5 km", eventName: "Boucles de l’Oison", distanceKm: 7.5 })).toBe("Course 7,5 km");
    expect(getSiblingFormatLabel({ name: "La Rand’Eaunes", eventName: "Les Amaz’Eaunes", distanceKm: 10 })).toBe("La Rand’Eaunes · 10 km");
    expect(getSiblingFormatLabel({ name: "GRF 166 Relais à 4", eventName: "Grand Raid du Finistère", distanceKm: 166 })).toBe("GRF 166 Relais à 4 · 166 km");
    expect(getSiblingFormatLabel({ name: "SaintéLyon — 80 km", eventName: "SaintéLyon", distanceKm: 80 })).toBe("80 km");
    expect(getSiblingFormatLabel({ name: "Ultra", eventName: null, distanceKm: 158.68 })).toBe("Ultra · 158,68 km");
    expect(getSiblingFormatLabel({ name: "Marche", eventName: null, distanceKm: null })).toBe("Marche");
  });

  it("hides a placeholder D− of 0 unless the GPX confirms it", () => {
    const gpx = (lossM: number) => ({ points: [], stats: { distanceKm: 10, gainM: 0, lossM, minAltM: 0, maxAltM: 0 } });
    expect(getDisplayedElevationLossM({ elevationLossM: 1200, routePreview: null })).toBe(1200);
    expect(getDisplayedElevationLossM({ elevationLossM: 0, routePreview: null })).toBeNull();
    expect(getDisplayedElevationLossM({ elevationLossM: null, routePreview: null })).toBeNull();
    expect(getDisplayedElevationLossM({ elevationLossM: 0, routePreview: gpx(840) })).toBe(840);
    expect(getDisplayedElevationLossM({ elevationLossM: 0, routePreview: gpx(0) })).toBe(0);
  });

  it("merges an organizer finish row into the finish instead of listing it twice", () => {
    const entries = buildAidStationTimelineEntries([station("a", "Col", 7), station("b", "Arrivée", 15)], 15);
    expect(entries.map((entry) => entry.kind)).toEqual(["start", "station", "finish"]);
    expect(entries.at(-1)).toMatchObject({ kind: "finish", distanceKm: 15, station: { id: "b" } });

    const sameKm = buildAidStationTimelineEntries([station("a", "Col", 7), station("b", "Village", 15.05)], 15);
    expect(sameKm.at(-1)).toMatchObject({ kind: "finish", station: { id: "b" } });
    expect(sameKm).toHaveLength(3);
  });

  it("merges an organizer start row and keeps intermediate stations", () => {
    const entries = buildAidStationTimelineEntries([station("s", "Départ", 0), station("a", "Col", 7)], 15);
    expect(entries).toEqual([
      { kind: "start", station: expect.objectContaining({ id: "s" }) },
      { kind: "station", station: expect.objectContaining({ id: "a" }) },
      { kind: "finish", distanceKm: 15, station: null },
    ]);
  });
});

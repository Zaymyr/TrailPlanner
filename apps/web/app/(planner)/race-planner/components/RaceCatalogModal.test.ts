import { describe, expect, it } from "vitest";

import { groupCatalogRaces } from "./RaceCatalogModal";

type Race = Parameters<typeof groupCatalogRaces>[0][number];

let counter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const event = (name: string, race_date: string | null) => ({ id: uuid(), name, race_date, location: "Lyon", thumbnail_url: null });

const race = (name: string, distance_km: number, raceEvent: ReturnType<typeof event> | null, gpx = true): Race => ({
  id: uuid(),
  name,
  distance_km,
  elevation_gain_m: 100,
  gpx_storage_path: gpx ? "path.gpx" : null,
  event_id: raceEvent?.id ?? null,
  race_events: raceEvent,
});

describe("groupCatalogRaces", () => {
  it("groups formats under their event and sorts formats by GPX then distance", () => {
    const saintelyon = event("SaintéLyon", "2026-11-29");
    const groups = groupCatalogRaces(
      [race("SaintéLyon — 78 km", 78, saintelyon), race("SaintéLyon — 23 km", 23, saintelyon, false), race("SaintéLyon — 44 km", 44, saintelyon)],
      "2026-11-23"
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].eventName).toBe("SaintéLyon");
    expect(groups[0].races.map((item) => item.distance_km)).toEqual([44, 78, 23]);
  });

  it("puts events with a GPX first, then upcoming by date, then past, and keeps orphan formats as their own card", () => {
    const past = event("Passée", "2026-05-01");
    const later = event("Plus tard", "2027-03-01");
    const soon = event("Bientôt", "2026-12-01");
    const noGpx = event("Sans GPX", "2026-11-30");
    const groups = groupCatalogRaces(
      [
        race("A", 10, past),
        race("B", 10, later),
        race("C", 10, soon),
        race("D", 10, noGpx, false),
        race("Orpheline", 12, null),
      ],
      "2026-11-23"
    );

    expect(groups.map((group) => group.eventName ?? group.races[0].name)).toEqual([
      "Bientôt",
      "Plus tard",
      "Passée",
      "Orpheline",
      "Sans GPX",
    ]);
  });
});

describe("groupCatalogRaces editions", () => {
  it("keeps only the latest edition of a format repeated in the same event", () => {
    const tst = event("Trail TST", "2026-11-23");
    const old = { ...race("Balcon", 18, tst, false), race_date: "2025-09-27" };
    const current = { ...race("Balcon", 18, tst), race_date: "2026-11-23" };
    const groups = groupCatalogRaces([old, current], "2026-11-01");

    expect(groups[0].races).toEqual([current]);
    expect(groups[0].hasGpx).toBe(true);
  });
});

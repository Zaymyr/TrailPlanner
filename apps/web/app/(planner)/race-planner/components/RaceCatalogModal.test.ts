import { describe, expect, it } from "vitest";

import { getCatalogToday, groupCatalogRaces } from "./RaceCatalogModal";

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

  it("hides past events, keeps today, orders by date within GPX-ready then trace-less events, undated last", () => {
    const past = event("Passée", "2026-11-20");
    const today = event("Trail TST", "2026-11-23");
    const later = event("Plus tard", "2027-06-01");
    const soon = event("Bientôt", "2026-12-01");
    const noGpxSoon = event("Sans GPX proche", "2026-11-24");
    const undated = event("Sans date", null);
    const groups = groupCatalogRaces(
      [
        race("A", 10, past),
        race("B", 10, later),
        race("C", 10, soon),
        race("D", 10, noGpxSoon, false),
        race("E", 10, today),
        race("F", 10, undated),
        race("Orpheline", 12, null),
      ],
      "2026-11-23"
    );

    expect(groups.map((group) => group.eventName ?? group.races[0].name)).toEqual([
      "Trail TST",
      "Bientôt",
      "Plus tard",
      "Orpheline",
      "Sans date",
      "Sans GPX proche",
    ]);
  });

  it("computes today as the Europe/Paris calendar day", () => {
    expect(getCatalogToday(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-23");
    expect(getCatalogToday(new Date("2026-11-23T12:00:00Z"))).toBe("2026-11-23");
  });
});

import { describe, expect, it } from "vitest";

import { buildBriefSnapshot, buildClosingSlide, buildStationsSlide, formatCutoff, selectBriefPalette, type BriefInput } from "./carousel-brief";
import { formatWeekRange, isoWeekNumber } from "./carousel-format";
import { buildWeekSnapshot, groupWeekDays, isListedFormat, paginateWeek, selectWeekEvents, type WeekEvent } from "./carousel-week";

const station = (km: number, cutoffTime: string | null = null, water = true, solid = true) => ({ name: `Ravito ${km}`, km, waterAvailable: water, solidAvailable: solid, cutoffTime });

const brief = (overrides: Partial<BriefInput> = {}): BriefInput => ({
  eventName: "Asics SaintéLyon",
  raceTitle: "SaintéLyon 80 km",
  shortLabel: "SAINTÉLYON 80 KM",
  raceDate: "2026-11-28",
  distanceKm: 80,
  elevationGainM: 2_500,
  stations: [station(17, "04:00"), station(46, "9h30", true, false)],
  finishCutoffTime: null,
  nightStart: true,
  livret: { available: false, equipment: true, bibPickup: true, access: true, services: false },
  ...overrides,
});

describe("le brief", () => {
  it("uses the night palette for a night start, else the day one", () => {
    expect(selectBriefPalette(true)).toBe("night");
    expect(buildBriefSnapshot(brief({ nightStart: false })).palette).toBe("day");
  });

  it("shows the cutoffs when the organizer gave them", () => {
    const slide = buildStationsSlide(brief());
    expect(slide.kind).toBe("cutoffs");
    expect(slide.rows.map((row) => [row.kmLabel, row.big])).toEqual([["KM 17", "04:00"], ["KM 46", "09:30"]]);
    expect(slide.rows[1].chips).toEqual([{ text: "EAU SEULEMENT", tone: "warn" }]);
    expect(formatCutoff("7h05")).toBe("07:05");
  });

  it("falls back to « Les ravitos » with their services", () => {
    const slide = buildStationsSlide(brief({ stations: [station(16.2), station(30.2)] }));
    expect(slide.kind).toBe("ravitos");
    expect(slide.rows[0]).toMatchObject({ kmLabel: "KM", big: "16,2" });
    expect(slide.lead).toContain("2 ravitos sur 80 km");
  });

  it("promotes the livret only when the organizer bought it, else the plan de course", () => {
    expect(buildClosingSlide(brief().livret).kind).toBe("plan");
    const livret = buildClosingSlide({ available: true, equipment: true, bibPickup: false, access: true, services: false });
    expect(livret.kind).toBe("livret");
    expect(livret.signs.map((sign) => sign.title)).toEqual(["Matériel", "Course", "Accès"]);
  });

  it("dates the cover absolutely, never « J−8 »", () => {
    const snapshot = buildBriefSnapshot(brief());
    expect(snapshot.cover.eyebrow).toBe("ASICS SAINTÉLYON · 28 NOV.");
    expect(JSON.stringify(snapshot)).not.toMatch(/J\s*[-−]\s*\d/);
    expect(snapshot.cover.third).toEqual({ value: "2", label: "BARRIÈRES" });
  });
});

const format = (raceId: string, date: string, distanceKm: number, name = `${distanceKm} km`, elevationGainM: number | null = 500) =>
  ({ raceId, name, date, distanceKm, elevationGainM, participationMode: "solo" });

const events: WeekEvent[] = [
  { eventId: "e1", name: "SaintéLyon", location: "Rhône", formats: [format("a", "2026-11-28", 160), format("b", "2026-11-28", 80), format("c", "2026-11-28", 46), format("r", "2026-11-28", 80, "Relais 4")] },
  { eventId: "e2", name: "Chiang Mai by UTMB", location: "Thaïlande", formats: [format("d", "2026-11-28", 57), format("e", "2026-11-29", 20)] },
  { eventId: "e3", name: "Boucles de l'Oison", location: "Eure (27)", formats: [format("f", "2026-11-29", 15), format("w", "2026-11-29", 10, "Marche nordique")] },
  { eventId: "e4", name: "Hors semaine", location: null, formats: [format("g", "2026-12-01", 30)] },
];

describe("la semaine qui vient", () => {
  it("excludes relays, duos, teams and walks", () => {
    expect(isListedFormat(format("x", "2026-11-28", 20, "Duo des neiges"))).toBe(false);
    expect(isListedFormat({ ...format("x", "2026-11-28", 20), participationMode: "relay" })).toBe(false);
    expect(isListedFormat(format("x", "2026-11-28", 20, "Trail des crêtes"))).toBe(true);
  });

  it("keeps the Monday-Sunday races, most formats first", () => {
    const selected = selectWeekEvents(events, "2026-11-23");
    expect(selected.map((event) => event.eventId)).toEqual(["e1", "e2", "e3"]);
    expect(selected[0].formats.map((entry) => entry.raceId)).toEqual(["a", "b", "c"]);
  });

  it("groups by day; an event on two days appears under both", () => {
    const days = groupWeekDays(selectWeekEvents(events, "2026-11-23"));
    expect(days.map((day) => day.label)).toEqual(["SAM. 28 NOV.", "DIM. 29 NOV."]);
    expect(days[0].rows.map((row) => row.name)).toEqual(["SaintéLyon", "Chiang Mai by UTMB"]);
    expect(days[1].rows.map((row) => row.name)).toEqual(["Chiang Mai by UTMB", "Boucles de l'Oison"]);
    expect(days[0].rows[0].tiles[0]).toEqual({ km: "160 KM", dplus: "D+ 500 M" });
  });

  it("caps the list deterministically and counts the overflow", () => {
    const many: WeekEvent[] = Array.from({ length: 9 }, (_, index) => ({
      eventId: `m${index}`, name: `Course ${index}`, location: null, formats: [format(`r${index}`, "2026-11-28", 20 + index)],
    }));
    const { days, more } = paginateWeek(selectWeekEvents(many, "2026-11-23"));
    expect(days.flatMap((day) => day.rows)).toHaveLength(6);
    expect(more).toBe(3);
  });

  it("builds the cover planks and the week range", () => {
    const snapshot = buildWeekSnapshot(events, "2026-11-23");
    expect(snapshot?.range).toBe("23–29 NOV.");
    expect(snapshot?.planks[0]).toEqual({ name: "SaintéLyon", cotes: "160 · 80 · 46 KM · RHÔNE", side: "right" });
    expect(snapshot?.subtitle).toBe("SEMAINE 48 · 3 COURSES · TOUT SE JOUE LE WEEK-END");
    expect(buildWeekSnapshot([], "2026-11-23")).toBeNull();
    expect(formatWeekRange("2026-11-30", "2026-12-06")).toBe("30 NOV.–6 DÉC.");
    expect(isoWeekNumber("2026-11-23")).toBe(48);
  });
});

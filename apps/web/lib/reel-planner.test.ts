import { describe, expect, it } from "vitest";

import {
  addDays,
  getEditionKey,
  getFormatDate,
  getReelMode,
  isEligibleFormat,
  parisToday,
  planReels,
  weekStart,
  type PlannerFormat,
} from "./reel-planner";

let counter = 0;
const format = (overrides: Partial<PlannerFormat> = {}): PlannerFormat => {
  counter += 1;
  return {
    raceId: `race-${String(counter).padStart(3, "0")}`,
    name: `Format ${counter}`,
    distanceKm: 42,
    isLive: true,
    hasGpx: true,
    aidStationCount: 3,
    raceDate: "2027-03-20",
    editionStartDate: null,
    eventDate: null,
    eventId: "event-a",
    editionId: "edition-a",
    ...overrides,
  };
};

const TODAY = "2026-11-20"; // a Friday

describe("reel planner dates", () => {
  it("adds days and finds the Monday of a week", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(weekStart("2026-11-20")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });

  it("reads today in Paris, not in UTC", () => {
    expect(parisToday(new Date("2026-11-20T23:30:00Z"))).toBe("2026-11-21");
    expect(parisToday(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
  });

  it("takes the race date, then the edition start, then the event date", () => {
    expect(getFormatDate({ raceDate: "2027-01-02", editionStartDate: "2027-01-01", eventDate: "2026-12-31" })).toBe("2027-01-02");
    expect(getFormatDate({ raceDate: null, editionStartDate: "2027-01-01", eventDate: "2026-12-31" })).toBe("2027-01-01");
    expect(getFormatDate({ raceDate: null, editionStartDate: null, eventDate: "2026-12-31T00:00:00" })).toBe("2026-12-31");
    expect(getFormatDate({ raceDate: null, editionStartDate: null, eventDate: null })).toBeNull();
  });

  it("keys formats by edition, else by event and year, else by race", () => {
    expect(getEditionKey(format({ editionId: "ed-1" }))).toBe("edition:ed-1");
    expect(getEditionKey(format({ editionId: null, eventId: "ev-1", raceDate: "2027-05-01" }))).toBe("event:ev-1:2027");
    expect(getEditionKey(format({ raceId: "r-9", editionId: null, eventId: null, raceDate: "2027-05-01" }))).toBe("race:r-9:2027-05-01");
  });
});

describe("eligibility and mode", () => {
  it("accepts a complete future solo format", () => {
    expect(isEligibleFormat(format(), TODAY)).toBe(true);
  });

  it.each([
    ["not live", { isLive: false }],
    ["relay", { name: "Relais à 4" }],
    ["relay (en)", { name: "Ultra RELAY" }],
    ["duo", { name: "Trail en Duo" }],
    ["team", { name: "Team challenge" }],
    ["no GPX", { hasGpx: false }],
    ["no aid station", { aidStationCount: 0 }],
    ["under 30 km", { distanceKm: 29.9 }],
    ["past", { raceDate: "2026-11-01" }],
    ["today", { raceDate: TODAY }],
    ["undated", { raceDate: null, editionStartDate: null, eventDate: null }],
  ])("rejects a format %s", (_label, overrides) => {
    expect(isEligibleFormat(format(overrides as Partial<PlannerFormat>), TODAY)).toBe(false);
  });

  it("flies the whole course up to 60 km, the highlights beyond", () => {
    expect(getReelMode(30)).toBe("full");
    expect(getReelMode(60)).toBe("full");
    expect(getReelMode(60.1)).toBe("highlights");
  });
});

describe("planReels", () => {
  it("returns an empty plan for an empty or ineligible catalog", () => {
    expect(planReels([], [], [], { today: TODAY })).toEqual({ planned: [], skipped: [] });
    expect(planReels([format({ hasGpx: false }), format({ distanceKm: 12 })], [], [], { today: TODAY })).toEqual({ planned: [], skipped: [] });
  });

  it("publishes a lone format 7 days before the race, generated 3 days earlier", () => {
    const only = format({ raceDate: "2027-03-20", distanceKm: 80 });
    const plan = planReels([only], [], [], { today: TODAY });
    expect(plan.planned).toEqual([expect.objectContaining({
      raceId: only.raceId,
      mode: "highlights",
      plannedPublishDate: "2027-03-13",
      generateOn: "2027-03-10",
      eventStart: "2027-03-20",
    })]);
  });

  it("orders an edition shortest first, 7 days apart, the longest at event start − 7", () => {
    const short = format({ distanceKm: 35 });
    const middle = format({ distanceKm: 55 });
    const long = format({ distanceKm: 110 });
    const plan = planReels([long, short, middle], [], [], { today: TODAY });
    const byRace = Object.fromEntries(plan.planned.map((item) => [item.raceId, item.plannedPublishDate]));
    expect(byRace[long.raceId]).toBe("2027-03-13");
    expect(byRace[middle.raceId]).toBe("2027-03-06");
    expect(byRace[short.raceId]).toBe("2027-02-27");
    expect(plan.planned.map((item) => item.raceId)).toEqual([short.raceId, middle.raceId, long.raceId]);
  });

  it("starts the event on its earliest eligible format date", () => {
    const friday = format({ distanceKm: 160, raceDate: "2027-03-19" });
    const saturday = format({ distanceKm: 40, raceDate: "2027-03-20" });
    const plan = planReels([friday, saturday], [], [], { today: TODAY });
    expect(plan.planned.find((item) => item.raceId === friday.raceId)?.plannedPublishDate).toBe("2027-03-12");
    expect(plan.planned.find((item) => item.raceId === saturday.raceId)?.plannedPublishDate).toBe("2027-03-05");
  });

  it("allows one reel a day: a clash moves to the previous free day", () => {
    const a = format({ eventId: "a", editionId: "a", raceDate: "2027-03-20" });
    const b = format({ eventId: "b", editionId: "b", raceDate: "2027-03-20" });
    const plan = planReels([a, b], [], [], { today: TODAY });
    expect(plan.planned.map((item) => item.plannedPublishDate).sort()).toEqual(["2027-03-12", "2027-03-13"]);
  });

  it("allows three reels a week and spills into the previous week", () => {
    // Five events on the same Saturday: targets all on Saturday 2027-03-13 (week of Monday 03-08).
    const formats = ["a", "b", "c", "d", "e"].map((id) => format({ eventId: id, editionId: id, raceDate: "2027-03-20" }));
    const plan = planReels(formats, [], [], { today: TODAY });
    const days = plan.planned.map((item) => item.plannedPublishDate).sort();
    expect(days).toEqual(["2027-03-06", "2027-03-07", "2027-03-11", "2027-03-12", "2027-03-13"]);
    const weeks = days.reduce<Record<string, number>>((counts, day) => ({ ...counts, [weekStart(day)]: (counts[weekStart(day)] ?? 0) + 1 }), {});
    expect(Math.max(...Object.values(weeks))).toBeLessThanOrEqual(3);
  });

  it("honours custom caps", () => {
    const formats = ["a", "b", "c"].map((id) => format({ eventId: id, editionId: id, raceDate: "2027-03-20" }));
    const plan = planReels(formats, [], [], { today: TODAY, maxPerDay: 2, maxPerWeek: 2 });
    expect(plan.planned.map((item) => item.plannedPublishDate).sort()).toEqual(["2027-03-07", "2027-03-13", "2027-03-13"]);
  });

  it("keeps the 7-day spacing from the longer sibling's actual day after a cap moved it", () => {
    const other = format({ eventId: "x", editionId: "x", raceDate: "2027-03-19", distanceKm: 40 });
    const long = format({ eventId: "y", editionId: "y", raceDate: "2027-03-20", distanceKm: 100 });
    const short = format({ eventId: "y", editionId: "y", raceDate: "2027-03-20", distanceKm: 40 });
    const plan = planReels([other, long, short], [], [], { today: TODAY, occupiedDates: ["2027-03-13"] });
    const day = (id: string) => plan.planned.find((item) => item.raceId === id)?.plannedPublishDate;
    expect(day(other.raceId)).toBe("2027-03-12");
    expect(day(long.raceId)).toBe("2027-03-11");
    expect(day(short.raceId)).toBe("2027-03-04");
  });

  it("skips as too late when no day is left after today + lead time, without compressing", () => {
    // Event in 10 days: longest target is today + 3, the shorter one would need today − 4.
    const long = format({ raceDate: "2026-11-30", distanceKm: 80 });
    const short = format({ raceDate: "2026-11-30", distanceKm: 40 });
    const plan = planReels([long, short], [], [], { today: TODAY });
    expect(plan.planned.map((item) => item.raceId)).toEqual([long.raceId]);
    expect(plan.planned[0].plannedPublishDate).toBe("2026-11-23");
    expect(plan.skipped).toEqual([expect.objectContaining({ raceId: short.raceId, reason: "too_late", targetDate: "2026-11-16" })]);
  });

  it("skips a whole edition that starts too soon", () => {
    const formats = [160, 80, 46, 36].map((km) => format({ raceDate: "2026-11-28", distanceKm: km }));
    const plan = planReels(formats, [], [], { today: TODAY });
    expect(plan.planned).toEqual([]);
    expect(plan.skipped.map((item) => item.reason)).toEqual(["too_late", "too_late", "too_late", "too_late"]);
  });

  it("skips as too late when the caps leave no day in the window", () => {
    const formats = ["a", "b"].map((id) => format({ eventId: id, editionId: id, raceDate: "2026-11-30" }));
    const plan = planReels(formats, [], [], { today: TODAY });
    expect(plan.planned).toHaveLength(1);
    expect(plan.planned[0].plannedPublishDate).toBe("2026-11-23");
    expect(plan.skipped[0].reason).toBe("too_late");
  });

  it("excludes a race with a reel of this edition, but not with last year's", () => {
    const fresh = format({ raceDate: "2027-03-20", distanceKm: 80 });
    const old = format({ raceDate: "2027-03-20", distanceKm: 40, eventId: "z", editionId: "z" });
    const plan = planReels([fresh, old], [
      { raceId: fresh.raceId, createdAt: "2026-11-02T10:00:00Z" },
      { raceId: old.raceId, createdAt: "2026-03-01T10:00:00Z" },
    ], [], { today: TODAY });
    expect(plan.skipped).toEqual([expect.objectContaining({ raceId: fresh.raceId, reason: "duplicate" })]);
    expect(plan.planned.map((item) => item.raceId)).toEqual([old.raceId]);
  });

  it("keeps locked items on their day, counts them in the caps and anchors their siblings on them", () => {
    const long = format({ raceDate: "2027-03-20", distanceKm: 100 });
    const short = format({ raceDate: "2027-03-20", distanceKm: 40 });
    const plan = planReels([long, short], [{ raceId: long.raceId, createdAt: "2027-03-01T00:00:00Z" }], [
      { raceId: long.raceId, editionKey: "edition:edition-a", plannedPublishDate: "2027-03-10", status: "rendering" },
    ], { today: TODAY });
    // The locked item's own render is not a duplicate of itself, and it is not planned again.
    expect(plan.skipped).toEqual([]);
    expect(plan.planned).toEqual([expect.objectContaining({ raceId: short.raceId, plannedPublishDate: "2027-03-03" })]);
  });

  it("leaves excluded and failed items out of the chain without taking a day", () => {
    const long = format({ raceDate: "2027-03-20", distanceKm: 100 });
    const short = format({ raceDate: "2027-03-20", distanceKm: 40 });
    const other = format({ eventId: "o", editionId: "o", raceDate: "2027-03-20", distanceKm: 40 });
    const plan = planReels([long, short, other], [], [
      { raceId: long.raceId, editionKey: "edition:edition-a", plannedPublishDate: "2027-03-13", status: "skipped" },
    ], { today: TODAY });
    const day = (id: string) => plan.planned.find((item) => item.raceId === id)?.plannedPublishDate;
    expect(day(long.raceId)).toBeUndefined();
    // Same event start: the edition keys break the tie ("edition:edition-a" before "edition:o").
    expect(day(short.raceId)).toBe("2027-03-13");
    expect(day(other.raceId)).toBe("2027-03-12");
  });

  it("gives the earlier event the first pick of the days", () => {
    const later = format({ eventId: "late", editionId: "late", raceDate: "2027-03-21" });
    const earlier = format({ eventId: "early", editionId: "early", raceDate: "2027-03-20" });
    const plan = planReels([later, earlier], [], [], { today: TODAY, maxPerWeek: 7 });
    const day = (id: string) => plan.planned.find((item) => item.raceId === id)?.plannedPublishDate;
    expect(day(earlier.raceId)).toBe("2027-03-13");
    expect(day(later.raceId)).toBe("2027-03-14");
  });

  it("is deterministic whatever the input order", () => {
    const formats = Array.from({ length: 12 }, (_, index) => format({
      eventId: `e${index % 4}`,
      editionId: `e${index % 4}`,
      raceDate: `2027-0${3 + (index % 3)}-1${index % 4}`,
      distanceKm: 30 + index * 7,
    }));
    const first = planReels(formats, [], [], { today: TODAY });
    const second = planReels([...formats].reverse(), [], [], { today: TODAY });
    expect(second).toEqual(first);
    const days = first.planned.map((item) => item.plannedPublishDate);
    expect(new Set(days).size).toBe(days.length);
  });
});

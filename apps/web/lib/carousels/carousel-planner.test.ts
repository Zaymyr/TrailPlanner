import { describe, expect, it } from "vitest";

import { planReels, type PlannerFormat } from "../reel-planner";
import { diffCarouselPlan, isRecomputableCarousel, type CarouselItem } from "./carousel-automation";
import { carouselWeekdays, pickRace, planCarousels, slotDays, type CarouselFormat, type CarouselPlanOptions } from "./carousel-planner";

const TODAY = "2026-11-20"; // a Friday

let counter = 0;
const format = (overrides: Partial<CarouselFormat> = {}): CarouselFormat => {
  counter += 1;
  return {
    raceId: `race-${String(counter).padStart(3, "0")}`,
    name: `Trail ${counter}`,
    distanceKm: 42,
    elevationGainM: 1_500,
    isLive: true,
    hasGpx: true,
    aidStationCount: 3,
    participationMode: "solo",
    raceDate: "2026-12-20",
    editionStartDate: null,
    eventDate: null,
    eventId: `event-${counter}`,
    editionId: `edition-${counter}`,
    ...overrides,
  };
};

const options = (overrides: Partial<CarouselPlanOptions> = {}): CarouselPlanOptions => ({
  today: TODAY,
  leadDays: 3,
  enabledSeries: ["plan", "brief", "week"],
  occupiedDates: [],
  weekEventCounts: {},
  ...overrides,
});

describe("weekday slots", () => {
  it("puts the plan on Tuesday, the brief on Thursday and the week on Sunday", () => {
    expect(slotDays("plan", TODAY)).toEqual(["2026-11-24", "2026-12-01", "2026-12-08"]);
    expect(slotDays("brief", TODAY)).toEqual(["2026-11-26", "2026-12-03", "2026-12-10"]);
    expect(slotDays("week", TODAY)).toEqual(["2026-11-22", "2026-11-29", "2026-12-06"]);
    expect(carouselWeekdays(["plan", "week"])).toEqual([2, 0]);
  });

  it("plans only the enabled series and skips slots inside the lead time", () => {
    const slots = planCarousels([], [], [], options({ enabledSeries: ["week"], weekEventCounts: { "2026-11-30": 4 } }));
    expect(slots.map((slot) => [slot.plannedPublishDate, slot.status, slot.reason, slot.weekStart])).toEqual([
      ["2026-11-22", "skipped", "too_late", null],
      ["2026-11-29", "planned", null, "2026-11-30"],
      ["2026-12-06", "skipped", "no_candidate", "2026-12-07"],
    ]);
  });

  it("skips a slot whose day another publication takes", () => {
    const slots = planCarousels([], [], [], options({ enabledSeries: ["week"], occupiedDates: ["2026-11-29"], weekEventCounts: { "2026-11-30": 2 } }));
    expect(slots.find((slot) => slot.plannedPublishDate === "2026-11-29")?.reason).toBe("occupied");
  });
});

describe("race choice", () => {
  it("takes a plan race 2 to 4 weeks out and a brief race 7 to 14 days out", () => {
    const tooSoon = format({ raceDate: "2026-12-10" });
    const planRace = format({ raceDate: "2026-12-20" });
    expect(pickRace("plan", "2026-12-01", [tooSoon, planRace], [], new Set())?.format.raceId).toBe(planRace.raceId);
    expect(pickRace("brief", "2026-12-03", [tooSoon, planRace], [], new Set())?.format.raceId).toBe(tooSoon.raceId);
  });

  it("needs a D+ for the plan and aid stations for the brief, and never a team format", () => {
    expect(pickRace("plan", "2026-12-01", [format({ elevationGainM: null })], [], new Set())).toBeNull();
    expect(pickRace("brief", "2026-12-03", [format({ raceDate: "2026-12-12", aidStationCount: 0 })], [], new Set())).toBeNull();
    expect(pickRace("plan", "2026-12-01", [format({ name: "Relais des crêtes" })], [], new Set())).toBeNull();
  });

  it("prefers a race not covered yet by a reel or a carousel", () => {
    const covered = format({ raceDate: "2026-12-16" });
    const fresh = format({ raceDate: "2026-12-26" });
    const picked = pickRace("plan", "2026-12-01", [covered, fresh], [{ raceId: covered.raceId, createdAt: "2026-11-01T10:00:00Z", kind: "reel", series: null }], new Set());
    expect(picked?.format.raceId).toBe(fresh.raceId);
  });

  it("never picks an edition with a post of the same series, nor one used twice", () => {
    const race = format({ raceDate: "2026-12-20" });
    expect(pickRace("plan", "2026-12-01", [race], [{ raceId: race.raceId, createdAt: "2026-11-15T10:00:00Z", kind: "carousel", series: "plan" }], new Set())).toBeNull();
    expect(pickRace("brief", "2026-12-10", [race], [{ raceId: race.raceId, createdAt: "2026-11-15T10:00:00Z", kind: "carousel", series: "plan" }], new Set())?.format.raceId).toBe(race.raceId);
    const slots = planCarousels([race], [], [], options({ enabledSeries: ["plan"] }));
    expect(slots.filter((slot) => slot.raceId === race.raceId)).toHaveLength(1);
  });

  it("keeps locked slots and counts their edition as used", () => {
    const race = format({ raceDate: "2026-12-20" });
    const slots = planCarousels([race], [], [{ series: "plan", plannedPublishDate: "2026-12-01", status: "drafted", editionKey: `edition:${race.editionId}` }], options({ enabledSeries: ["plan"] }));
    expect(slots.find((slot) => slot.plannedPublishDate === "2026-12-01")).toBeUndefined();
    expect(slots.some((slot) => slot.raceId === race.raceId)).toBe(false);
  });
});

describe("cross-type daily cap", () => {
  const reelFormat = (overrides: Partial<PlannerFormat> = {}): PlannerFormat => ({
    raceId: "reel-1", name: "Trail", distanceKm: 42, isLive: true, hasGpx: true, aidStationCount: 2,
    raceDate: "2027-03-17", editionStartDate: null, eventDate: null, eventId: "e", editionId: "ed", ...overrides,
  });

  it("moves a reel off a weekday reserved for carousels", () => {
    // Race on Thursday 2027-03-18: target Thursday 03-11, reserved for « Le brief » → Wednesday 03-10.
    const thursday = reelFormat({ raceDate: "2027-03-18" });
    expect(planReels([thursday], [], [], { today: TODAY }).planned[0].plannedPublishDate).toBe("2027-03-11");
    expect(planReels([thursday], [], [], { today: TODAY, blockedWeekdays: carouselWeekdays(["brief"]) }).planned[0].plannedPublishDate).toBe("2027-03-10");
  });
});

describe("slot diff", () => {
  const item = (overrides: Partial<CarouselItem> = {}): CarouselItem => ({
    id: "00000000-0000-4000-8000-000000000001", series: "plan", planned_publish_date: "2026-11-24", race_id: null, edition_key: null, week_start: null,
    status: "planned", step: null, attempts: 0, error: null, reason: null, work: null, carousel_job_id: null, social_post_id: null,
    locked_until: null, created_at: "", updated_at: "", ...overrides,
  });

  it("recomputes planned slots and automatic skips only", () => {
    expect(isRecomputableCarousel({ status: "skipped", reason: "no_candidate" })).toBe(true);
    expect(isRecomputableCarousel({ status: "skipped", reason: "excluded" })).toBe(false);
    expect(isRecomputableCarousel({ status: "generating", reason: null })).toBe(false);
  });

  it("marks a past planned slot too late and deletes a future slot of a disabled series", () => {
    const past = item({ id: "00000000-0000-4000-8000-000000000002", planned_publish_date: "2026-11-17" });
    const future = item({ id: "00000000-0000-4000-8000-000000000003", planned_publish_date: "2026-12-01" });
    const changes = diffCarouselPlan([past, future], [], TODAY);
    expect(changes.updates).toEqual([{ id: past.id, patch: { status: "skipped", reason: "too_late", error: null } }]);
    expect(changes.deletes).toEqual([future.id]);
  });

  it("updates a planned slot whose race changed", () => {
    const changes = diffCarouselPlan([item({ planned_publish_date: "2026-12-01", race_id: "a" })], [{
      series: "plan", plannedPublishDate: "2026-12-01", status: "planned", reason: null, raceId: "b", editionKey: "edition:b", weekStart: null, raceName: "B",
    }], TODAY);
    expect(changes.updates[0].patch).toMatchObject({ race_id: "b", edition_key: "edition:b" });
  });
});

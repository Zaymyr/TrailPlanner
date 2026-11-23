import { describe, expect, it } from "vitest";
import {
  buildContinuousIntakeTimeline,
  buildContinuousSections,
  buildSectionTimelineFromContinuous,
  compactPlanTimeline,
} from "@trailplanner/shared";

import type { ElevationPoint, FormValues } from "../app/(planner)/race-planner/types";
import {
  buildPlanChronology,
  getChronologyEventKind,
  toPlanTimelineProductMap,
  toPlanTimelineValues,
} from "./plan-chronology";
import type { FuelProduct } from "./product-types";

function product(overrides: Partial<FuelProduct> & Pick<FuelProduct, "id" | "name" | "fuelType">): FuelProduct {
  return {
    slug: overrides.id,
    caloriesKcal: 100,
    carbsGrams: 0,
    sodiumMg: 0,
    proteinGrams: 0,
    fatGrams: 0,
    ...overrides,
  };
}

const products: FuelProduct[] = [
  product({ id: "gel", name: "Gel 25", fuelType: "gel", carbsGrams: 25, sodiumMg: 50 }),
  product({ id: "bar", name: "Barre 40", fuelType: "bar", carbsGrams: 40, sodiumMg: 120 }),
  product({ id: "drink", name: "Boisson 30", fuelType: "drink_mix", carbsGrams: 30, sodiumMg: 300 }),
];

const elevationProfile: ElevationPoint[] = Array.from({ length: 25 }, (_, index) => ({
  distanceKm: index,
  elevationM: 400 + Math.round(300 * Math.sin(index / 4)),
}));

function buildValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    raceDistanceKm: 24,
    elevationGain: 900,
    fatigueLevel: 0.5,
    paceType: "pace",
    paceMinutes: 7,
    paceSeconds: 0,
    speedKph: 10,
    targetIntakePerHour: 70,
    waterIntakePerHour: 500,
    sodiumIntakePerHour: 600,
    waterBagLiters: 1.5,
    startSupplies: [
      { productId: "gel", quantity: 3 },
      { productId: "drink", quantity: 1 },
    ],
    aidStations: [
      { name: "Refuge", distanceKm: 12, waterRefill: true, pauseMinutes: 2, supplies: [{ productId: "bar", quantity: 2 }] },
    ],
    ...overrides,
  };
}

describe("buildPlanChronology", () => {
  it("returns one section per leg with ordered events inside each section window", () => {
    const sections = buildPlanChronology({
      values: buildValues(),
      elevationProfile,
      products,
      startName: "Chamonix",
      finishName: "Arrivée Chamonix",
    });

    expect(sections).toHaveLength(2);
    expect(sections.map((section) => [section.key, section.fromName, section.toName])).toEqual([
      ["section-0", "Chamonix", "Refuge"],
      ["section-1", "Refuge", "Arrivée Chamonix"],
    ]);
    expect(sections[1].startMinute).toBeGreaterThan(sections[0].startMinute);
    expect(sections[0].dPlus).toBeGreaterThan(0);

    sections.forEach((section) => {
      expect(section.events.length).toBeGreaterThan(0);
      const minutes = section.events.map((event) => event.minute);
      expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
      minutes.forEach((minute) => {
        expect(minute).toBeGreaterThanOrEqual(section.startMinute);
        expect(minute).toBeLessThanOrEqual(section.startMinute + Math.ceil(section.durationMin) + 5);
      });
    });

    const allKinds = new Set(sections.flatMap((section) => section.events.map((event) => event.kind)));
    expect(allKinds.has("carbs")).toBe(true);
    expect(sections[1].events.some((event) => event.label === "Barre 40")).toBe(true);
  });

  it("falls back to compacted water reminders when no supplies are planned", () => {
    const sections = buildPlanChronology({
      values: buildValues({ startSupplies: [], aidStations: [{ name: "Refuge", distanceKm: 12, waterRefill: true }] }),
      elevationProfile: [],
      products,
      startName: "Départ",
      finishName: "Arrivée",
    });

    expect(sections).toHaveLength(2);
    sections.forEach((section) => {
      expect(section.events.length).toBeGreaterThan(0);
      section.events.forEach((event) => {
        expect(event.label).toBe("Eau");
        expect(event.kind).toBe("water");
      });
      // compactPlanTimeline drops consecutive identical plain-water reminders.
      const details = section.events.map((event) => event.detail);
      details.slice(1).forEach((detail, index) => expect(detail).not.toBe(details[index]));
    });
  });

  it("returns exactly what the shared engine computes for the same values (no divergence)", () => {
    const values = buildValues();
    const engineValues = toPlanTimelineValues(values);
    const productMap = toPlanTimelineProductMap(products);
    const engineSections = buildContinuousSections({ values: engineValues, elevationProfile });
    const engineTimeline = buildContinuousIntakeTimeline({ values: engineValues, productMap, elevationProfile });

    const expected = engineSections.map((section) =>
      compactPlanTimeline(buildSectionTimelineFromContinuous(engineTimeline, section)).map((item) => ({
        minute: section.startMinute + item.minute,
        label: item.label,
        detail: item.detail,
      })),
    );

    const actual = buildPlanChronology({ values, elevationProfile, products, startName: "Départ", finishName: "Arrivée" }).map(
      (section) => section.events.map(({ minute, label, detail }) => ({ minute, label, detail })),
    );

    expect(actual).toEqual(expected);
    expect(engineValues.aidStations.map((station) => station.id ?? station.name)).toEqual(["depart", "Refuge", "arrivee"]);
  });

  it("drops supplies at stations without assistance, like the mobile normalization", () => {
    const values = toPlanTimelineValues(
      buildValues({
        aidStations: [
          { name: "Refuge", distanceKm: 12, assistanceAllowed: false, supplies: [{ productId: "bar", quantity: 2 }] },
        ],
      }),
    );
    expect(values.aidStations[1]).toMatchObject({ waterRefill: true, assistanceAllowed: false, supplies: [] });
  });
});

describe("getChronologyEventKind", () => {
  it("classifies events by their nutrients", () => {
    expect(getChronologyEventKind({ minute: 0, label: "Gel", detail: "", carbsGrams: 25, sodiumMg: 50 })).toBe("carbs");
    expect(getChronologyEventKind({ minute: 0, label: "Eau", detail: "", waterMl: 150 })).toBe("water");
    expect(getChronologyEventKind({ minute: 0, label: "Sel", detail: "", sodiumMg: 200, waterMl: 0 })).toBe("sodium");
    expect(getChronologyEventKind({ minute: 0, label: "Elec", detail: "", sodiumMg: 200, waterMl: 150 })).toBe("mixed");
  });
});

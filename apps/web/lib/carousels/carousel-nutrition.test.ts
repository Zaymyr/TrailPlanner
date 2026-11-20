import { describe, expect, it } from "vitest";

import {
  allocateGrams,
  buildHourPages,
  buildSectionPages,
  buildSentence,
  computePlanNutrition,
  mergeShortLegs,
  roundObjectiveHours,
  type CarouselObjective,
} from "./carousel-nutrition";

const saintelyon = {
  distanceKm: 80,
  elevationGainM: 2_500,
  elevationLossM: 2_650,
  points: null,
  aidStations: [
    { name: "Saint-Christo-en-Jarez", distanceKm: 17 },
    { name: "Sainte-Catherine", distanceKm: 32 },
    { name: "Saint-Genou", distanceKm: 46 },
    { name: "Soucieu-en-Jarrest", distanceKm: 60 },
    { name: "Chaponost", distanceKm: 67 },
  ],
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

describe("gram allocation", () => {
  it("splits a total into multiples of 5 that add up exactly", () => {
    const grams = allocateGrams([10.3, 22.9, 7.1, 40.2], 205);
    expect(sum(grams)).toBe(205);
    grams.forEach((value) => expect(value % 5).toBe(0));
  });

  it("gives everything to the last part when all weights are zero", () => {
    expect(allocateGrams([0, 0, 0], 60)).toEqual([0, 0, 60]);
  });

  it("rounds objectives like a runner: whole hours from 5 h, half hours below", () => {
    expect(roundObjectiveHours(12.4 * 3_600)).toBe(12);
    expect(roundObjectiveHours(3.3 * 3_600)).toBe(3.5);
    expect(roundObjectiveHours(600)).toBe(0.5);
  });
});

describe("sections", () => {
  const legs = (kms: number[]) => kms.slice(1).map((toKm, index) => ({ fromKm: kms[index], toKm, seconds: (toKm - kms[index]) * 600 }));

  it("uses tall rows up to 6 sections and compact rows from 7 to 14", () => {
    expect(buildSectionPages(legs([0, 10, 20, 30, 40, 50, 60]), 60, 600).density).toBe("tall");
    const compact = buildSectionPages(legs([0, 10, 20, 30, 40, 50, 60, 70]), 60, 700);
    expect(compact.density).toBe("compact");
    expect(compact.pages).toHaveLength(1);
  });

  it("merges sections under 5 km into the next one beyond 14, else adds a fourth slide", () => {
    const short = legs([0, 3, 10, 12, 20, 24, 30, 33, 40, 42, 50, 53, 60, 62, 70, 73, 80]);
    const merged = buildSectionPages(short, 60, 800);
    expect(merged.pages).toHaveLength(1);
    expect(merged.pages[0].every((row) => row.lengthKm >= 5)).toBe(true);
    const long = legs(Array.from({ length: 21 }, (_, index) => index * 6));
    const split = buildSectionPages(long, 60, 1_200);
    expect(split.pages).toHaveLength(2);
    expect(sum(split.pages.flat().map((row) => row.grams))).toBe(1_200);
    expect(split.pages[1][split.pages[1].length - 1].cumul).toBe(1_200);
  });

  it("merges a short last section into the previous one", () => {
    expect(mergeShortLegs(legs([0, 10, 20, 22]))).toEqual([
      { fromKm: 0, toKm: 10, seconds: 6_000 },
      { fromKm: 10, toKm: 22, seconds: 7_200 },
    ]);
  });

  it("cumulates the gauge: eaten before, this section, total", () => {
    const { pages } = buildSectionPages(legs([0, 20, 40, 60]), 60, 600);
    expect(pages[0].map((row) => [row.doneBefore, row.cumul])).toEqual([[0, 200], [200, 400], [400, 600]]);
  });
});

describe("hour by hour (no aid station)", () => {
  it("cuts the objective into hourly rows that add up", () => {
    const timeline = [{ km: 0, seconds: 0 }, { km: 30, seconds: 5 * 3_600 }];
    const { pages, density } = buildHourPages(5, timeline, 60, 300);
    expect(pages[0]).toHaveLength(5);
    expect(density).toBe("tall");
    expect(pages[0][0]).toMatchObject({ fromHour: 0, toHour: 1, fromKm: 0, toKm: 6, grams: 60 });
    expect(sum(pages[0].map((row) => row.grams))).toBe(300);
  });

  it("groups hours into blocks so an ultra keeps 12 rows at most", () => {
    const timeline = [{ km: 0, seconds: 0 }, { km: 170, seconds: 36 * 3_600 }];
    const rows = buildHourPages(36, timeline, 60, 2_160).pages[0];
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ fromHour: 0, toHour: 3 });
  });
});

describe("computePlanNutrition", () => {
  it("builds three distinct objectives from the course page reference levels, and totals that add up", () => {
    const result = computePlanNutrition(saintelyon);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { objectives, pages, total, middleIndex, rowsMode } = result.value;
    expect(objectives.map((objective) => objective.key)).toEqual(["confirmed", "regular", "discovery"]);
    expect(objectives[0].hours).toBeLessThan(objectives[1].hours);
    expect(objectives[1].hours).toBeLessThan(objectives[2].hours);
    objectives.forEach((objective) => {
      expect(objective.totalCarbsG % 5).toBe(0);
      expect(Math.abs(objective.totalCarbsG - objective.carbsPerHour * objective.hours)).toBeLessThanOrEqual(2.5);
      // Onboarding estimate: 500 ml + 150 ml above 800 m D+, 400 mg of sodium.
      expect(objective.waterMlPerHour).toBe(650);
      expect(objective.sodiumMgPerHour).toBe(400);
    });
    expect(total).toBe(objectives[middleIndex].totalCarbsG);
    expect(rowsMode).toBe("sections");
    expect(pages[0]).toHaveLength(6);
    expect(sum(pages[0].map((row) => row.grams))).toBe(total);
  });

  it("falls back to hour-by-hour rows without aid stations", () => {
    const result = computePlanNutrition({ ...saintelyon, aidStations: [] });
    expect(result.ok && result.value.rowsMode).toBe("hours");
  });

  it("refuses a race without D+ or distance instead of inventing a figure", () => {
    expect(computePlanNutrition({ ...saintelyon, elevationGainM: null })).toEqual({ ok: false, reason: "D+ inconnu." });
    expect(computePlanNutrition({ ...saintelyon, distanceKm: null }).ok).toBe(false);
  });
});

describe("sentence", () => {
  const objective = (carbsPerHour: number, totalCarbsG: number) => ({ carbsPerHour, totalCarbsG }) as CarouselObjective;
  it("keeps the validated sentence only when both halves are true", () => {
    expect(buildSentence([objective(80, 720), objective(70, 840), objective(60, 900)]).map((part) => part.text).join(""))
      .toBe("Plus tu vas vite, plus tu dois manger par heure. Plus tu restes dehors, plus le total grimpe.");
    expect(buildSentence([objective(60, 540), objective(60, 720), objective(60, 900)]).map((part) => part.text).join(""))
      .toContain("Même rythme par heure");
    expect(buildSentence([objective(80, 900), objective(70, 840), objective(60, 720)]).map((part) => part.text).join(""))
      .toBe("Plus tu vas vite, plus tu dois manger par heure.");
  });
});

import { describe, expect, it } from "vitest";
import {
  dedupeAidStations,
  sanitizeAidStations,
  sanitizeSegmentPlan,
} from "../plan-sanitizers";

describe("sanitizeSegmentPlan", () => {
  it("returns an empty object for null input", () => {
    expect(sanitizeSegmentPlan(null)).toEqual({});
  });

  it("returns an empty object for non-object input", () => {
    expect(sanitizeSegmentPlan("invalid")).toEqual({});
    expect(sanitizeSegmentPlan(42)).toEqual({});
  });

  it("keeps valid non-negative numbers", () => {
    const plan = sanitizeSegmentPlan({ pauseMinutes: 5, gelsPlanned: 2 });
    expect(plan.pauseMinutes).toBe(5);
    expect(plan.gelsPlanned).toBe(2);
  });

  it("strips negative values for non-negative fields", () => {
    const plan = sanitizeSegmentPlan({ pauseMinutes: -1, gelsPlanned: -3 });
    expect(plan.pauseMinutes).toBeUndefined();
    expect(plan.gelsPlanned).toBeUndefined();
  });

  it("strips Infinity from non-negative fields", () => {
    const plan = sanitizeSegmentPlan({ pauseMinutes: Infinity, gelsPlanned: Infinity });
    expect(plan.pauseMinutes).toBeUndefined();
    expect(plan.gelsPlanned).toBeUndefined();
  });

  it("strips NaN from all numeric fields", () => {
    const plan = sanitizeSegmentPlan({ pauseMinutes: NaN, paceAdjustmentMinutesPerKm: NaN });
    expect(plan.pauseMinutes).toBeUndefined();
    expect(plan.paceAdjustmentMinutesPerKm).toBeUndefined();
  });

  it("allows negative paceAdjustmentMinutesPerKm", () => {
    const plan = sanitizeSegmentPlan({ paceAdjustmentMinutesPerKm: -1 });
    expect(plan.paceAdjustmentMinutesPerKm).toBe(-1);
  });

  it("strips supplies with missing productId or quantity", () => {
    const plan = sanitizeSegmentPlan({
      supplies: [
        { productId: "abc", quantity: 2 },
        { productId: null, quantity: 1 },
        { productId: "def", quantity: -1 },
      ],
    });
    expect(plan.supplies).toHaveLength(1);
    expect(plan.supplies?.[0].productId).toBe("abc");
  });
});

describe("sanitizeAidStations", () => {
  it("returns empty array for undefined input", () => {
    expect(sanitizeAidStations(undefined)).toEqual([]);
  });

  it("skips stations missing name or distanceKm", () => {
    const result = sanitizeAidStations([
      { name: "A", distanceKm: 5 },
      { distanceKm: 10 } as never,
      { name: "B" } as never,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("A");
  });

  it("defaults waterRefill to true when missing", () => {
    const result = sanitizeAidStations([{ name: "A", distanceKm: 5 }]);
    expect(result[0].waterRefill).toBe(true);
  });

  it("respects explicit waterRefill: false", () => {
    const result = sanitizeAidStations([{ name: "A", distanceKm: 5, waterRefill: false }]);
    expect(result[0].waterRefill).toBe(false);
  });
});

describe("dedupeAidStations", () => {
  it("removes stations with identical name and distance", () => {
    const result = dedupeAidStations([
      { name: "Col", distanceKm: 10, waterRefill: true },
      { name: "Col", distanceKm: 10, waterRefill: false },
      { name: "Col", distanceKm: 20, waterRefill: true },
    ]);
    // keeps first occurrence of Col@10, and Col@20
    expect(result).toHaveLength(2);
    expect(result[0].distanceKm).toBe(10);
    expect(result[1].distanceKm).toBe(20);
  });

  it("keeps stations with same name but different distance", () => {
    const result = dedupeAidStations([
      { name: "Refuge", distanceKm: 5, waterRefill: true },
      { name: "Refuge", distanceKm: 15, waterRefill: true },
    ]);
    expect(result).toHaveLength(2);
  });

  it("sorts stations by distance ascending", () => {
    const result = dedupeAidStations([
      { name: "B", distanceKm: 20, waterRefill: true },
      { name: "A", distanceKm: 5, waterRefill: true },
      { name: "C", distanceKm: 12, waterRefill: true },
    ]);
    expect(result.map((s) => s.distanceKm)).toEqual([5, 12, 20]);
  });

  it("returns empty array for empty input", () => {
    expect(dedupeAidStations([])).toEqual([]);
  });
});

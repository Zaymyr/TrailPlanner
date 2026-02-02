import { describe, expect, it } from "vitest";

import type { FuelProduct } from "../../../../lib/product-types";
import type { Segment } from "../../types";
import { buildAidStationPickList } from "../aid-station-picklist";

const baseSegment: Segment = {
  checkpoint: "Aid 1",
  from: "Start",
  startDistanceKm: 0,
  distanceKm: 10,
  segmentKm: 10,
  etaMinutes: 60,
  segmentMinutes: 60,
  estimatedSegmentMinutes: 60,
  fuelGrams: 60,
  waterMl: 500,
  sodiumMg: 600,
  plannedFuelGrams: 60,
  plannedWaterMl: 500,
  plannedSodiumMg: 600,
  targetFuelGrams: 60,
  targetWaterMl: 500,
  targetSodiumMg: 600,
  gelsPlanned: 2,
  recommendedGels: 2,
  waterCapacityMl: 1000,
};

const products: FuelProduct[] = [
  {
    id: "gel-1",
    slug: "gel-1",
    name: "Gel",
    fuelType: "gel",
    caloriesKcal: 100,
    carbsGrams: 25,
    sodiumMg: 100,
    proteinGrams: 0,
    fatGrams: 0,
  },
  {
    id: "capsule-1",
    slug: "capsule-1",
    name: "Sodium capsule",
    fuelType: "capsule",
    caloriesKcal: 0,
    carbsGrams: 0,
    sodiumMg: 200,
    proteinGrams: 0,
    fatGrams: 0,
  },
];

describe("buildAidStationPickList", () => {
  it("builds a pick list that meets coverage targets", () => {
    const result = buildAidStationPickList(baseSegment, products, { minCoveragePercent: 0.95 });

    expect(result.items.some((item) => item.type === "water")).toBe(true);
    expect(result.coverage.carbs).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage.sodium).toBeGreaterThanOrEqual(0.95);
  });

  it("falls back to an estimate when no products are configured", () => {
    const result = buildAidStationPickList(baseSegment, []);

    expect(result.isEstimate).toBe(true);
    expect(result.items.some((item) => item.type === "estimate")).toBe(true);
  });
});

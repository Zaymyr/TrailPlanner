import { describe, expect, it } from "vitest";

import type { FuelProduct } from "../../../../../lib/product-types";
import type { Segment } from "../../types";
import { buildCarryoverCoverageByItemId } from "../../../../../components/race-planner/carryoverNutrition";

const gel: FuelProduct = {
  id: "gel",
  slug: "gel",
  name: "Gel",
  fuelType: "gel",
  caloriesKcal: 100,
  carbsGrams: 25,
  sodiumMg: 0,
  proteinGrams: 0,
  fatGrams: 0,
};

const buildSegment = (id: string, targetFuelGrams: number): Segment => ({
  checkpoint: id,
  from: "previous",
  startDistanceKm: 0,
  distanceKm: 10,
  segmentKm: 10,
  etaMinutes: 60,
  segmentMinutes: 60,
  estimatedSegmentMinutes: 60,
  fuelGrams: targetFuelGrams,
  waterMl: 0,
  sodiumMg: 0,
  plannedFuelGrams: targetFuelGrams,
  plannedWaterMl: 0,
  plannedSodiumMg: 0,
  targetFuelGrams,
  targetWaterMl: 0,
  targetSodiumMg: 0,
  gelsPlanned: 0,
  recommendedGels: 0,
});

describe("buildCarryoverCoverageByItemId", () => {
  it("carries whole product units and nutrient surplus across aid stations", () => {
    const firstSegment = buildSegment("Aid 1", 40);
    const secondSegment = buildSegment("Aid 2", 40);
    const coverage = buildCarryoverCoverageByItemId(
      [
        { id: "start", isStart: true, upcomingSegment: firstSegment },
        { id: "aid-1", checkpointSegment: firstSegment, upcomingSegment: secondSegment },
      ],
      [{ productId: "gel", quantity: 4 }],
      { gel }
    );

    expect(coverage.get("start")?.consumedSupplies).toEqual([{ productId: "gel", quantity: 2 }]);
    expect(coverage.get("start")?.currentCarbs).toBe(50);
    expect(coverage.get("aid-1")?.consumedSupplies).toEqual([{ productId: "gel", quantity: 2 }]);
    expect(coverage.get("aid-1")?.currentCarbs).toBe(60);
  });

  it("does not add checkpoint supplies when solid refills are disabled", () => {
    const firstSegment = buildSegment("Aid 1", 25);
    const secondSegment = { ...buildSegment("Aid 2", 25), solidRefill: false, supplies: [{ productId: "gel", quantity: 2 }] };
    const coverage = buildCarryoverCoverageByItemId(
      [
        { id: "start", isStart: true, upcomingSegment: firstSegment },
        { id: "aid-1", checkpointSegment: secondSegment, upcomingSegment: buildSegment("Aid 3", 25) },
      ],
      [{ productId: "gel", quantity: 1 }],
      { gel }
    );

    expect(coverage.get("start")?.currentCarbs).toBe(25);
    expect(coverage.get("aid-1")?.currentCarbs).toBe(0);
  });
});

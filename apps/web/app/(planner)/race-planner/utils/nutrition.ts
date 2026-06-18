import type { FuelProduct } from "../../../../lib/product-types";
import type { Segment } from "../types";

export type RaceTotals = {
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
  durationMinutes: number;
};

export type FuelProductEstimate = FuelProduct & { count: number };

export const buildRaceTotals = (segments: Segment[]): RaceTotals | null => {
  if (segments.length === 0) return null;

  return segments.reduce(
    (totals, segment) => ({
      fuelGrams: totals.fuelGrams + segment.plannedFuelGrams,
      waterMl: totals.waterMl + segment.plannedWaterMl,
      sodiumMg: totals.sodiumMg + segment.plannedSodiumMg,
      durationMinutes: totals.durationMinutes + segment.segmentMinutes,
    }),
    { fuelGrams: 0, waterMl: 0, sodiumMg: 0, durationMinutes: 0 }
  );
};

export const buildFuelProductEstimates = (
  products: FuelProduct[],
  raceTotals: RaceTotals | null
): FuelProductEstimate[] => {
  if (!raceTotals) return [];

  return products.map((product) => ({
    ...product,
    count: product.carbsGrams > 0 ? Math.ceil(raceTotals.fuelGrams / product.carbsGrams) : 0,
  }));
};

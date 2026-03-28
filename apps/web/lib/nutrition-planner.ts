import type { AidStation } from "../app/(coach)/race-planner/types";
import type { FuelProduct } from "./product-types";

export type NutritionItem = {
  fuelType: string;
  productId: string;
  productName: string;
  quantity: number;
  carbsG: number;
  sodiumMg?: number;
};

// Each group is processed in order; within a group, all selected types are handled.
// Priority 1: multi-nutrient drinks (carbs + sodium + 500ml water per serving)
// Priority 2: gels (carbs + some sodium)
// Priority 3: solid food (carbs + sodium)
// Priority 4: capsules (sodium top-up only, allocated after carb sources)
const PRIORITY_GROUPS: string[][] = [
  ["electrolyte", "drink_mix"],
  ["gel"],
  ["bar", "real_food"],
  ["capsule"],
];

function allocateSegmentNutrition(
  fuelTypes: string[],
  products: FuelProduct[],
  segmentDurationH: number,
  targetCarbsPerHour: number,
  targetSodiumPerHour: number,
  targetWaterPerHour: number,
): NutritionItem[] {
  const carbsNeeded = segmentDurationH * targetCarbsPerHour;
  const sodiumNeeded = segmentDurationH * targetSodiumPerHour;
  const waterNeeded = segmentDurationH * targetWaterPerHour;

  let carbsRemaining = carbsNeeded;
  let sodiumRemaining = sodiumNeeded;
  let waterRemaining = waterNeeded;

  const nutrition: NutritionItem[] = [];

  for (let groupIndex = 0; groupIndex < PRIORITY_GROUPS.length; groupIndex++) {
    const group = PRIORITY_GROUPS[groupIndex];
    const isElectrolyte = groupIndex === 0;
    const isCapsule = groupIndex === PRIORITY_GROUPS.length - 1;

    for (const fuelType of fuelTypes.filter((t) => group.includes(t))) {
      const product = products.find((p) => p.fuelType === fuelType);
      if (!product) continue;

      if (isCapsule) {
        // Sodium-only supplement — fills residual sodium gap after carb sources
        if (product.sodiumMg <= 0) continue;
        const sodiumResidual = Math.max(0, sodiumRemaining);
        const hardCap = Math.ceil((sodiumNeeded * 0.5) / product.sodiumMg);
        const units = Math.min(Math.max(0, Math.round(sodiumResidual / product.sodiumMg)), hardCap);
        if (units === 0) continue;
        nutrition.push({
          fuelType,
          productId: product.id,
          productName: product.name,
          quantity: units,
          carbsG: units * product.carbsGrams,
          sodiumMg: units * product.sodiumMg,
        });
      } else {
        // Carb-bearing product
        if (product.carbsGrams <= 0) continue;
        let units = Math.round(carbsRemaining / product.carbsGrams);
        if (isElectrolyte) {
          // Electrolyte servings provide 500ml water each — cap to avoid over-hydration
          units = Math.min(units, Math.ceil(waterNeeded / 500));
        }
        units = Math.max(0, units);
        if (units === 0) continue;

        const carbsConsumed = units * product.carbsGrams;
        const sodiumConsumed = units * product.sodiumMg;
        const waterConsumed = isElectrolyte ? units * 500 : 0;

        carbsRemaining = Math.max(0, carbsRemaining - carbsConsumed);
        sodiumRemaining = Math.max(0, sodiumRemaining - sodiumConsumed);
        waterRemaining = Math.max(0, waterRemaining - waterConsumed);

        nutrition.push({
          fuelType,
          productId: product.id,
          productName: product.name,
          quantity: units,
          carbsG: carbsConsumed,
          sodiumMg: sodiumConsumed,
        });
      }
    }
  }

  return nutrition;
}

export function computeAidStationNutrition(
  aidStations: AidStation[],
  fuelTypes: string[],
  targetCarbsPerHour: number,
  speedKph: number,
  products: FuelProduct[],
  weights?: Record<string, number>,
  targetSodiumPerHour?: number,
  targetWaterPerHour?: number,
): AidStation[] {
  if (fuelTypes.length === 0 || speedKph <= 0) {
    return aidStations;
  }

  const sorted = [...aidStations].sort((a, b) => a.distanceKm - b.distanceKm);

  // Priority-based algorithm when sodium + water targets are supplied
  if (targetSodiumPerHour !== undefined && targetWaterPerHour !== undefined) {
    return sorted.map((station, i) => {
      const prevDistanceKm = i === 0 ? 0 : sorted[i - 1].distanceKm;
      const segmentDurationH = (station.distanceKm - prevDistanceKm) / speedKph;
      const nutrition = allocateSegmentNutrition(
        fuelTypes,
        products,
        segmentDurationH,
        targetCarbsPerHour,
        targetSodiumPerHour,
        targetWaterPerHour,
      );
      return { ...station, nutrition };
    });
  }

  // Legacy algorithm (used by API route): proportional carb split by weight
  const totalWeight = fuelTypes.reduce((s, t) => s + (weights?.[t] ?? 1), 0);

  return sorted.map((station, i) => {
    const prevDistanceKm = i === 0 ? 0 : sorted[i - 1].distanceKm;
    const distanceSinceLast = station.distanceKm - prevDistanceKm;
    const hoursToStation = distanceSinceLast / speedKph;
    const totalCarbsNeeded = targetCarbsPerHour * hoursToStation;

    const nutrition: NutritionItem[] = [];

    for (const fuelType of fuelTypes) {
      const product = products.find((p) => p.fuelType === fuelType);
      if (!product || product.carbsGrams <= 0) continue;

      const carbsForThisType = totalCarbsNeeded * ((weights?.[fuelType] ?? 1) / totalWeight);
      const rawQuantity = carbsForThisType / product.carbsGrams;
      const quantity = Math.max(1, Math.ceil(rawQuantity));

      nutrition.push({
        fuelType,
        productId: product.id,
        productName: product.name,
        quantity,
        carbsG: carbsForThisType,
      });
    }

    return { ...station, nutrition };
  });
}

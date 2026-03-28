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

type ChosenProduct = {
  id: string;
  name: string;
  fuel_type: string;
  carbs_g: number;
  sodium_mg: number;
};

function allocateSegmentNutrition(
  chosen: ChosenProduct[],
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

  const nutrition: NutritionItem[] = [];

  // Step A: Electrolytes first — driven by water need (500 ml/unit)
  const electrolytes = chosen.filter((p) => p.fuel_type === "electrolyte");
  for (const product of electrolytes) {
    const qty = Math.round(waterNeeded / 500);
    if (qty <= 0) continue;
    carbsRemaining = Math.max(0, carbsRemaining - qty * product.carbs_g);
    sodiumRemaining = Math.max(0, sodiumRemaining - qty * product.sodium_mg);
    nutrition.push({
      fuelType: product.fuel_type,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      carbsG: qty * product.carbs_g,
      sodiumMg: qty * product.sodium_mg,
    });
  }

  // Step B: Distribute remaining carbs proportionally among all carb sources
  // (non-electrolyte, non-capsule, carbs > 5 g/unit)
  const carbSources = chosen.filter(
    (p) => p.fuel_type !== "electrolyte" && p.fuel_type !== "capsule" && p.carbs_g > 5,
  );
  const totalCarbsDensity = carbSources.reduce((sum, p) => sum + p.carbs_g, 0);
  if (totalCarbsDensity > 0) {
    for (const product of carbSources) {
      const weight = product.carbs_g / totalCarbsDensity;
      const qty = Math.max(0, Math.round((carbsRemaining * weight) / product.carbs_g));
      if (qty <= 0) continue;
      carbsRemaining = Math.max(0, carbsRemaining - qty * product.carbs_g);
      sodiumRemaining = Math.max(0, sodiumRemaining - qty * product.sodium_mg);
      nutrition.push({
        fuelType: product.fuel_type,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        carbsG: qty * product.carbs_g,
        sodiumMg: qty * product.sodium_mg,
      });
    }
  }

  // Step C: Salt capsules — fill residual sodium, capped at 40 % of total sodium need
  const saltOnly = chosen.filter((p) => p.fuel_type === "capsule");
  for (const product of saltOnly) {
    if (product.sodium_mg <= 0) continue;
    const cap = Math.ceil((sodiumNeeded * 0.4) / product.sodium_mg);
    const qty = Math.max(0, Math.min(Math.round(sodiumRemaining / product.sodium_mg), cap));
    if (qty <= 0) continue;
    nutrition.push({
      fuelType: product.fuel_type,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      carbsG: qty * product.carbs_g,
      sodiumMg: qty * product.sodium_mg,
    });
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

  // New algorithm when sodium + water targets are supplied
  if (targetSodiumPerHour !== undefined && targetWaterPerHour !== undefined) {
    const chosen: ChosenProduct[] = fuelTypes
      .map((fuelType) => {
        const p = products.find((prod) => prod.fuelType === fuelType);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          fuel_type: p.fuelType,
          carbs_g: p.carbsGrams,
          sodium_mg: p.sodiumMg,
        };
      })
      .filter((p): p is ChosenProduct => p !== null);

    return sorted.map((station, i) => {
      const prevDistanceKm = i === 0 ? 0 : sorted[i - 1].distanceKm;
      const segmentDurationH = (station.distanceKm - prevDistanceKm) / speedKph;
      const nutrition = allocateSegmentNutrition(
        chosen,
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

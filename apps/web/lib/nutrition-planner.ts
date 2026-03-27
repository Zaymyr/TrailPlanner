import type { AidStation } from "../app/(coach)/race-planner/types";
import type { FuelProduct } from "./product-types";

export type NutritionItem = {
  fuelType: string;
  productId: string;
  productName: string;
  quantity: number;
  carbsG: number;
};

export function computeAidStationNutrition(
  aidStations: AidStation[],
  fuelTypes: string[],
  targetCarbsPerHour: number,
  speedKph: number,
  products: FuelProduct[],
  weights?: Record<string, number>,
): AidStation[] {
  if (fuelTypes.length === 0 || speedKph <= 0) {
    return aidStations;
  }

  const sorted = [...aidStations].sort((a, b) => a.distanceKm - b.distanceKm);
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

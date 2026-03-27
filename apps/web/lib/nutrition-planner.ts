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
): AidStation[] {
  if (fuelTypes.length === 0 || speedKph <= 0) {
    return aidStations;
  }

  const sorted = [...aidStations].sort((a, b) => a.distanceKm - b.distanceKm);
  const carbsPerType = 1 / fuelTypes.length;

  return sorted.map((station, i) => {
    const prevDistanceKm = i === 0 ? 0 : sorted[i - 1].distanceKm;
    const distanceSinceLast = station.distanceKm - prevDistanceKm;
    const hoursToStation = distanceSinceLast / speedKph;
    const totalCarbsNeeded = targetCarbsPerHour * hoursToStation;
    const carbsForEachType = totalCarbsNeeded * carbsPerType;

    const nutrition: NutritionItem[] = [];

    for (const fuelType of fuelTypes) {
      const product = products.find((p) => p.fuelType === fuelType);
      if (!product || product.carbsGrams <= 0) continue;

      const rawQuantity = carbsForEachType / product.carbsGrams;
      const quantity = Math.max(0.5, Math.round(rawQuantity * 10) / 10);

      nutrition.push({
        fuelType,
        productId: product.id,
        productName: product.name,
        quantity,
        carbsG: carbsForEachType,
      });
    }

    return { ...station, nutrition };
  });
}

import { defaultFuelProducts } from "../../../../lib/default-products";
import type { FuelProduct } from "../../../../lib/product-types";
import type { Segment } from "../types";

export type AidStationPickListStrategy = {
  minCoveragePercent?: number;
  flaskSizeMl?: number;
};

export type AidStationPickListItem =
  | {
      type: "product";
      product: FuelProduct;
      quantity: number;
      carbsGrams: number;
      sodiumMg: number;
      waterMl: number;
    }
  | {
      type: "water";
      totalMl: number;
      count: number;
      flaskSizeMl: number;
    }
  | {
      type: "estimate";
      estimatedGels: number;
      gelCarbs: number;
    };

export type AidStationPickList = {
  items: AidStationPickListItem[];
  coverage: {
    carbs: number;
    sodium: number;
    water: number;
  };
  isEstimate: boolean;
};

const computeCoverage = (covered: number, target: number) => {
  if (target <= 0) return 1;
  return Math.min(covered / target, 1);
};

export const buildAidStationPickList = (
  segment: Segment,
  userProducts: FuelProduct[],
  strategy: AidStationPickListStrategy = {}
): AidStationPickList => {
  const minCoverage = strategy.minCoveragePercent ?? 0.95;
  const flaskSizeMl = strategy.flaskSizeMl ?? 500;
  const targetCarbs = Math.max(0, segment.targetFuelGrams);
  const targetSodium = Math.max(0, segment.targetSodiumMg);
  const targetWater = Math.max(0, segment.targetWaterMl);

  const items: AidStationPickListItem[] = [];
  let carbsCovered = 0;
  let sodiumCovered = 0;
  let waterCovered = 0;

  const waterCapacityMl = segment.waterCapacityMl ?? 0;
  if (waterCapacityMl > 0) {
    const count = Math.max(1, Math.ceil(waterCapacityMl / flaskSizeMl));
    items.push({
      type: "water",
      totalMl: count * flaskSizeMl,
      count,
      flaskSizeMl,
    });
    waterCovered += Math.min(targetWater, waterCapacityMl);
  }

  const usableProducts = userProducts.filter(
    (product) => product.carbsGrams > 0 || product.sodiumMg > 0 || (product.waterMl ?? 0) > 0
  );

  if (usableProducts.length === 0) {
    const gelCarbs = defaultFuelProducts[0]?.carbsGrams ?? 25;
    const estimatedGels = targetCarbs > 0 ? Math.max(1, Math.round(targetCarbs / gelCarbs)) : 0;
    items.push({ type: "estimate", estimatedGels, gelCarbs });
    return {
      items,
      coverage: {
        carbs: computeCoverage(carbsCovered, targetCarbs),
        sodium: computeCoverage(sodiumCovered, targetSodium),
        water: computeCoverage(waterCovered, targetWater),
      },
      isEstimate: true,
    };
  }

  const selection = new Map<string, { product: FuelProduct; quantity: number }>();
  let guard = 0;

  while (guard < 200) {
    guard += 1;
    const remainingCarbs = Math.max(0, targetCarbs - carbsCovered);
    const remainingSodium = Math.max(0, targetSodium - sodiumCovered);
    const remainingWater = Math.max(0, targetWater - waterCovered);

    const carbsCoveredPct = computeCoverage(carbsCovered, targetCarbs);
    const sodiumCoveredPct = computeCoverage(sodiumCovered, targetSodium);
    const waterCoveredPct = computeCoverage(waterCovered, targetWater);

    if (
      carbsCoveredPct >= minCoverage &&
      sodiumCoveredPct >= minCoverage &&
      waterCoveredPct >= minCoverage
    ) {
      break;
    }

    let best: { product: FuelProduct; score: number; total: number } | null = null;

    for (const product of usableProducts) {
      const carbs = remainingCarbs > 0 ? Math.min(remainingCarbs, product.carbsGrams) : 0;
      const sodium = remainingSodium > 0 ? Math.min(remainingSodium, product.sodiumMg) : 0;
      const water = remainingWater > 0 ? Math.min(remainingWater, product.waterMl ?? 0) : 0;
      const score =
        (remainingCarbs > 0 ? carbs / remainingCarbs : 0) +
        (remainingSodium > 0 ? sodium / remainingSodium : 0) +
        (remainingWater > 0 ? water / remainingWater : 0);
      const total = product.carbsGrams + product.sodiumMg + (product.waterMl ?? 0);

      if (!best || score > best.score + 0.0001 || (Math.abs(score - best.score) < 0.0001 && total > best.total)) {
        best = { product, score, total };
      }
    }

    if (!best || best.score === 0) {
      break;
    }

    const current = selection.get(best.product.id);
    selection.set(best.product.id, {
      product: best.product,
      quantity: (current?.quantity ?? 0) + 1,
    });

    carbsCovered += best.product.carbsGrams;
    sodiumCovered += best.product.sodiumMg;
    waterCovered += best.product.waterMl ?? 0;
  }

  if (selection.size === 0) {
    const gelCarbs = defaultFuelProducts[0]?.carbsGrams ?? 25;
    const estimatedGels = targetCarbs > 0 ? Math.max(1, Math.round(targetCarbs / gelCarbs)) : 0;
    items.push({ type: "estimate", estimatedGels, gelCarbs });
    return {
      items,
      coverage: {
        carbs: computeCoverage(carbsCovered, targetCarbs),
        sodium: computeCoverage(sodiumCovered, targetSodium),
        water: computeCoverage(waterCovered, targetWater),
      },
      isEstimate: true,
    };
  }

  Array.from(selection.values())
    .sort((a, b) => a.product.name.localeCompare(b.product.name))
    .forEach(({ product, quantity }) => {
      items.push({
        type: "product",
        product,
        quantity,
        carbsGrams: product.carbsGrams * quantity,
        sodiumMg: product.sodiumMg * quantity,
        waterMl: (product.waterMl ?? 0) * quantity,
      });
    });

  return {
    items,
    coverage: {
      carbs: computeCoverage(carbsCovered, targetCarbs),
      sodium: computeCoverage(sodiumCovered, targetSodium),
      water: computeCoverage(waterCovered, targetWater),
    },
    isEstimate: false,
  };
};

import type { FuelProduct } from "../../lib/product-types";
import type { Segment, StationSupply } from "../../app/(coach)/race-planner/types";

export type CarryoverBalance = {
  carbs: number;
  sodium: number;
};

export type CarryoverCoverage = {
  currentCarbs: number;
  currentSodium: number;
  consumedSupplies: StationSupply[];
  endBalance: CarryoverBalance;
};

type CarryoverProduct = {
  id: string;
  carbsGrams: number;
  sodiumMg: number;
};

type ConsumeArgs = {
  inventory: Map<string, number>;
  productsById: Record<string, CarryoverProduct | FuelProduct>;
  balance: CarryoverBalance;
  targetCarbs: number;
  targetSodium: number;
};

const toWholeUnits = (quantity: number) => {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity);
};

const toSafeNumber = (value: number | undefined) => (Number.isFinite(value) ? Math.max(0, value ?? 0) : 0);

export const addSuppliesToInventory = (inventory: Map<string, number>, supplies: StationSupply[] | undefined) => {
  supplies?.forEach((supply) => {
    const quantity = toWholeUnits(supply.quantity);
    if (quantity <= 0) return;
    inventory.set(supply.productId, (inventory.get(supply.productId) ?? 0) + quantity);
  });
};

const supplyEntries = (supplies: Map<string, number>): StationSupply[] =>
  Array.from(supplies.entries())
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

const productNutrients = (product: CarryoverProduct | FuelProduct | undefined) => ({
  carbs: toSafeNumber(product?.carbsGrams),
  sodium: toSafeNumber(product?.sodiumMg),
});

const pickBestInventoryProduct = (
  inventory: Map<string, number>,
  productsById: Record<string, CarryoverProduct | FuelProduct>,
  carbDeficit: number,
  sodiumDeficit: number
) => {
  let best: { productId: string; score: number } | null = null;

  for (const [productId, quantity] of inventory.entries()) {
    if (quantity <= 0) continue;

    const nutrients = productNutrients(productsById[productId]);
    if (nutrients.carbs <= 0 && nutrients.sodium <= 0) continue;

    const carbUse = carbDeficit > 0 ? Math.min(carbDeficit, nutrients.carbs) / Math.max(carbDeficit, 1) : 0;
    const sodiumUse =
      sodiumDeficit > 0 ? Math.min(sodiumDeficit, nutrients.sodium) / Math.max(sodiumDeficit, 1) : 0;
    const carbOvershoot =
      carbDeficit > 0 ? Math.max(0, nutrients.carbs - carbDeficit) / Math.max(carbDeficit, 1) : nutrients.carbs / 100;
    const sodiumOvershoot =
      sodiumDeficit > 0
        ? Math.max(0, nutrients.sodium - sodiumDeficit) / Math.max(sodiumDeficit, 1)
        : nutrients.sodium / 1000;
    const density = nutrients.carbs + nutrients.sodium / 100;
    const score = carbUse * 1.5 + sodiumUse * 0.8 - (carbOvershoot + sodiumOvershoot) * 0.15 + density * 0.0001;

    if (!best || score > best.score) {
      best = { productId, score };
    }
  }

  return best && best.score > 0 ? best.productId : null;
};

export const consumeInventoryForTargets = ({
  inventory,
  productsById,
  balance,
  targetCarbs,
  targetSodium,
}: ConsumeArgs): CarryoverCoverage => {
  const safeTargetCarbs = toSafeNumber(targetCarbs);
  const safeTargetSodium = toSafeNumber(targetSodium);
  balance.carbs -= safeTargetCarbs;
  balance.sodium -= safeTargetSodium;

  const consumed = new Map<string, number>();
  let guard = 0;

  while ((balance.carbs < 0 || balance.sodium < 0) && guard < 500) {
    guard += 1;
    const productId = pickBestInventoryProduct(inventory, productsById, Math.max(0, -balance.carbs), Math.max(0, -balance.sodium));
    if (!productId) break;

    const currentQuantity = inventory.get(productId) ?? 0;
    if (currentQuantity <= 0) break;

    if (currentQuantity === 1) inventory.delete(productId);
    else inventory.set(productId, currentQuantity - 1);

    consumed.set(productId, (consumed.get(productId) ?? 0) + 1);
    const nutrients = productNutrients(productsById[productId]);
    balance.carbs += nutrients.carbs;
    balance.sodium += nutrients.sodium;
  }

  return {
    currentCarbs: Math.max(0, safeTargetCarbs + balance.carbs),
    currentSodium: Math.max(0, safeTargetSodium + balance.sodium),
    consumedSupplies: supplyEntries(consumed),
    endBalance: { ...balance },
  };
};

export const buildCarryoverCoverageByItemId = (
  items: Array<{
    id: string;
    isStart?: boolean;
    checkpointSegment?: Segment;
    upcomingSegment?: Segment;
  }>,
  startSupplies: StationSupply[],
  productsById: Record<string, FuelProduct>
) => {
  const inventory = new Map<string, number>();
  const balance: CarryoverBalance = { carbs: 0, sodium: 0 };
  const coverageByItemId = new Map<string, CarryoverCoverage>();

  items.forEach((item) => {
    const upcomingSegment = item.upcomingSegment;
    if (!upcomingSegment) return;

    const checkpointAllowsAssistance = item.isStart || item.checkpointSegment?.assistanceAllowed !== false;
    addSuppliesToInventory(
      inventory,
      checkpointAllowsAssistance ? (item.isStart ? startSupplies : item.checkpointSegment?.supplies) : []
    );

    coverageByItemId.set(
      item.id,
      consumeInventoryForTargets({
        inventory,
        productsById,
        balance,
        targetCarbs: upcomingSegment.targetFuelGrams,
        targetSodium: upcomingSegment.targetSodiumMg,
      })
    );
  });

  return coverageByItemId;
};

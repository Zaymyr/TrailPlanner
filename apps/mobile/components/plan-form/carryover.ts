import type { PlanProduct, SectionSummary, Supply } from './contracts';

export type CarryoverBalance = {
  carbs: number;
  sodium: number;
};

export type CarryoverProduct = {
  id: string;
  carbsGrams: number;
  sodiumMg: number;
};

export type CarryoverCoverage = {
  sectionIndex: number;
  currentCarbsG: number;
  currentSodiumMg: number;
  availableCarbsG: number;
  availableSodiumMg: number;
  consumedSupplies: Supply[];
  endBalance: CarryoverBalance;
};

export type CarryoverSection = Pick<SectionSummary, 'sectionIndex' | 'targetCarbsG' | 'targetSodiumMg'> & {
  supplies: Supply[];
};

type ConsumeArgs = {
  inventory: Map<string, number>;
  productsById: Record<string, CarryoverProduct | PlanProduct>;
  balance: CarryoverBalance;
  targetCarbsG: number;
  targetSodiumMg: number;
  sectionIndex?: number;
};

const toWholeUnits = (quantity: number) => {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity);
};

const safeNumber = (value: number | null | undefined) => (Number.isFinite(value) ? Math.max(0, value ?? 0) : 0);

const productNutrients = (product: CarryoverProduct | PlanProduct | undefined) => {
  if (!product) return { carbs: 0, sodium: 0 };
  if ('carbsGrams' in product) {
    return {
      carbs: safeNumber(product.carbsGrams),
      sodium: safeNumber(product.sodiumMg),
    };
  }

  return {
    carbs: safeNumber(product.carbs_g),
    sodium: safeNumber(product.sodium_mg),
  };
};

const suppliesFromMap = (supplies: Map<string, number>): Supply[] =>
  Array.from(supplies.entries())
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

function inventoryNutrients(
  inventory: Map<string, number>,
  productsById: Record<string, CarryoverProduct | PlanProduct>,
) {
  let carbs = 0;
  let sodium = 0;

  for (const [productId, quantity] of inventory.entries()) {
    if (quantity <= 0) continue;
    const nutrients = productNutrients(productsById[productId]);
    carbs += nutrients.carbs * quantity;
    sodium += nutrients.sodium * quantity;
  }

  return { carbs, sodium };
}

export function addSuppliesToInventory(inventory: Map<string, number>, supplies: Supply[] | undefined) {
  supplies?.forEach((supply) => {
    const quantity = toWholeUnits(supply.quantity);
    if (quantity <= 0) return;
    inventory.set(supply.productId, (inventory.get(supply.productId) ?? 0) + quantity);
  });
}

function pickBestInventoryProduct(
  inventory: Map<string, number>,
  productsById: Record<string, CarryoverProduct | PlanProduct>,
  carbDeficit: number,
  sodiumDeficit: number,
) {
  let best: { productId: string; score: number } | null = null;

  for (const [productId, quantity] of inventory.entries()) {
    if (quantity <= 0) continue;

    const nutrients = productNutrients(productsById[productId]);
    if (nutrients.carbs <= 0 && nutrients.sodium <= 0) continue;

    const coversDeficit =
      (carbDeficit > 0 && nutrients.carbs > 0) ||
      (sodiumDeficit > 0 && nutrients.sodium > 0);
    if (!coversDeficit) continue;

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

  return best?.productId ?? null;
}

export function consumeInventoryForTargets({
  inventory,
  productsById,
  balance,
  targetCarbsG,
  targetSodiumMg,
  sectionIndex = -1,
}: ConsumeArgs): CarryoverCoverage {
  const safeTargetCarbs = safeNumber(targetCarbsG);
  const safeTargetSodium = safeNumber(targetSodiumMg);
  const startingBalance = { ...balance };
  const startingInventory = inventoryNutrients(inventory, productsById);
  const availableCarbsG = Math.max(0, startingBalance.carbs + startingInventory.carbs);
  const availableSodiumMg = Math.max(0, startingBalance.sodium + startingInventory.sodium);

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
    sectionIndex,
    currentCarbsG: Math.max(0, safeTargetCarbs + balance.carbs),
    currentSodiumMg: Math.max(0, safeTargetSodium + balance.sodium),
    availableCarbsG,
    availableSodiumMg,
    consumedSupplies: suppliesFromMap(consumed),
    endBalance: { ...balance },
  };
}

export function buildCarryoverCoverages(
  sections: CarryoverSection[],
  productsById: Record<string, CarryoverProduct | PlanProduct>,
) {
  const inventory = new Map<string, number>();
  const balance: CarryoverBalance = { carbs: 0, sodium: 0 };
  const coverages = new Map<number, CarryoverCoverage>();

  sections.forEach((section) => {
    addSuppliesToInventory(inventory, section.supplies);
    coverages.set(
      section.sectionIndex,
      consumeInventoryForTargets({
        inventory,
        productsById,
        balance,
        targetCarbsG: section.targetCarbsG,
        targetSodiumMg: section.targetSodiumMg,
        sectionIndex: section.sectionIndex,
      }),
    );
  });

  return coverages;
}

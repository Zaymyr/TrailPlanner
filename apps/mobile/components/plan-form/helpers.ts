import {
  DEFAULT_FLUID_MIX_SHARE,
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
  type FavProduct,
  type Supply,
} from './contracts';

// Planner-values normalization is shared with the web planner chronology.
// Source of truth: packages/shared/src/plan-timeline/plan-values.ts.
export {
  buildInitialPlanValues,
  cloneSectionSegments,
  injectSystemStations,
  normalizeSupplies,
} from '../../../../packages/shared/src/plan-timeline/plan-values';

type BuildPlanOptions = {
  targetWaterMl?: number;
  availableWaterMl?: number;
  maxQuantities?: ReadonlyMap<string, number>;
};

type ComboOption = {
  id: string;
  carbs: number;
  sodium: number;
  fluid: boolean;
  maxQuantity: number;
};

export function getEffectiveSodiumTarget(targetSodiumMg: number) {
  return Math.max(0, targetSodiumMg * 0.6);
}

function isFluidFuelType(fuelType: string | null | undefined) {
  return fuelType === 'drink_mix' || fuelType === 'electrolyte';
}

function findBestCombo(
  options: ComboOption[],
  targetFuelGrams: number,
  targetSodiumMg: number,
  maxUnits: number,
  fluidUnitLimit = Number.POSITIVE_INFINITY,
) {
  if (options.length === 0 || maxUnits <= 0) {
    return { score: Number.POSITIVE_INFINITY, combo: [] as number[], carbs: 0, sodium: 0, units: 0, fluidUnits: 0 };
  }

  let best = {
    score: Number.POSITIVE_INFINITY,
    combo: new Array(options.length).fill(0),
    carbs: 0,
    sodium: 0,
    units: 0,
    fluidUnits: 0,
  };

  const evaluateCombo = (combo: number[]) => {
    const carbs = combo.reduce((total, qty, index) => total + qty * options[index].carbs, 0);
    const sodium = combo.reduce((total, qty, index) => total + qty * options[index].sodium, 0);
    const units = combo.reduce((total, qty) => total + qty, 0);
    const fluidUnits = combo.reduce((total, qty, index) => total + (options[index].fluid ? qty : 0), 0);
    const carbDiff = Math.abs(carbs - targetFuelGrams) / Math.max(targetFuelGrams, 1);
    const sodiumDiff = targetSodiumMg > 0 ? Math.abs(sodium - targetSodiumMg) / targetSodiumMg : 0;
    const underfillPenalty = carbs < targetFuelGrams ? 0.2 : 0;
    const itemPenalty = units * 0.01;
    const duplicatePenalty = combo.reduce((total, qty) => total + Math.max(0, qty - 1), 0) * 0.025;
    const score = carbDiff * 1.5 + sodiumDiff * 0.6 + underfillPenalty + itemPenalty + duplicatePenalty;

    if (score < best.score && (carbs > 0 || sodium > 0)) {
      best = { score, combo: combo.slice(), carbs, sodium, units, fluidUnits };
    }
  };

  const search = (index: number, combo: number[], totalUnits: number, totalFluidUnits: number) => {
    if (index === options.length) {
      evaluateCombo(combo);
      return;
    }

    const option = options[index];
    const remainingSlots = maxUnits - totalUnits;
    const remainingFluidSlots = option.fluid ? fluidUnitLimit - totalFluidUnits : remainingSlots;
    const maxQty = Math.max(0, Math.min(remainingSlots, remainingFluidSlots, option.maxQuantity));

    for (let qty = 0; qty <= maxQty; qty += 1) {
      combo[index] = qty;
      search(index + 1, combo, totalUnits + qty, totalFluidUnits + (option.fluid ? qty : 0));
    }
  };

  search(0, new Array(options.length).fill(0), 0, 0);
  return best;
}

export function buildPlanForTarget(
  targetFuelGrams: number,
  targetSodiumMg: number,
  products: FavProduct[],
  options?: BuildPlanOptions,
): Supply[] {
  const safeTargetFuel = Number.isFinite(targetFuelGrams) ? Math.max(0, targetFuelGrams) : 0;
  const safeTargetSodium = Number.isFinite(targetSodiumMg) ? Math.max(0, targetSodiumMg) : 0;
  if (safeTargetFuel <= 0 && safeTargetSodium <= 0) return [];

  const normalizedOptions = [...products]
    .map((product) => ({
      id: product.id,
      carbs: Math.max(product.carbsGrams, 0),
      sodium: Math.max(product.sodiumMg ?? 0, 0),
      fluid: isFluidFuelType(product.fuelType),
      maxQuantity: Math.max(0, Math.floor(options?.maxQuantities?.get(product.id) ?? Number.POSITIVE_INFINITY)),
    }))
    .filter((product) => (product.carbs > 0 || product.sodium > 0) && product.maxQuantity > 0);

  if (normalizedOptions.length === 0) return [];

  const solidOptions = normalizedOptions.filter((product) => !product.fluid).sort((a, b) => b.carbs - a.carbs).slice(0, 3);
  const fluidOptions = normalizedOptions
    .filter((product) => product.fluid)
    .sort((a, b) => b.carbs + b.sodium / 100 - (a.carbs + a.sodium / 100))
    .slice(0, 2);

  const candidateOptions = [...fluidOptions, ...solidOptions];
  const minCarbs = Math.max(Math.min(...candidateOptions.map((option) => Math.max(option.carbs, 1))), 1);
  const minSodium = Math.max(Math.min(...candidateOptions.map((option) => Math.max(option.sodium, 1))), 1);
  const maxUnits = Math.min(
    12,
    Math.max(3, Math.ceil(safeTargetFuel / minCarbs) + 2, Math.ceil(safeTargetSodium / minSodium) + 1),
  );
  const availableWaterMl = Math.max(0, options?.availableWaterMl ?? 0);
  const targetWaterMl = Math.max(0, options?.targetWaterMl ?? 0);
  const fluidBudgetMl =
    fluidOptions.length > 0
      ? Math.min(
          availableWaterMl * DEFAULT_FLUID_MIX_SHARE,
          targetWaterMl > 0 ? targetWaterMl : availableWaterMl * DEFAULT_FLUID_MIX_SHARE,
        )
      : 0;
  const fluidUnitLimit = Math.floor(fluidBudgetMl / DEFAULT_FLUID_PRODUCT_VOLUME_ML);

  const fluidCombo = findBestCombo(fluidOptions, safeTargetFuel, safeTargetSodium, fluidUnitLimit, fluidUnitLimit);
  const remainingFuel = Math.max(0, safeTargetFuel - fluidCombo.carbs);
  const remainingSodium = Math.max(0, safeTargetSodium - fluidCombo.sodium);
  const remainingUnits = Math.max(0, maxUnits - fluidCombo.units);
  const solidCombo = findBestCombo(solidOptions, remainingFuel, remainingSodium, remainingUnits);

  const combined = [...fluidOptions, ...solidOptions].map((option) => {
    const fluidIndex = fluidOptions.findIndex((fluidOption) => fluidOption.id === option.id);
    if (fluidIndex >= 0) return fluidCombo.combo[fluidIndex] ?? 0;
    const solidIndex = solidOptions.findIndex((solidOption) => solidOption.id === option.id);
    return solidIndex >= 0 ? solidCombo.combo[solidIndex] ?? 0 : 0;
  });

  if (combined.every((qty) => qty === 0)) return [];

  return combined
    .map((qty, index) => ({ productId: [...fluidOptions, ...solidOptions][index].id, quantity: qty }))
    .filter((supply) => supply.quantity > 0);
}

export function formatDurationLabel(durationMin: number): string {
  const roundedMinutes = Math.max(0, Math.round(durationMin));
  if (roundedMinutes >= 60) {
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return `${hours}h${String(minutes).padStart(2, '0')}`;
  }
  return `${roundedMinutes} min`;
}

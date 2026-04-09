import {
  ARRIVEE_ID,
  DEFAULT_PLAN_VALUES,
  DEFAULT_FLUID_MIX_SHARE,
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
  DEPART_ID,
  type AidStationFormItem,
  type FavProduct,
  type PlanFormValues,
  type Supply,
} from './contracts';
import type { SectionSegment } from './profile-utils';

export function normalizeSupplies(raw: Array<{ productId: string; quantity?: number }> | undefined): Supply[] {
  if (!raw) return [];
  return raw.map((supply) => ({ productId: supply.productId, quantity: supply.quantity ?? 1 }));
}

export function cloneSectionSegments(
  raw: Record<string, SectionSegment[]> | undefined,
): Record<string, SectionSegment[]> | undefined {
  if (!raw) return undefined;
  const entries = Object.entries(raw).map(([key, segments]) => [key, segments.map((segment) => ({ ...segment }))] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function injectSystemStations(stations: AidStationFormItem[], distanceKm: number): AidStationFormItem[] {
  const intermediates = stations.filter(
    (station) =>
      station.id !== DEPART_ID &&
      station.id !== ARRIVEE_ID &&
      !(station.name === 'Départ' && station.distanceKm === 0) &&
      station.name !== 'Arrivée',
  );

  return [
    { id: DEPART_ID, name: 'Départ', distanceKm: 0, waterRefill: true, pauseMinutes: 0, supplies: [] },
    ...intermediates.map((station) => ({ ...station, pauseMinutes: Math.max(0, station.pauseMinutes ?? 0) })),
    { id: ARRIVEE_ID, name: 'Arrivée', distanceKm, waterRefill: false, pauseMinutes: 0 },
  ];
}

export function buildInitialPlanValues(initialValues: PlanFormValues): PlanFormValues {
  return {
    ...initialValues,
    fatigueLevel:
      typeof initialValues.fatigueLevel === 'number' && Number.isFinite(initialValues.fatigueLevel)
        ? Math.min(1, Math.max(0, initialValues.fatigueLevel))
        : DEFAULT_PLAN_VALUES.fatigueLevel,
    startSupplies: normalizeSupplies(initialValues.startSupplies),
    sectionSegments: cloneSectionSegments(initialValues.sectionSegments),
    aidStations: injectSystemStations(
      initialValues.aidStations.map((station) => ({
        ...station,
        pauseMinutes: Math.max(0, station.pauseMinutes ?? 0),
        supplies: normalizeSupplies(station.supplies),
      })),
      initialValues.raceDistanceKm,
    ),
  };
}

type BuildPlanOptions = {
  targetWaterMl?: number;
  availableWaterMl?: number;
};

type ComboOption = {
  id: string;
  carbs: number;
  sodium: number;
  fluid: boolean;
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
    const score = carbDiff * 1.5 + sodiumDiff * 0.6 + underfillPenalty + itemPenalty;

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
    const maxQty = Math.max(0, Math.min(remainingSlots, remainingFluidSlots));

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
    }))
    .filter((product) => product.carbs > 0 || product.sodium > 0);

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

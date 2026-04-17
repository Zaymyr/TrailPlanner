import type { AidStationFormItem, ElevationPoint, PlanFormValues, PlanProduct, Supply } from '../components/plan-form/contracts';
import { DEFAULT_PLAN_VALUES } from '../components/plan-form/contracts';
import { buildInitialPlanValues, buildPlanForTarget, getEffectiveSodiumTarget, injectSystemStations } from '../components/plan-form/helpers';
import { getGaugeTolerance } from '../components/plan-form/metrics';
import { buildContinuousSections, buildSuggestedSolidIntakePlan } from './continuousNutrition';
import { fetchRaceAidStations, fetchRaceElevationProfile } from './raceProfile';
import { supabase } from './supabase';

type OnboardingDemoRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
};

type UserPlanDefaultsProfile = {
  comfortable_flat_pace_min_per_km?: number | null;
  default_carbs_g_per_hour?: number | null;
  default_water_ml_per_hour?: number | null;
  default_sodium_mg_per_hour?: number | null;
  water_bag_liters?: number | null;
};

type BuildAutoFilledPlanArgs = {
  values: PlanFormValues;
  allProducts: PlanProduct[];
  favoriteProductIds: Set<string>;
  elevationProfile?: ElevationPoint[];
};

type PoolProduct = {
  id: string;
  name: string;
  carbsGrams: number;
  sodiumMg: number;
  fuelType?: string | null;
};

export async function createOnboardingDemoPlan({
  userId,
  race,
  profileDefaults,
  selectedProductIds,
}: {
  userId: string;
  race: OnboardingDemoRace;
  profileDefaults: UserPlanDefaultsProfile;
  selectedProductIds: string[];
}): Promise<string | null> {
  const [elevationProfile, fetchedAidStations, selectedProducts] = await Promise.all([
    fetchRaceElevationProfile(race.id),
    fetchRaceAidStations(race.id),
    loadSelectedProducts(selectedProductIds),
  ]);

  const seedValues = buildInitialPlanValues({
    ...buildDefaultPlanValues(profileDefaults),
    name: race.name,
    raceDistanceKm: race.distance_km,
    elevationGain: race.elevation_gain_m,
    aidStations:
      fetchedAidStations.length > 0
        ? fetchedAidStations
        : buildFallbackAidStations(race.distance_km),
  });

  const finalValues =
    selectedProducts.length > 0
      ? buildAutoFilledPlanValues({
          values: seedValues,
          allProducts: selectedProducts,
          favoriteProductIds: new Set(selectedProducts.map((product) => product.id)),
          elevationProfile,
        })
      : seedValues;

  const { data, error } = await supabase
    .from('race_plans')
    .insert({
      user_id: userId,
      name: finalValues.name,
      planner_values: buildPlannerValues(finalValues),
      elevation_profile: elevationProfile,
      race_id: race.id,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error ?? new Error('Unable to create onboarding demo plan');
  }

  return data.id as string;
}

async function loadSelectedProducts(selectedProductIds: string[]): Promise<PlanProduct[]> {
  if (selectedProductIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal')
    .in('id', selectedProductIds)
    .eq('is_archived', false);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PlanProduct[]).filter(
    (product) => (product.carbs_g ?? 0) > 0 || (product.sodium_mg ?? 0) > 0,
  );
}

function buildDefaultPlanValues(profileDefaults: UserPlanDefaultsProfile | null | undefined): PlanFormValues {
  const nextValues: PlanFormValues = {
    ...DEFAULT_PLAN_VALUES,
  };

  const comfortableFlatPaceMinPerKm = profileDefaults?.comfortable_flat_pace_min_per_km;
  if (
    typeof comfortableFlatPaceMinPerKm === 'number' &&
    Number.isFinite(comfortableFlatPaceMinPerKm) &&
    comfortableFlatPaceMinPerKm > 0
  ) {
    const totalSeconds = Math.round(comfortableFlatPaceMinPerKm * 60);
    nextValues.paceType = 'pace';
    nextValues.paceMinutes = Math.floor(totalSeconds / 60);
    nextValues.paceSeconds = totalSeconds % 60;
    nextValues.speedKph = Number((60 / comfortableFlatPaceMinPerKm).toFixed(1));
  }

  if (
    typeof profileDefaults?.default_carbs_g_per_hour === 'number' &&
    Number.isFinite(profileDefaults.default_carbs_g_per_hour) &&
    profileDefaults.default_carbs_g_per_hour >= 0
  ) {
    nextValues.targetIntakePerHour = profileDefaults.default_carbs_g_per_hour;
  }

  if (
    typeof profileDefaults?.default_water_ml_per_hour === 'number' &&
    Number.isFinite(profileDefaults.default_water_ml_per_hour) &&
    profileDefaults.default_water_ml_per_hour >= 0
  ) {
    nextValues.waterIntakePerHour = profileDefaults.default_water_ml_per_hour;
  }

  if (
    typeof profileDefaults?.default_sodium_mg_per_hour === 'number' &&
    Number.isFinite(profileDefaults.default_sodium_mg_per_hour) &&
    profileDefaults.default_sodium_mg_per_hour >= 0
  ) {
    nextValues.sodiumIntakePerHour = profileDefaults.default_sodium_mg_per_hour;
  }

  if (
    typeof profileDefaults?.water_bag_liters === 'number' &&
    Number.isFinite(profileDefaults.water_bag_liters) &&
    profileDefaults.water_bag_liters > 0
  ) {
    nextValues.waterBagLiters = profileDefaults.water_bag_liters;
  }

  return nextValues;
}

function buildPlannerValues(values: PlanFormValues) {
  return {
    raceDistanceKm: values.raceDistanceKm,
    elevationGain: values.elevationGain,
    fatigueLevel: values.fatigueLevel,
    paceType: values.paceType,
    paceMinutes: values.paceMinutes,
    paceSeconds: values.paceSeconds,
    speedKph: values.speedKph,
    targetIntakePerHour: values.targetIntakePerHour,
    waterIntakePerHour: values.waterIntakePerHour,
    sodiumIntakePerHour: values.sodiumIntakePerHour,
    waterBagLiters: values.waterBagLiters,
    startSupplies: (values.startSupplies ?? []).map((supply) => ({
      productId: supply.productId,
      quantity: supply.quantity,
    })),
    segments: values.sectionSegments,
    sectionSegments: values.sectionSegments,
    aidStations: values.aidStations.map((station) => ({
      name: station.name,
      distanceKm: station.distanceKm,
      waterRefill: station.waterRefill,
      pauseMinutes: station.pauseMinutes ?? 0,
      supplies: (station.supplies ?? []).map((supply) => ({
        productId: supply.productId,
        quantity: supply.quantity,
      })),
    })),
  };
}

function buildFallbackAidStations(distanceKm: number): AidStationFormItem[] {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return [];
  }

  const interval = distanceKm > 60 ? 15 : distanceKm > 30 ? 10 : 8;
  const count = Math.floor((distanceKm - 1) / interval);

  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    name: `Ravito ${index + 1}`,
    distanceKm: Math.round((index + 1) * interval * 10) / 10,
    waterRefill: true,
    pauseMinutes: 0,
    supplies: [],
  }));
}

function buildAutoFilledPlanValues({
  values,
  allProducts,
  favoriteProductIds,
  elevationProfile = [],
}: BuildAutoFilledPlanArgs): PlanFormValues {
  const allUsableProducts = allProducts.filter(
    (product) => (product.carbs_g ?? 0) > 0 || (product.sodium_mg ?? 0) > 0,
  );
  const favoriteUsableProducts = allUsableProducts.filter((product) => favoriteProductIds.has(product.id));

  if (favoriteUsableProducts.length === 0) {
    return values;
  }

  const poolAsFavorites: PoolProduct[] = favoriteUsableProducts.map((product) => ({
    id: product.id,
    name: product.name,
    carbsGrams: product.carbs_g ?? 0,
    sodiumMg: product.sodium_mg ?? 0,
    fuelType: product.fuel_type,
  }));
  const productsById = Object.fromEntries(poolAsFavorites.map((product) => [product.id, product] as const));
  const solidCandidates = poolAsFavorites.filter((product) => !isFluidFuelType(product.fuelType));
  const carbBasePool = pickCarbBasePool(solidCandidates);
  const sodiumSpecialists = pickSodiumSpecialists(solidCandidates);
  const fluidMixPool = pickFluidMixPool(poolAsFavorites.filter((product) => isFluidFuelType(product.fuelType)));
  const sections = buildContinuousSections({ values, elevationProfile });
  const assignedBySection = new Map<number, Supply[]>();
  const suggestedSolidPlan = buildSuggestedSolidIntakePlan({
    values,
    solidProducts: carbBasePool.map((product) => ({
      id: product.id,
      name: product.name,
      carbs_g: product.carbsGrams,
      sodium_mg: product.sodiumMg,
    })),
    elevationProfile,
  });

  suggestedSolidPlan.events.forEach((event) => {
    if (!event.productId) return;
    const sectionSupplies = assignedBySection.get(event.sectionIndex) ?? [];
    const existing = sectionSupplies.find((supply) => supply.productId === event.productId);
    if (existing) existing.quantity += 1;
    else sectionSupplies.push({ productId: event.productId, quantity: 1 });
    assignedBySection.set(event.sectionIndex, sectionSupplies);
  });

  const sectionSupplyMap = new Map<number, Supply[]>();

  sections.forEach((section) => {
    let nextSupplies = [...(assignedBySection.get(section.sectionIndex) ?? [])];
    const baseCovered = sumSuppliesNutrition(nextSupplies, productsById);
    const effectiveSectionSodiumTarget = getEffectiveSodiumTarget(section.targetSodiumMg);
    const availableWaterMl = section.waterRefill ? values.waterBagLiters * 1000 : 0;
    const carbTolerance = getGaugeTolerance('carbs', section.targetCarbsG);
    const sodiumTolerance = getGaugeTolerance('sodium', effectiveSectionSodiumTarget);
    let remainingCarbs = Math.max(0, section.targetCarbsG - baseCovered.carbs);
    let remainingSodium = Math.max(0, effectiveSectionSodiumTarget - baseCovered.sodium);

    if (
      (remainingCarbs > carbTolerance || remainingSodium > sodiumTolerance) &&
      fluidMixPool.length > 0 &&
      availableWaterMl > 0
    ) {
      const fluidCarbGoal = Math.max(0, Math.min(remainingCarbs, section.targetCarbsG * 0.45));
      const fluidSodiumGoal = Math.max(0, Math.min(remainingSodium, effectiveSectionSodiumTarget * 0.6));
      const fluidTopUp = buildPlanForTarget(fluidCarbGoal, fluidSodiumGoal, fluidMixPool, {
        targetWaterMl: section.targetWaterMl,
        availableWaterMl,
      });
      nextSupplies = mergeSupplyLists(nextSupplies, fluidTopUp);
      const afterFluid = sumSuppliesNutrition(nextSupplies, productsById);
      remainingCarbs = Math.max(0, section.targetCarbsG - afterFluid.carbs);
      remainingSodium = Math.max(0, effectiveSectionSodiumTarget - afterFluid.sodium);
    }

    if (remainingCarbs > carbTolerance && carbBasePool.length > 0) {
      const fallbackTopUp = buildPlanForTarget(remainingCarbs, 0, carbBasePool, {
        targetWaterMl: section.targetWaterMl,
        availableWaterMl,
      });
      nextSupplies = mergeSupplyLists(nextSupplies, fallbackTopUp);
    }

    const afterCarbTopUp = sumSuppliesNutrition(nextSupplies, productsById);
    const sodiumStillMissing = Math.max(0, effectiveSectionSodiumTarget - afterCarbTopUp.sodium);
    if (sodiumStillMissing > sodiumTolerance && sodiumSpecialists.length > 0) {
      nextSupplies = mergeSupplyLists(
        nextSupplies,
        buildSodiumTopUpSupplies(sodiumStillMissing, sodiumSpecialists),
      );
    }

    sectionSupplyMap.set(section.sectionIndex, nextSupplies);
  });

  const newStartSupplies = sectionSupplyMap.get(0) ?? [];
  const updatedIntermediates = values.aidStations
    .filter((station) => station.id !== 'depart' && station.id !== 'arrivee')
    .map((station, index) => ({
      ...station,
      supplies: sectionSupplyMap.get(index + 1) ?? [],
    }));

  return {
    ...values,
    startSupplies: newStartSupplies,
    aidStations: injectSystemStations(updatedIntermediates, values.raceDistanceKm),
  };
}

function isFluidFuelType(fuelType: string | null | undefined) {
  return fuelType === 'drink_mix' || fuelType === 'electrolyte';
}

function sumSuppliesNutrition(
  supplies: Supply[],
  productsById: Record<string, PoolProduct>,
) {
  return supplies.reduce(
    (sum, supply) => {
      const product = productsById[supply.productId];
      if (!product) return sum;

      return {
        carbs: sum.carbs + (product.carbsGrams ?? 0) * supply.quantity,
        sodium: sum.sodium + (product.sodiumMg ?? 0) * supply.quantity,
      };
    },
    { carbs: 0, sodium: 0 },
  );
}

function mergeSupplyLists(base: Supply[], extra: Supply[]) {
  const quantities = new Map<string, number>();

  [...base, ...extra].forEach((supply) => {
    quantities.set(supply.productId, (quantities.get(supply.productId) ?? 0) + supply.quantity);
  });

  return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function pickUniqueProducts(candidates: PoolProduct[]) {
  const seen = new Set<string>();
  return candidates.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function addProductQuantity(base: Supply[], productId: string, quantity: number) {
  if (quantity <= 0) return base;

  const next = [...base];
  const existing = next.find((supply) => supply.productId === productId);
  if (existing) {
    existing.quantity += quantity;
    return next;
  }

  next.push({ productId, quantity });
  return next;
}

function pickSodiumSpecialists(products: PoolProduct[]) {
  return [...products]
    .filter((product) => (product.sodiumMg ?? 0) > 0)
    .sort((left, right) => {
      const leftDensity = (left.sodiumMg ?? 0) / Math.max((left.carbsGrams ?? 0) + 1, 1);
      const rightDensity = (right.sodiumMg ?? 0) / Math.max((right.carbsGrams ?? 0) + 1, 1);
      if (rightDensity !== leftDensity) return rightDensity - leftDensity;
      if ((right.sodiumMg ?? 0) !== (left.sodiumMg ?? 0)) return (right.sodiumMg ?? 0) - (left.sodiumMg ?? 0);
      return (left.carbsGrams ?? 0) - (right.carbsGrams ?? 0);
    });
}

function buildSodiumTopUpSupplies(
  sodiumGapMg: number,
  sodiumCandidates: PoolProduct[],
) {
  let remaining = Math.max(0, sodiumGapMg);
  let supplies: Supply[] = [];

  sodiumCandidates.forEach((product) => {
    const sodiumPerUnit = Math.max(product.sodiumMg ?? 0, 0);
    if (remaining <= 0 || sodiumPerUnit <= 0) return;

    if ((product.carbsGrams ?? 0) <= 5) {
      const quantity = Math.ceil(remaining / sodiumPerUnit);
      supplies = addProductQuantity(supplies, product.id, quantity);
      remaining -= quantity * sodiumPerUnit;
      return;
    }

    if (remaining >= Math.max(120, sodiumPerUnit * 0.7)) {
      supplies = addProductQuantity(supplies, product.id, 1);
      remaining -= sodiumPerUnit;
    }
  });

  return supplies;
}

function pickCarbBasePool(products: PoolProduct[]) {
  const carbProducts = products.filter((product) => (product.carbsGrams ?? 0) >= 8);
  const gels = carbProducts.filter((product) => product.fuelType === 'gel').sort((a, b) => b.carbsGrams - a.carbsGrams);
  const bars = carbProducts.filter((product) => product.fuelType === 'bar').sort((a, b) => b.carbsGrams - a.carbsGrams);
  const foods = carbProducts
    .filter((product) => product.fuelType === 'real_food' || product.fuelType === 'other')
    .sort((a, b) => b.carbsGrams - a.carbsGrams);
  const fallback = [...carbProducts].sort((a, b) => b.carbsGrams - a.carbsGrams);

  return pickUniqueProducts(
    [gels[0], bars[0], foods[0], fallback[0], fallback[1]].filter(Boolean) as PoolProduct[],
  ).slice(0, 5);
}

function pickFluidMixPool(products: PoolProduct[]) {
  const drinkMixes = products
    .filter((product) => product.fuelType === 'drink_mix')
    .sort((a, b) => (b.carbsGrams + b.sodiumMg / 100) - (a.carbsGrams + a.sodiumMg / 100));
  const electrolytes = products
    .filter((product) => product.fuelType === 'electrolyte')
    .sort((a, b) => (b.sodiumMg + b.carbsGrams * 5) - (a.sodiumMg + a.carbsGrams * 5));

  return pickUniqueProducts(
    [drinkMixes[0], drinkMixes[1], electrolytes[0], electrolytes[1]].filter(Boolean) as PoolProduct[],
  ).slice(0, 4);
}

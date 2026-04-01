import { Alert } from 'react-native';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../../lib/supabase';
import { buildContinuousSections, buildSuggestedSolidIntakePlan } from '../../lib/continuousNutrition';
import {
  ARRIVEE_ID,
  DEPART_ID,
  type AidStationFormItem,
  type FavProduct,
  type PlanFormValues,
  type PlanProduct,
  type PlanTarget,
  type SectionSummary,
  type Supply,
} from './contracts';
import { buildPlanForTarget, getEffectiveSodiumTarget, injectSystemStations } from './helpers';
import { getGaugeTolerance } from './metrics';
import type { ElevationPoint } from './profile-utils';

type Args = {
  values: PlanFormValues;
  setValues: Dispatch<SetStateAction<PlanFormValues>>;
  allProducts: PlanProduct[];
  favoriteProductIds: Set<string>;
  setFavoriteProductIds: Dispatch<SetStateAction<Set<string>>>;
  buildSectionSummary: (target: PlanTarget) => SectionSummary | null;
  isPremium: boolean;
  elevationProfile?: ElevationPoint[];
};

type PoolProduct = FavProduct & {
  fuelType?: string | null;
};

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

  return pickUniqueProducts([gels[0], bars[0], foods[0], fallback[0], fallback[1]].filter(Boolean) as PoolProduct[]).slice(0, 5);
}

function pickFluidMixPool(products: PoolProduct[]) {
  const drinkMixes = products
    .filter((product) => product.fuelType === 'drink_mix')
    .sort((a, b) => (b.carbsGrams + b.sodiumMg / 100) - (a.carbsGrams + a.sodiumMg / 100));
  const electrolytes = products
    .filter((product) => product.fuelType === 'electrolyte')
    .sort((a, b) => (b.sodiumMg + b.carbsGrams * 5) - (a.sodiumMg + a.carbsGrams * 5));

  return pickUniqueProducts([drinkMixes[0], drinkMixes[1], electrolytes[0], electrolytes[1]].filter(Boolean) as PoolProduct[]).slice(0, 4);
}

export function usePlanSupplies({
  values,
  setValues,
  allProducts,
  favoriteProductIds,
  setFavoriteProductIds,
  buildSectionSummary,
  isPremium,
  elevationProfile = [],
}: Args) {
  const replaceAidStations = useCallback(
    (aidStations: AidStationFormItem[], resetSectionSegments = false) => {
      setValues((prev) => ({
        ...prev,
        aidStations,
        ...(resetSectionSegments ? { sectionSegments: undefined } : {}),
      }));
    },
    [setValues],
  );

  const updateAidStation = useCallback(
    (index: number, patch: Partial<AidStationFormItem>) => {
      setValues((prev) => ({
        ...prev,
        aidStations: prev.aidStations.map((station, stationIndex) =>
          stationIndex === index ? { ...station, ...patch } : station,
        ),
      }));
    },
    [setValues],
  );

  const getSupplies = useCallback(
    (target: PlanTarget): Supply[] => {
      if (target === 'start') return values.startSupplies ?? [];
      return values.aidStations[target]?.supplies ?? [];
    },
    [values.aidStations, values.startSupplies],
  );

  const setSuppliesForTarget = useCallback(
    (target: PlanTarget, supplies: Supply[]) => {
      if (target === 'start') {
        setValues((prev) => ({ ...prev, startSupplies: supplies }));
        return;
      }

      updateAidStation(target, { supplies });
    },
    [setValues, updateAidStation],
  );

  const increaseQty = useCallback(
    (target: PlanTarget, productId: string) => {
      setSuppliesForTarget(
        target,
        getSupplies(target).map((supply) =>
          supply.productId === productId ? { ...supply, quantity: supply.quantity + 1 } : supply,
        ),
      );
    },
    [getSupplies, setSuppliesForTarget],
  );

  const decreaseQty = useCallback(
    (target: PlanTarget, productId: string) => {
      setSuppliesForTarget(
        target,
        getSupplies(target).map((supply) =>
          supply.productId === productId ? { ...supply, quantity: Math.max(1, supply.quantity - 1) } : supply,
        ),
      );
    },
    [getSupplies, setSuppliesForTarget],
  );

  const removeSupply = useCallback(
    (target: PlanTarget, productId: string) => {
      setSuppliesForTarget(target, getSupplies(target).filter((supply) => supply.productId !== productId));
    },
    [getSupplies, setSuppliesForTarget],
  );

  const addSupplyToStation = useCallback(
    (target: PlanTarget, productId: string) => {
      const currentSupplies = getSupplies(target);
      if (currentSupplies.some((supply) => supply.productId === productId)) return;
      setSuppliesForTarget(target, [...currentSupplies, { productId, quantity: 1 }]);
    },
    [getSupplies, setSuppliesForTarget],
  );

  const addAidStation = useCallback(() => {
    const intermediates = values.aidStations.filter((station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID);
    const lastIntermediate = intermediates[intermediates.length - 1];
    const arriveeKm = values.raceDistanceKm;
    const fromKm = lastIntermediate ? lastIntermediate.distanceKm : 0;
    const rawKm = (fromKm + arriveeKm) / 2;
    const newKm = arriveeKm > 0 ? Math.min(Math.round(rawKm * 10) / 10, arriveeKm - 0.1) : 10;
    const newStation: AidStationFormItem = {
      name: `Ravito ${intermediates.length + 1}`,
      distanceKm: newKm > 0 ? newKm : 10,
      waterRefill: true,
      pauseMinutes: 0,
      supplies: [],
    };
    const arriveeIndex = values.aidStations.findIndex((station) => station.id === ARRIVEE_ID);
    const updatedStations = [...values.aidStations];
    if (arriveeIndex >= 0) updatedStations.splice(arriveeIndex, 0, newStation);
    else updatedStations.push(newStation);
    replaceAidStations(updatedStations, true);
  }, [replaceAidStations, values.aidStations, values.raceDistanceKm]);

  const autoGenerateAidStations = useCallback(() => {
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) {
      Alert.alert('Distance requise', "Renseigne d'abord la distance de la course.");
      return;
    }

    const interval = values.raceDistanceKm > 60 ? 15 : values.raceDistanceKm > 30 ? 10 : 8;
    const count = Math.floor((values.raceDistanceKm - 1) / interval);
    if (count === 0) {
      Alert.alert('Course trop courte', 'La distance est trop courte pour generer des ravitos automatiquement.');
      return;
    }

    const newIntermediates: AidStationFormItem[] = Array.from({ length: count }, (_, index) => ({
      name: `Ravito ${index + 1}`,
      distanceKm: Math.round((index + 1) * interval * 10) / 10,
      waterRefill: true,
      pauseMinutes: 0,
      supplies: [],
    }));

    Alert.alert(
      'Generer automatiquement',
      `Creer ${count} ravito(s) tous les ${interval} km ? Les ravitos existants seront remplaces.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Generer',
          onPress: () => replaceAidStations(injectSystemStations(newIntermediates, values.raceDistanceKm), true),
        },
      ],
    );
  }, [replaceAidStations, values.raceDistanceKm]);

  const fillSuppliesAuto = useCallback(async () => {
    if (!isPremium) return;

    let latestFavoriteIds = favoriteProductIds;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: favoriteRows } = await supabase
        .from('user_favorite_products')
        .select('product_id')
        .eq('user_id', user.id);
      if (favoriteRows) {
        latestFavoriteIds = new Set((favoriteRows as Array<{ product_id: string }>).map((row) => row.product_id));
        setFavoriteProductIds(latestFavoriteIds);
      }
    }

    const allUsableProducts = allProducts.filter(
      (product) => (product.carbs_g ?? 0) > 0 || (product.sodium_mg ?? 0) > 0,
    );
    const favoriteUsableProducts = allUsableProducts.filter((product) => latestFavoriteIds.has(product.id));
    const pool = favoriteUsableProducts.length > 0 ? favoriteUsableProducts : allUsableProducts;

    if (pool.length === 0) {
      Alert.alert(
        'Aucun produit disponible',
        'Ajoutez des produits a vos favoris pour utiliser le remplissage automatique',
      );
      return;
    }

    const poolAsFavorites: PoolProduct[] = pool.map((product) => ({
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

      if ((remainingCarbs > carbTolerance || remainingSodium > sodiumTolerance) && fluidMixPool.length > 0 && availableWaterMl > 0) {
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
        nextSupplies = mergeSupplyLists(nextSupplies, buildSodiumTopUpSupplies(sodiumStillMissing, sodiumSpecialists));
      }

      sectionSupplyMap.set(section.sectionIndex, nextSupplies);
    });

    const newStartSupplies = sectionSupplyMap.get(0) ?? [];
    const updatedIntermediates = values.aidStations
      .filter((station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID)
      .map((station, index) => ({
        ...station,
        supplies: sectionSupplyMap.get(index + 1) ?? [],
      }));

    setValues((prev) => ({
      ...prev,
      startSupplies: newStartSupplies,
      aidStations: injectSystemStations(updatedIntermediates, values.raceDistanceKm),
    }));
  }, [
    allProducts,
    elevationProfile,
    favoriteProductIds,
    isPremium,
    setFavoriteProductIds,
    setValues,
    values,
  ]);

  const removeAidStation = useCallback(
    (index: number) => {
      const station = values.aidStations[index];
      if (station.id === DEPART_ID || station.id === ARRIVEE_ID) return;
      replaceAidStations(values.aidStations.filter((_, stationIndex) => stationIndex !== index), true);
    },
    [replaceAidStations, values.aidStations],
  );

  const moveAidStation = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      const stations = [...values.aidStations];
      if (nextIndex < 0 || nextIndex >= stations.length) return;
      if (stations[index].id === DEPART_ID || stations[index].id === ARRIVEE_ID) return;
      if (stations[nextIndex].id === DEPART_ID || stations[nextIndex].id === ARRIVEE_ID) return;
      [stations[index], stations[nextIndex]] = [stations[nextIndex], stations[index]];
      replaceAidStations(stations, true);
    },
    [replaceAidStations, values.aidStations],
  );

  return {
    replaceAidStations,
    updateAidStation,
    getSupplies,
    setSuppliesForTarget,
    increaseQty,
    decreaseQty,
    removeSupply,
    addSupplyToStation,
    addAidStation,
    autoGenerateAidStations,
    fillSuppliesAuto,
    removeAidStation,
    moveAidStation,
  };
}

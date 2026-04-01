import { Alert } from 'react-native';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../../lib/supabase';
import { buildContinuousSections } from '../../lib/continuousNutrition';
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
import { buildPlanForTarget, injectSystemStations } from './helpers';
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

function pickBestSolidProduct(
  pool: PoolProduct[],
  carbDeficit: number,
  sodiumDeficit: number,
): PoolProduct | null {
  let best: PoolProduct | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  pool.forEach((product) => {
    const carbs = Math.max(product.carbsGrams ?? 0, 0);
    const sodium = Math.max(product.sodiumMg ?? 0, 0);
    if (carbs <= 0 && sodium <= 0) return;

    const carbAfter = Math.max(0, carbDeficit - carbs);
    const sodiumAfter = Math.max(0, sodiumDeficit - sodium);
    const carbOvershoot = Math.max(0, carbs - carbDeficit);
    const sodiumOvershoot = Math.max(0, sodium - sodiumDeficit);
    const score =
      carbAfter / Math.max(carbDeficit, 1) +
      sodiumAfter / Math.max(sodiumDeficit, 1) +
      (carbOvershoot / Math.max(carbDeficit, 20)) * 0.35 +
      (sodiumOvershoot / Math.max(sodiumDeficit, 200)) * 0.2;

    if (score < bestScore) {
      best = product;
      bestScore = score;
    }
  });

  return best;
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
    const solidPool = poolAsFavorites
      .filter((product) => !isFluidFuelType(product.fuelType))
      .sort((a, b) => (b.carbsGrams + b.sodiumMg / 100) - (a.carbsGrams + a.sodiumMg / 100))
      .slice(0, 4);
    const fluidPool = poolAsFavorites.filter((product) => isFluidFuelType(product.fuelType));
    const sections = buildContinuousSections({ values, elevationProfile });
    const assignedBySection = new Map<number, Supply[]>();
    const totalDuration = sections.at(-1)?.endMinute ?? 0;
    const carbRatePerMinute = Math.max(0, values.targetIntakePerHour / 60);
    const sodiumRatePerMinute = Math.max(0, values.sodiumIntakePerHour / 60);
    const carbTrigger = Math.max(values.targetIntakePerHour / 6, 12);
    const sodiumTrigger = Math.max(values.sodiumIntakePerHour / 6, 120);
    const minSolidGapMin = 12;
    let consumedCarbs = 0;
    let consumedSodium = 0;
    let lastSolidMinute = -minSolidGapMin;

    for (let minute = 5; minute <= Math.ceil(totalDuration); minute += 5) {
      const section = sections.find((candidate) => minute > candidate.startMinute && minute <= candidate.endMinute);
      if (!section || solidPool.length === 0) continue;

      const carbDeficit = minute * carbRatePerMinute - consumedCarbs;
      const sodiumDeficit = minute * sodiumRatePerMinute - consumedSodium;
      if (minute - lastSolidMinute < minSolidGapMin) continue;
      if (carbDeficit < carbTrigger && sodiumDeficit < sodiumTrigger) continue;

      const picked = pickBestSolidProduct(solidPool, carbDeficit, sodiumDeficit);
      if (!picked) continue;

      const sectionSupplies = assignedBySection.get(section.sectionIndex) ?? [];
      const existing = sectionSupplies.find((supply) => supply.productId === picked.id);
      if (existing) existing.quantity += 1;
      else sectionSupplies.push({ productId: picked.id, quantity: 1 });
      assignedBySection.set(section.sectionIndex, sectionSupplies);

      consumedCarbs += Math.max(picked.carbsGrams ?? 0, 0);
      consumedSodium += Math.max(picked.sodiumMg ?? 0, 0);
      lastSolidMinute = minute;
    }

    const sectionSupplyMap = new Map<number, Supply[]>();

    sections.forEach((section) => {
      let nextSupplies = [...(assignedBySection.get(section.sectionIndex) ?? [])];
      const baseCovered = sumSuppliesNutrition(nextSupplies, productsById);
      const availableWaterMl = section.waterRefill ? values.waterBagLiters * 1000 : 0;
      let remainingCarbs = Math.max(0, section.targetCarbsG - baseCovered.carbs);
      let remainingSodium = Math.max(0, section.targetSodiumMg - baseCovered.sodium);

      if ((remainingCarbs > 0 || remainingSodium > 0) && fluidPool.length > 0 && availableWaterMl > 0) {
        const fluidTopUp = buildPlanForTarget(remainingCarbs, remainingSodium, fluidPool, {
          targetWaterMl: section.targetWaterMl,
          availableWaterMl,
        });
        nextSupplies = mergeSupplyLists(nextSupplies, fluidTopUp);
        const afterFluid = sumSuppliesNutrition(nextSupplies, productsById);
        remainingCarbs = Math.max(0, section.targetCarbsG - afterFluid.carbs);
        remainingSodium = Math.max(0, section.targetSodiumMg - afterFluid.sodium);
      }

      if (remainingCarbs > 10 || remainingSodium > 100) {
        const fallbackTopUp = buildPlanForTarget(remainingCarbs, remainingSodium, poolAsFavorites, {
          targetWaterMl: section.targetWaterMl,
          availableWaterMl,
        });
        nextSupplies = mergeSupplyLists(nextSupplies, fallbackTopUp);
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

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
  type Supply,
} from './contracts';
import { addSuppliesToInventory, consumeInventoryForTargets, type CarryoverProduct } from './carryover';
import { buildPlanForTarget, getEffectiveSodiumTarget, injectSystemStations } from './helpers';
import { getGaugeTolerance } from './metrics';
import type { ElevationPoint } from './profile-utils';

type Args = {
  values: PlanFormValues;
  setValues: Dispatch<SetStateAction<PlanFormValues>>;
  allProducts: PlanProduct[];
  favoriteProductIds: Set<string>;
  setFavoriteProductIds: Dispatch<SetStateAction<Set<string>>>;
  isPremium: boolean;
  elevationProfile?: ElevationPoint[];
  onRequirePremium: () => void;
  onMissingFavoriteProducts?: () => void;
};

type PoolProduct = FavProduct & {
  fuelType?: string | null;
};

export type AutoFillProductLimit = {
  productId: string;
  maxQuantity: number | null;
};

type AutoFillShortage = {
  sectionLabel: string;
  carbsG: number;
  sodiumMg: number;
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

function normalizeAutoFillLimitMap(productLimits?: AutoFillProductLimit[]) {
  const limits = new Map<string, number>();

  productLimits?.forEach(({ productId, maxQuantity }) => {
    if (!productId || maxQuantity === null || maxQuantity === undefined) return;

    const safeQuantity = Math.floor(maxQuantity);
    if (!Number.isFinite(safeQuantity)) return;

    limits.set(productId, Math.max(0, safeQuantity));
  });

  return limits;
}

function addSupplyCounts(target: Map<string, number>, supplies: Supply[]) {
  supplies.forEach((supply) => {
    target.set(supply.productId, (target.get(supply.productId) ?? 0) + Math.max(0, Math.floor(supply.quantity)));
  });
}

function getPendingSupplyCount(pendingSupplies: Supply[] | undefined, productId: string) {
  if (!pendingSupplies || pendingSupplies.length === 0) return 0;

  return pendingSupplies.reduce(
    (total, supply) => total + (supply.productId === productId ? Math.max(0, Math.floor(supply.quantity)) : 0),
    0,
  );
}

function getRemainingProductQuantity(
  productId: string,
  productLimits: ReadonlyMap<string, number>,
  plannedProductCounts: ReadonlyMap<string, number>,
  pendingSupplies?: Supply[],
) {
  const limit = productLimits.get(productId);
  if (limit === undefined) return Number.POSITIVE_INFINITY;

  return Math.max(0, limit - (plannedProductCounts.get(productId) ?? 0) - getPendingSupplyCount(pendingSupplies, productId));
}

function buildRemainingLimitMap(
  productLimits: ReadonlyMap<string, number>,
  plannedProductCounts: ReadonlyMap<string, number>,
  pendingSupplies?: Supply[],
) {
  if (productLimits.size === 0) return undefined;

  const remaining = new Map<string, number>();
  productLimits.forEach((_, productId) => {
    remaining.set(productId, getRemainingProductQuantity(productId, productLimits, plannedProductCounts, pendingSupplies));
  });

  return remaining;
}

function filterAvailableProducts(
  products: PoolProduct[],
  productLimits: ReadonlyMap<string, number>,
  plannedProductCounts: ReadonlyMap<string, number>,
  pendingSupplies?: Supply[],
) {
  return products.filter(
    (product) => getRemainingProductQuantity(product.id, productLimits, plannedProductCounts, pendingSupplies) > 0,
  );
}

function sortByVariety(
  products: PoolProduct[],
  plannedProductCounts: ReadonlyMap<string, number>,
  scoreProduct: (product: PoolProduct) => number,
) {
  return [...products].sort((left, right) => {
    const usageDiff = (plannedProductCounts.get(left.id) ?? 0) - (plannedProductCounts.get(right.id) ?? 0);
    if (usageDiff !== 0) return usageDiff;

    const scoreDiff = scoreProduct(right) - scoreProduct(left);
    if (scoreDiff !== 0) return scoreDiff;

    return left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' });
  });
}

function pickSodiumSpecialists(products: PoolProduct[], plannedProductCounts: ReadonlyMap<string, number>) {
  return [...products]
    .filter((product) => (product.sodiumMg ?? 0) > 0)
    .sort((left, right) => {
      const usageDiff = (plannedProductCounts.get(left.id) ?? 0) - (plannedProductCounts.get(right.id) ?? 0);
      if (usageDiff !== 0) return usageDiff;

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
  remainingQuantities?: ReadonlyMap<string, number>,
) {
  let remaining = Math.max(0, sodiumGapMg);
  let supplies: Supply[] = [];

  sodiumCandidates.forEach((product) => {
    const sodiumPerUnit = Math.max(product.sodiumMg ?? 0, 0);
    const maxQuantity = Math.max(0, Math.floor(remainingQuantities?.get(product.id) ?? Number.POSITIVE_INFINITY));
    if (remaining <= 0 || sodiumPerUnit <= 0 || maxQuantity <= 0) return;

    if ((product.carbsGrams ?? 0) <= 5) {
      const quantity = Math.min(maxQuantity, Math.ceil(remaining / sodiumPerUnit));
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

function pickCarbBasePool(products: PoolProduct[], plannedProductCounts: ReadonlyMap<string, number>) {
  const carbProducts = products.filter((product) => (product.carbsGrams ?? 0) >= 8);
  const sortCarbProducts = (candidates: PoolProduct[]) =>
    sortByVariety(candidates, plannedProductCounts, (product) => product.carbsGrams);
  const gels = sortCarbProducts(carbProducts.filter((product) => product.fuelType === 'gel'));
  const bars = sortCarbProducts(carbProducts.filter((product) => product.fuelType === 'bar'));
  const foods = sortCarbProducts(carbProducts
    .filter((product) => product.fuelType === 'real_food' || product.fuelType === 'other')
  );
  const fallback = sortCarbProducts(carbProducts);

  return pickUniqueProducts([gels[0], bars[0], foods[0], fallback[0], fallback[1]].filter(Boolean) as PoolProduct[]).slice(0, 5);
}

function pickFluidMixPool(products: PoolProduct[], plannedProductCounts: ReadonlyMap<string, number>) {
  const drinkMixes = sortByVariety(
    products.filter((product) => product.fuelType === 'drink_mix'),
    plannedProductCounts,
    (product) => product.carbsGrams + product.sodiumMg / 100,
  );
  const electrolytes = sortByVariety(
    products.filter((product) => product.fuelType === 'electrolyte'),
    plannedProductCounts,
    (product) => product.sodiumMg + product.carbsGrams * 5,
  );

  return pickUniqueProducts([drinkMixes[0], drinkMixes[1], electrolytes[0], electrolytes[1]].filter(Boolean) as PoolProduct[]).slice(0, 4);
}

export function usePlanSupplies({
  values,
  setValues,
  allProducts,
  favoriteProductIds,
  setFavoriteProductIds,
  isPremium,
  elevationProfile = [],
  onRequirePremium,
  onMissingFavoriteProducts,
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
      if (values.aidStations[target]?.assistanceAllowed === false) return [];
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

      if (values.aidStations[target]?.assistanceAllowed === false) return;
      updateAidStation(target, { supplies });
    },
    [setValues, updateAidStation, values.aidStations],
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
      solidRefill: true,
      assistanceAllowed: true,
      pauseMinutes: 0,
      supplies: [],
    };
    const arriveeIndex = values.aidStations.findIndex((station) => station.id === ARRIVEE_ID);
    const updatedStations = [...values.aidStations];
    if (arriveeIndex >= 0) updatedStations.splice(arriveeIndex, 0, newStation);
    else updatedStations.push(newStation);
    replaceAidStations(updatedStations, true);
  }, [replaceAidStations, values.aidStations, values.raceDistanceKm]);

  const createAidStation = useCallback(
    (station: AidStationFormItem) => {
      const arriveeIndex = values.aidStations.findIndex((currentStation) => currentStation.id === ARRIVEE_ID);
      const intermediateStations = values.aidStations.filter(
        (currentStation) => currentStation.id !== DEPART_ID && currentStation.id !== ARRIVEE_ID,
      );

      const sanitizedStation: AidStationFormItem = {
        ...station,
        waterRefill: station.waterRefill ?? true,
        solidRefill: station.solidRefill !== false,
        assistanceAllowed: station.assistanceAllowed !== false,
        pauseMinutes: station.pauseMinutes ?? 0,
        supplies: station.assistanceAllowed === false ? [] : station.supplies ?? [],
      };

      const insertIndex = intermediateStations.findIndex(
        (currentStation) => currentStation.distanceKm > sanitizedStation.distanceKm,
      );

      const nextStations = [...values.aidStations];
      const targetIndex =
        insertIndex >= 0
          ? Math.max(1, insertIndex + 1)
          : arriveeIndex >= 0
            ? arriveeIndex
            : nextStations.length;

      nextStations.splice(targetIndex, 0, sanitizedStation);
      replaceAidStations(nextStations, true);
    },
    [replaceAidStations, values.aidStations],
  );

  const autoGenerateAidStations = useCallback(() => {
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) {
      Alert.alert('Distance requise', "Renseigne d'abord la distance de la course.");
      return;
    }

    const interval = values.raceDistanceKm > 60 ? 15 : values.raceDistanceKm > 30 ? 10 : 8;
    const count = Math.floor((values.raceDistanceKm - 1) / interval);
    if (count === 0) {
      Alert.alert('Course trop courte', 'La distance est trop courte pour générer des ravitos automatiquement.');
      return;
    }

    const newIntermediates: AidStationFormItem[] = Array.from({ length: count }, (_, index) => ({
      name: `Ravito ${index + 1}`,
      distanceKm: Math.round((index + 1) * interval * 10) / 10,
      waterRefill: true,
      solidRefill: true,
      assistanceAllowed: true,
      pauseMinutes: 0,
      supplies: [],
    }));

    Alert.alert(
      'Generer automatiquement',
      `Créer ${count} ravito(s) tous les ${interval} km ? Les ravitos existants seront remplacés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Generer',
          onPress: () => replaceAidStations(injectSystemStations(newIntermediates, values.raceDistanceKm), true),
        },
      ],
    );
  }, [replaceAidStations, values.raceDistanceKm]);

  const fillSuppliesAuto = useCallback(async (productLimits?: AutoFillProductLimit[]) => {
    if (!isPremium) {
      onRequirePremium();
      return;
    }

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

    if (favoriteUsableProducts.length === 0) {
      if (onMissingFavoriteProducts) {
        onMissingFavoriteProducts();
      } else {
        Alert.alert(
          'Aucun favori nutrition',
          "Ajoutez des produits a vos favoris dans l'onglet Nutrition pour utiliser le remplissage automatique.",
        );
      }
      return;
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
    const fluidCandidates = poolAsFavorites.filter((product) => isFluidFuelType(product.fuelType));
    const sections = buildContinuousSections({ values, elevationProfile });
    const sectionSupplyMap = new Map<number, Supply[]>();
    const carryoverProductsById: Record<string, CarryoverProduct> = Object.fromEntries(
      poolAsFavorites.map((product) => [
        product.id,
        { id: product.id, carbsGrams: product.carbsGrams, sodiumMg: product.sodiumMg },
      ]),
    );
    const inventory = new Map<string, number>();
    const balance = { carbs: 0, sodium: 0 };
    const productLimitMap = normalizeAutoFillLimitMap(productLimits);
    const plannedProductCounts = new Map<string, number>();
    const unresolvedShortages: AutoFillShortage[] = [];
    let lastAssistanceSectionIndex = 0;

    sections.forEach((section) => {
      if (section.assistanceAllowed) {
        lastAssistanceSectionIndex = section.sectionIndex;
      }

      const effectiveSectionSodiumTarget = getEffectiveSodiumTarget(section.targetSodiumMg);
      consumeInventoryForTargets({
        inventory,
        productsById: carryoverProductsById,
        balance,
        targetCarbsG: section.targetCarbsG,
        targetSodiumMg: effectiveSectionSodiumTarget,
        sectionIndex: section.sectionIndex,
      });

      let nextSupplies: Supply[] = [];
      const availableWaterMl = section.availableWaterMl ?? (section.waterRefill ? values.waterBagLiters * 1000 : 0);
      const carbTolerance = getGaugeTolerance('carbs', section.targetCarbsG);
      const sodiumTolerance = getGaugeTolerance('sodium', effectiveSectionSodiumTarget);
      let remainingCarbs = Math.max(0, -balance.carbs);
      let remainingSodium = Math.max(0, -balance.sodium);
      let remainingLimitMap = buildRemainingLimitMap(productLimitMap, plannedProductCounts, nextSupplies);
      const fluidMixPool = pickFluidMixPool(
        filterAvailableProducts(fluidCandidates, productLimitMap, plannedProductCounts, nextSupplies),
        plannedProductCounts,
      );

      if ((remainingCarbs > carbTolerance || remainingSodium > sodiumTolerance) && fluidMixPool.length > 0 && availableWaterMl > 0) {
        const fluidCarbGoal = Math.max(0, Math.min(remainingCarbs, section.targetCarbsG * 0.45));
        const fluidSodiumGoal = Math.max(0, Math.min(remainingSodium, effectiveSectionSodiumTarget * 0.6));
        const fluidTopUp = buildPlanForTarget(fluidCarbGoal, fluidSodiumGoal, fluidMixPool, {
          targetWaterMl: section.targetWaterMl,
          availableWaterMl,
          maxQuantities: remainingLimitMap,
        });
        nextSupplies = mergeSupplyLists(nextSupplies, fluidTopUp);
        const afterFluid = sumSuppliesNutrition(nextSupplies, productsById);
        remainingCarbs = Math.max(0, -balance.carbs - afterFluid.carbs);
        remainingSodium = Math.max(0, -balance.sodium - afterFluid.sodium);
      }

      remainingLimitMap = buildRemainingLimitMap(productLimitMap, plannedProductCounts, nextSupplies);
      const carbBasePool = pickCarbBasePool(
        filterAvailableProducts(solidCandidates, productLimitMap, plannedProductCounts, nextSupplies),
        plannedProductCounts,
      );
      if (remainingCarbs > carbTolerance && carbBasePool.length > 0) {
        const fallbackTopUp = buildPlanForTarget(remainingCarbs, 0, carbBasePool, {
          targetWaterMl: section.targetWaterMl,
          availableWaterMl,
          maxQuantities: remainingLimitMap,
        });
        nextSupplies = mergeSupplyLists(nextSupplies, fallbackTopUp);
      }

      const afterCarbTopUp = sumSuppliesNutrition(nextSupplies, productsById);
      const sodiumStillMissing = Math.max(0, -balance.sodium - afterCarbTopUp.sodium);
      remainingLimitMap = buildRemainingLimitMap(productLimitMap, plannedProductCounts, nextSupplies);
      const sodiumSpecialists = pickSodiumSpecialists(
        filterAvailableProducts(solidCandidates, productLimitMap, plannedProductCounts, nextSupplies),
        plannedProductCounts,
      );
      if (sodiumStillMissing > sodiumTolerance && sodiumSpecialists.length > 0) {
        nextSupplies = mergeSupplyLists(
          nextSupplies,
          buildSodiumTopUpSupplies(sodiumStillMissing, sodiumSpecialists, remainingLimitMap),
        );
      }

      const targetSectionSupplies = sectionSupplyMap.get(lastAssistanceSectionIndex) ?? [];
      sectionSupplyMap.set(lastAssistanceSectionIndex, mergeSupplyLists(targetSectionSupplies, nextSupplies));
      addSupplyCounts(plannedProductCounts, nextSupplies);
      addSuppliesToInventory(inventory, nextSupplies);
      consumeInventoryForTargets({
        inventory,
        productsById: carryoverProductsById,
        balance,
        targetCarbsG: 0,
        targetSodiumMg: 0,
        sectionIndex: section.sectionIndex,
      });

      const unresolvedCarbs = Math.max(0, -balance.carbs);
      const unresolvedSodium = Math.max(0, -balance.sodium);
      if (unresolvedCarbs > carbTolerance || unresolvedSodium > sodiumTolerance) {
        unresolvedShortages.push({
          sectionLabel: `${section.fromName} -> ${section.toName}`,
          carbsG: Math.ceil(unresolvedCarbs),
          sodiumMg: Math.ceil(unresolvedSodium),
        });
      }
    });

    const newStartSupplies = sectionSupplyMap.get(0) ?? [];
    const updatedIntermediates = values.aidStations
      .filter((station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID)
      .map((station, index) => ({
        ...station,
        solidRefill: station.solidRefill !== false,
        assistanceAllowed: station.assistanceAllowed !== false,
        supplies: station.assistanceAllowed === false ? [] : sectionSupplyMap.get(index + 1) ?? [],
      }));

    setValues((prev) => ({
      ...prev,
      startSupplies: newStartSupplies,
      aidStations: injectSystemStations(updatedIntermediates, values.raceDistanceKm),
    }));

    if (unresolvedShortages.length > 0) {
      const worstShortage = unresolvedShortages.reduce((worst, shortage) => {
        const worstScore = worst.carbsG + worst.sodiumMg / 10;
        const shortageScore = shortage.carbsG + shortage.sodiumMg / 10;
        return shortageScore > worstScore ? shortage : worst;
      });
      const missingParts = [
        worstShortage.carbsG > 0 ? `${worstShortage.carbsG} g glucides` : null,
        worstShortage.sodiumMg > 0 ? `${worstShortage.sodiumMg} mg sodium` : null,
      ].filter(Boolean);

      Alert.alert(
        'Stock insuffisant',
        `Avec les limites indiquees, le plan ne couvre pas completement ${worstShortage.sectionLabel}. Il manque encore environ ${missingParts.join(' et ')}. Ajoute des favoris ou augmente les quantites disponibles.`,
      );
    }
  }, [
    allProducts,
    elevationProfile,
    favoriteProductIds,
    isPremium,
    onMissingFavoriteProducts,
    onRequirePremium,
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
    createAidStation,
    autoGenerateAidStations,
    fillSuppliesAuto,
    removeAidStation,
    moveAidStation,
  };
}

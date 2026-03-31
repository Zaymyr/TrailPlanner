import { Alert } from 'react-native';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../../lib/supabase';
import { ARRIVEE_ID, DEPART_ID, type AidStationFormItem, type FavProduct, type PlanFormValues, type PlanProduct, type PlanTarget, type SectionSummary, type Supply } from './contracts';
import { buildPlanForTarget, injectSystemStations } from './helpers';

type Args = {
  values: PlanFormValues;
  setValues: Dispatch<SetStateAction<PlanFormValues>>;
  allProducts: PlanProduct[];
  favoriteProductIds: Set<string>;
  setFavoriteProductIds: Dispatch<SetStateAction<Set<string>>>;
  buildSectionSummary: (target: PlanTarget) => SectionSummary | null;
  isPremium: boolean;
};

export function usePlanSupplies({
  values,
  setValues,
  allProducts,
  favoriteProductIds,
  setFavoriteProductIds,
  buildSectionSummary,
  isPremium,
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
      Alert.alert('Course trop courte', 'La distance est trop courte pour générer des ravitos automatiquement.');
      return;
    }

    const newIntermediates: AidStationFormItem[] = Array.from({ length: count }, (_, index) => ({
      name: `Ravito ${index + 1}`,
      distanceKm: Math.round((index + 1) * interval * 10) / 10,
      waterRefill: true,
      supplies: [],
    }));

    Alert.alert(
      'Générer automatiquement',
      `Créer ${count} ravito(s) tous les ${interval} km ? Les ravitos existants seront remplacés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Générer',
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

    const allWithCarbs = allProducts.filter((product) => (product.carbs_g ?? 0) > 0);
    const favoritesWithCarbs = allWithCarbs.filter((product) => latestFavoriteIds.has(product.id));
    const pool = favoritesWithCarbs.length > 0 ? favoritesWithCarbs : allWithCarbs;

    if (pool.length === 0) {
      Alert.alert(
        'Aucun produit disponible',
        'Ajoutez des produits à vos favoris pour utiliser le remplissage automatique',
      );
      return;
    }

    const poolAsFavorites: FavProduct[] = pool.map((product) => ({
      id: product.id,
      name: product.name,
      carbsGrams: product.carbs_g ?? 0,
      sodiumMg: product.sodium_mg ?? 0,
    }));

    const intermediates = values.aidStations
      .filter((station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID)
      .map((station) => ({ ...station, supplies: [] as Supply[] }));
    const startDurationH = (buildSectionSummary('start')?.durationMin ?? 0) / 60;
    const newStartSupplies =
      startDurationH > 0
        ? buildPlanForTarget(
            values.targetIntakePerHour * startDurationH,
            values.sodiumIntakePerHour * startDurationH,
            poolAsFavorites,
          )
        : [];

    const updatedIntermediates = intermediates.map((station, index) => {
      const durationH = (buildSectionSummary(index + 1)?.durationMin ?? 0) / 60;
      if (durationH <= 0) return { ...station, supplies: [] as Supply[] };
      return {
        ...station,
        supplies: buildPlanForTarget(
          values.targetIntakePerHour * durationH,
          values.sodiumIntakePerHour * durationH,
          poolAsFavorites,
        ),
      };
    });

    setValues((prev) => ({
      ...prev,
      startSupplies: newStartSupplies,
      aidStations: injectSystemStations(updatedIntermediates, values.raceDistanceKm),
    }));
  }, [
    allProducts,
    buildSectionSummary,
    favoriteProductIds,
    isPremium,
    setFavoriteProductIds,
    setValues,
    values.aidStations,
    values.raceDistanceKm,
    values.sodiumIntakePerHour,
    values.targetIntakePerHour,
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

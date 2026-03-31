import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { usePremium } from '../hooks/usePremium';
import { styles, inputStyles } from './plan-form/styles';
import { ProductPickerModal, type PickerProduct } from './plan-form/ProductPickerModal';
import { EditStationModal, type EditingStation } from './plan-form/EditStationModal';
import { GaugeArc, type GaugeMetric } from './plan-form/GaugeArc';
import { AidStationsSectionV3 as AidStationsSection } from './plan-form/AidStationsSectionV3';
import { PlanBasicsSection } from './plan-form/PlanBasicsSection';
import {
  autoSegmentSection,
  buildSectionKey,
  getElevationSlice,
  getSectionSegments,
  normalizeSectionSegments,
  recomputeSectionFromSubSections,
  type ElevationPoint,
  type SectionSegment,
  type SectionSubSegmentStats,
  type SegmentPreset,
} from './plan-form/profile-utils';

// ─── Exported types ───────────────────────────────────────────────────────────

export type Supply = {
  productId: string;
  quantity: number;
};

export type AidStationFormItem = {
  id?: string;
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  supplies?: Supply[];
};

export type FavProduct = {
  id: string;
  name: string;
  carbsGrams: number;
  sodiumMg: number;
};

export type PlanFormValues = {
  name: string;
  raceDistanceKm: number;
  elevationGain: number;
  paceType: 'pace' | 'speed';
  paceMinutes: number;
  paceSeconds: number;
  speedKph: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  waterBagLiters: number;
  startSupplies: Supply[];
  aidStations: AidStationFormItem[];
  sectionSegments?: Record<string, SectionSegment[]>;
};

export type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset };

export const DEFAULT_PLAN_VALUES: PlanFormValues = {
  name: '',
  raceDistanceKm: 0,
  elevationGain: 0,
  paceType: 'pace',
  paceMinutes: 6,
  paceSeconds: 0,
  speedKph: 10,
  targetIntakePerHour: 70,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 600,
  waterBagLiters: 1.5,
  startSupplies: [],
  aidStations: [],
};

// ─── Internal types ───────────────────────────────────────────────────────────

type Product = PickerProduct;
type IntakeTimelineItem = {
  minute: number;
  label: string;
  detail: string;
  immediate?: boolean;
};

type SectionSummary = {
  sectionIndex: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  durationMin: number;
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
  profilePoints: ElevationPoint[];
  segments: SectionSegment[];
  segmentStats: SectionSubSegmentStats[];
  hasStoredSegments: boolean;
};

type Props = {
  initialValues: PlanFormValues;
  onSave: (values: PlanFormValues) => void;
  loading?: boolean;
  saveLabel?: string;
  favoriteProducts?: FavProduct[];
  elevationProfile?: ElevationPoint[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPART_ID = 'depart';
const ARRIVEE_ID = 'arrivee';

const FUEL_LABELS: Record<string, string> = {
  gel: 'GEL',
  drink_mix: 'BOISSON',
  electrolyte: 'ÉLEC',
  capsule: 'CAPS',
  bar: 'BARRE',
  real_food: 'ALIMENT',
  other: 'AUTRE',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSupplies(raw: any[] | undefined): Supply[] {
  if (!raw) return [];
  return raw.map((s) => ({ productId: s.productId, quantity: s.quantity ?? 1 }));
}

function cloneSectionSegments(
  raw: Record<string, SectionSegment[]> | undefined,
): Record<string, SectionSegment[]> | undefined {
  if (!raw) return undefined;
  const entries = Object.entries(raw).map(([key, segments]) => [key, segments.map((segment) => ({ ...segment }))] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function injectSystemStations(
  stations: AidStationFormItem[],
  distanceKm: number
): AidStationFormItem[] {
  const intermediates = stations.filter(
    (s) =>
      s.id !== DEPART_ID &&
      s.id !== ARRIVEE_ID &&
      !(s.name === 'Départ' && s.distanceKm === 0) &&
      s.name !== 'Arrivée'
  );
  return [
    { id: DEPART_ID, name: 'Départ', distanceKm: 0, waterRefill: true, supplies: [] },
    ...intermediates,
    { id: ARRIVEE_ID, name: 'Arrivée', distanceKm: distanceKm, waterRefill: false },
  ];
}

function buildPlanForTarget(
  targetFuelGrams: number,
  targetSodiumMg: number,
  products: FavProduct[]
): Supply[] {
  if (!Number.isFinite(targetFuelGrams) || targetFuelGrams <= 0) return [];

  const options = [...products]
    .sort((a, b) => b.carbsGrams - a.carbsGrams)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      carbs: Math.max(p.carbsGrams, 0),
      sodium: Math.max(p.sodiumMg ?? 0, 0),
    }));

  if (options.length === 0) return [];

  const minCarbs = Math.max(Math.min(...options.map((o) => o.carbs)), 1);
  const maxUnits = Math.min(12, Math.max(3, Math.ceil(targetFuelGrams / minCarbs) + 2));
  let best = { score: Number.POSITIVE_INFINITY, combo: [] as number[] };

  const evaluateCombo = (combo: number[]) => {
    const plannedCarbs = combo.reduce((t, qty, i) => t + qty * options[i].carbs, 0);
    const plannedSodium = combo.reduce((t, qty, i) => t + qty * options[i].sodium, 0);
    const carbDiff = Math.abs(plannedCarbs - targetFuelGrams) / Math.max(targetFuelGrams, 1);
    const sodiumDiff = targetSodiumMg > 0 ? Math.abs(plannedSodium - targetSodiumMg) / targetSodiumMg : 0;
    const underfillPenalty = plannedCarbs < targetFuelGrams ? 0.2 : 0;
    const itemPenalty = combo.reduce((s, qty) => s + qty, 0) * 0.01;
    const score = carbDiff * 1.5 + sodiumDiff * 0.5 + underfillPenalty + itemPenalty;
    if (score < best.score && plannedCarbs > 0) best = { score, combo: combo.slice() };
  };

  const search = (index: number, combo: number[], totalUnits: number) => {
    if (index === options.length) { evaluateCombo(combo); return; }
    const remainingSlots = maxUnits - totalUnits;
    for (let qty = 0; qty <= remainingSlots; qty++) {
      combo[index] = qty;
      search(index + 1, combo, totalUnits + qty);
    }
  };

  search(0, new Array(options.length).fill(0), 0);

  if (best.score === Number.POSITIVE_INFINITY || best.combo.every((q) => q === 0)) return [];

  return best.combo
    .map((qty, i) => ({ productId: options[i].id, quantity: qty }))
    .filter((s) => s.quantity > 0);
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

function NumberInput({ value, onChange, placeholder, style }: {
  value: number; onChange: (v: number) => void; placeholder?: string; style?: object;
}) {
  return (
    <TextInput
      style={[inputStyles.input, style]}
      value={value === 0 ? '' : String(value)}
      onChangeText={(t) => { const n = parseFloat(t.replace(',', '.')); onChange(isNaN(n) ? 0 : n); }}
      keyboardType="numeric"
      placeholder={placeholder ?? '0'}
      placeholderTextColor={Colors.textMuted}
    />
  );
}

// ─── PlanForm ─────────────────────────────────────────────────────────────────

export default function PlanForm({ initialValues, onSave, loading, saveLabel, favoriteProducts, elevationProfile = [] }: Props) {
  const { isPremium } = usePremium();
  const [values, setValues] = useState<PlanFormValues>({
    ...initialValues,
    startSupplies: normalizeSupplies((initialValues as any).startSupplies),
    sectionSegments: cloneSectionSegments(initialValues.sectionSegments),
    aidStations: injectSystemStations(
      initialValues.aidStations.map((s) => ({ ...s, supplies: normalizeSupplies(s.supplies) })),
      initialValues.raceDistanceKm
    ),
  });

  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
  const [productsLoading, setProductsLoading] = useState(true);
  const [pickerTarget, setPickerTarget] = useState<'start' | number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set([DEPART_ID]));
  const [expandedSections, setExpandedSections] = useState<Record<'course' | 'pace' | 'nutrition', boolean>>({
    course: true,
    pace: true,
    nutrition: true,
  });
  const [editingStation, setEditingStation] = useState<EditingStation>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: { user } }, productsResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('products')
          .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal')
          .eq('is_live', true)
          .eq('is_archived', false)
          .order('name'),
      ]);
      if (cancelled) return;

      const products = (productsResult.data ?? []) as Product[];
      setAllProducts(products);
      const map: Record<string, Product> = {};
      products.forEach((p) => { map[p.id] = p; });
      setProductMap(map);

      if (user) {
        const { data: favData } = await supabase
          .from('user_favorite_products')
          .select('product_id')
          .eq('user_id', user.id);
        if (!cancelled && favData) {
          setFavoriteProductIds(new Set((favData as any[]).map((f) => f.product_id)));
        }
      }
      if (!cancelled) setProductsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Form state helpers ─────────────────────────────────────────────────────

  function update<K extends keyof PlanFormValues>(key: K, val: PlanFormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'raceDistanceKm') {
        next.aidStations = next.aidStations.map((s) =>
          s.id === ARRIVEE_ID ? { ...s, distanceKm: val as number } : s
        );
      }
      return next;
    });
  }

  function replaceAidStations(aidStations: AidStationFormItem[], resetSectionSegments = false) {
    setValues((prev) => ({
      ...prev,
      aidStations,
      ...(resetSectionSegments ? { sectionSegments: undefined } : {}),
    }));
  }

  function getSupplies(target: 'start' | number): Supply[] {
    if (target === 'start') return values.startSupplies ?? [];
    return values.aidStations[target]?.supplies ?? [];
  }

  function setSuppliesForTarget(target: 'start' | number, supplies: Supply[]) {
    if (target === 'start') {
      update('startSupplies', supplies);
    } else {
      updateAidStation(target, { supplies });
    }
  }

  function getBaseSpeedKph() {
    return values.paceType === 'pace'
      ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
      : Math.max(values.speedKph, 0.1);
  }

  function buildSectionSummary(target: 'start' | number): SectionSummary | null {
    const sectionIndex = target === 'start' ? 0 : target;
    const fromStation = values.aidStations[sectionIndex];
    const toStation = values.aidStations[sectionIndex + 1];

    if (!fromStation || !toStation) return null;

    const startKm = fromStation.distanceKm;
    const endKm = toStation.distanceKm;
    const distanceKm = Math.max(0, endKm - startKm);
    const hasStoredSegments = Boolean(values.sectionSegments?.[buildSectionKey(sectionIndex)]?.length);
    const segments = getSectionSegments(values.sectionSegments, sectionIndex, distanceKm);
    const profilePoints =
      elevationProfile.length > 0
        ? getElevationSlice(elevationProfile, startKm, endKm)
        : [
            { distanceKm: startKm, elevationM: 0 },
            { distanceKm: endKm, elevationM: 0 },
          ];
    const recomputed = recomputeSectionFromSubSections({
      segments,
      startDistanceKm: startKm,
      elevationProfile: profilePoints,
      paceModel: { secondsPerKm: 3600 / getBaseSpeedKph() },
    });
    const durationMin = recomputed.totals.etaSeconds / 60;

    return {
      sectionIndex,
      startKm,
      endKm,
      distanceKm,
      durationMin,
      targetCarbsG: values.targetIntakePerHour * (durationMin / 60),
      targetSodiumMg: values.sodiumIntakePerHour * (durationMin / 60),
      targetWaterMl: values.waterIntakePerHour * (durationMin / 60),
      profilePoints,
      segments,
      segmentStats: recomputed.segmentStats,
      hasStoredSegments,
    };
  }

  function updateSectionSegmentPaceAdjustment(
    target: 'start' | number,
    segmentIndex: number,
    paceAdjustmentMinutesPerKm: number | undefined,
  ) {
    const summary = buildSectionSummary(target);
    if (!summary) return;

    const sectionKey = buildSectionKey(summary.sectionIndex);
    const nextSegments = summary.segments.map((segment, index) =>
      index === segmentIndex
        ? {
            ...segment,
            ...(paceAdjustmentMinutesPerKm === undefined
              ? { paceAdjustmentMinutesPerKm: undefined }
              : { paceAdjustmentMinutesPerKm }),
          }
        : segment,
    );

    setValues((prev) => ({
      ...prev,
      sectionSegments: {
        ...(prev.sectionSegments ?? {}),
        [sectionKey]: nextSegments,
      },
    }));
  }

  function splitSectionSegment(target: 'start' | number, segmentIndex: number) {
    const summary = buildSectionSummary(target);
    if (!summary) return;

    const segment = summary.segments[segmentIndex];
    const segmentStat = summary.segmentStats[segmentIndex];
    if (!segment || !segmentStat || segment.segmentKm <= 0.02) return;

    const segmentProfile = getElevationSlice(elevationProfile, segmentStat.startDistanceKm, segmentStat.endDistanceKm);
    let replacementSegments =
      segmentProfile.length > 1 ? autoSegmentSection(segmentProfile, 'moyen') : [];

    if (replacementSegments.length <= 1) {
      const firstKm = Number((segment.segmentKm / 2).toFixed(3));
      const secondKm = Number((segment.segmentKm - firstKm).toFixed(3));
      if (firstKm > 0.01 && secondKm > 0.01) {
        replacementSegments = [{ segmentKm: firstKm }, { segmentKm: secondKm }];
      }
    }

    if (replacementSegments.length <= 1) return;

    const propagatedSegments = replacementSegments.map((replacementSegment) => ({
      ...replacementSegment,
      ...(typeof segment.paceAdjustmentMinutesPerKm === 'number'
        ? { paceAdjustmentMinutesPerKm: segment.paceAdjustmentMinutesPerKm }
        : {}),
    }));
    const sectionKey = buildSectionKey(summary.sectionIndex);
    const nextSegments = normalizeSectionSegments(
      [
        ...summary.segments.slice(0, segmentIndex),
        ...propagatedSegments,
        ...summary.segments.slice(segmentIndex + 1),
      ],
      summary.distanceKm,
    );

    setValues((prev) => ({
      ...prev,
      sectionSegments: {
        ...(prev.sectionSegments ?? {}),
        [sectionKey]: nextSegments,
      },
    }));
  }

  function removeSectionSegment(target: 'start' | number, segmentIndex: number) {
    const summary = buildSectionSummary(target);
    if (!summary || segmentIndex <= 0 || summary.segments.length <= 1) return;

    const previousSegment = summary.segments[segmentIndex - 1];
    const currentSegment = summary.segments[segmentIndex];
    if (!previousSegment || !currentSegment) return;

    const mergedSegment: SectionSegment = {
      ...previousSegment,
      segmentKm: Number((previousSegment.segmentKm + currentSegment.segmentKm).toFixed(3)),
    };
    const sectionKey = buildSectionKey(summary.sectionIndex);
    const nextSegments = normalizeSectionSegments(
      [
        ...summary.segments.slice(0, segmentIndex - 1),
        mergedSegment,
        ...summary.segments.slice(segmentIndex + 1),
      ],
      summary.distanceKm,
    );

    setValues((prev) => ({
      ...prev,
      sectionSegments: {
        ...(prev.sectionSegments ?? {}),
        [sectionKey]: nextSegments,
      },
    }));
  }

  function increaseQty(target: 'start' | number, productId: string) {
    setSuppliesForTarget(
      target,
      getSupplies(target).map((s) => s.productId === productId ? { ...s, quantity: s.quantity + 1 } : s)
    );
  }

  function decreaseQty(target: 'start' | number, productId: string) {
    setSuppliesForTarget(
      target,
      getSupplies(target).map((s) => s.productId === productId ? { ...s, quantity: Math.max(1, s.quantity - 1) } : s)
    );
  }

  function removeSupply(target: 'start' | number, productId: string) {
    setSuppliesForTarget(target, getSupplies(target).filter((s) => s.productId !== productId));
  }

  function addSupplyToStation(target: 'start' | number, productId: string) {
    const curr = getSupplies(target);
    if (curr.some((s) => s.productId === productId)) return;
    setSuppliesForTarget(target, [...curr, { productId, quantity: 1 }]);
  }

  // ─── Station helpers ────────────────────────────────────────────────────────

  function addAidStation() {
    const intermediates = values.aidStations.filter((s) => s.id !== DEPART_ID && s.id !== ARRIVEE_ID);
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
    const arriveeIdx = values.aidStations.findIndex((s) => s.id === ARRIVEE_ID);
    const updated = [...values.aidStations];
    arriveeIdx >= 0 ? updated.splice(arriveeIdx, 0, newStation) : updated.push(newStation);
    replaceAidStations(updated, true);
  }

  function autoGenerateAidStations() {
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) {
      Alert.alert('Distance requise', "Renseigne d'abord la distance de la course."); return;
    }
    const interval = values.raceDistanceKm > 60 ? 15 : values.raceDistanceKm > 30 ? 10 : 8;
    const count = Math.floor((values.raceDistanceKm - 1) / interval);
    if (count === 0) {
      Alert.alert('Course trop courte', 'La distance est trop courte pour générer des ravitos automatiquement.'); return;
    }
    const newIntermediates: AidStationFormItem[] = Array.from({ length: count }, (_, i) => ({
      name: `Ravito ${i + 1}`,
      distanceKm: Math.round((i + 1) * interval * 10) / 10,
      waterRefill: true,
      supplies: [],
    }));
    Alert.alert('Générer automatiquement', `Créer ${count} ravito(s) tous les ${interval} km ? Les ravitos existants seront remplacés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Générer', onPress: () => replaceAidStations(injectSystemStations(newIntermediates, values.raceDistanceKm), true) },
    ]);
  }

  async function fillSuppliesAuto() {
    if (!isPremium) return;

    let latestFavoriteIds = favoriteProductIds;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: favData } = await supabase
        .from('user_favorite_products')
        .select('product_id')
        .eq('user_id', user.id);
      if (favData) {
        latestFavoriteIds = new Set((favData as any[]).map((f) => f.product_id));
        setFavoriteProductIds(latestFavoriteIds);
      }
    }

    // Favorites-first product pool, fallback to all products with carbs
    const allWithCarbs = allProducts.filter((p) => (p.carbs_g ?? 0) > 0);
    const favWithCarbs = allWithCarbs.filter((p) => latestFavoriteIds.has(p.id));
    const pool = favWithCarbs.length > 0 ? favWithCarbs : allWithCarbs;

    if (pool.length === 0) {
      Alert.alert(
        'Aucun produit disponible',
        'Ajoutez des produits à vos favoris pour utiliser le remplissage automatique'
      );
      return;
    }

    const poolAsFavProducts: FavProduct[] = pool.map((p) => ({
      id: p.id,
      name: p.name,
      carbsGrams: p.carbs_g ?? 0,
      sodiumMg: p.sodium_mg ?? 0,
    }));

    // Always reset supplies first so the recompute is based only on current favorites.
    const intermediates = values.aidStations
      .filter((s) => s.id !== DEPART_ID && s.id !== ARRIVEE_ID)
      .map((s) => ({ ...s, supplies: [] as Supply[] }));
    const startDurationH = (buildSectionSummary('start')?.durationMin ?? 0) / 60;
    const newStartSupplies = startDurationH > 0
      ? buildPlanForTarget(
          values.targetIntakePerHour * startDurationH,
          values.sodiumIntakePerHour * startDurationH,
          poolAsFavProducts
        )
      : [];

    const updatedIntermediates = intermediates.map((station, idx) => {
      const durationH = (buildSectionSummary(idx + 1)?.durationMin ?? 0) / 60;
      if (durationH <= 0) return { ...station, supplies: [] as Supply[] };
      const supplies = buildPlanForTarget(
        values.targetIntakePerHour * durationH,
        values.sodiumIntakePerHour * durationH,
        poolAsFavProducts
      );
      return { ...station, supplies };
    });

    setValues((prev) => ({
      ...prev,
      startSupplies: newStartSupplies,
      aidStations: injectSystemStations(updatedIntermediates, values.raceDistanceKm),
    }));
  }

  function updateAidStation(index: number, patch: Partial<AidStationFormItem>) {
    update('aidStations', values.aidStations.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeAidStation(index: number) {
    const station = values.aidStations[index];
    if (station.id === DEPART_ID || station.id === ARRIVEE_ID) return;
    replaceAidStations(values.aidStations.filter((_, i) => i !== index), true);
  }

  function moveAidStation(index: number, direction: 'up' | 'down') {
    const arr = [...values.aidStations];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    if (arr[index].id === DEPART_ID || arr[index].id === ARRIVEE_ID) return;
    if (arr[target].id === DEPART_ID || arr[target].id === ARRIVEE_ID) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    replaceAidStations(arr, true);
  }

  function handleSave() {
    if (!values.name.trim()) { Alert.alert('Champ requis', 'Le nom du plan est obligatoire.'); return; }
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) { Alert.alert('Champ requis', 'La distance doit être supérieure à 0.'); return; }
    onSave({ ...values, aidStations: values.aidStations.filter((s) => s.id !== ARRIVEE_ID) });
  }

  function toggleSection(section: 'course' | 'pace' | 'nutrition') {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // ─── Picker helpers ─────────────────────────────────────────────────────────

  function openPicker(target: 'start' | number) {
    setPickerSearch('');
    setPickerTarget(target);
  }

  function toggleStation(stationKey: string) {
    setExpandedStations((prev) => {
      const next = new Set(prev);
      if (next.has(stationKey)) next.delete(stationKey);
      else next.add(stationKey);
      return next;
    });
  }

  function handleEditSave() {
    if (!editingStation) return;
    const km = parseFloat(editingStation.km.replace(',', '.'));
    updateAidStation(editingStation.index, {
      name: editingStation.name,
      distanceKm: isNaN(km) ? 0 : km,
    });
    setEditingStation(null);
  }

  const pickerSearchLower = pickerSearch.trim().toLowerCase();
  const filteredAllProducts = allProducts.filter((p) =>
    pickerSearchLower === '' || p.name.toLowerCase().includes(pickerSearchLower)
  );
  const pickerFavorites = filteredAllProducts.filter((p) => favoriteProductIds.has(p.id));
  const pickerOthers = filteredAllProducts.filter((p) => !favoriteProductIds.has(p.id));
  const currentSupplyIds = pickerTarget !== null
    ? new Set(getSupplies(pickerTarget).map((s) => s.productId))
    : new Set<string>();

  // ─── Gauge helpers ────────────────────────────────────────────────────────────

  function getGaugeColor(key: GaugeMetric['key'], ratio: number): string {
    if (key === 'water') {
      return ratio >= 0.8 ? '#2D5016' : '#EF4444';
    }
    if (ratio === 0) return '#D1D5DB';
    if (ratio >= 0.8 && ratio <= 1.2) return '#2D5016';
    if ((ratio >= 0.6 && ratio < 0.8) || (ratio > 1.2 && ratio <= 1.4)) return '#F97316';
    return '#EF4444';
  }

  function formatGaugeValue(metric: GaugeMetric, value: number): string {
    if (metric.key === 'water') {
      const liters = value / 1000;
      const formatted = Number.isInteger(liters) ? liters.toFixed(0) : liters.toFixed(1);
      return `${formatted}L`;
    }
    return `${Math.round(value)}${metric.unit}`;
  }

  function buildGaugeMetrics(
    target: 'start' | number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ): GaugeMetric[] {
    const supplies = getSupplies(target);
    const totalCarbs = supplies.reduce((sum, s) => {
      const p = productMap[s.productId];
      return sum + (p ? (p.carbs_g ?? 0) * s.quantity : 0);
    }, 0);
    const totalSodium = supplies.reduce((sum, s) => {
      const p = productMap[s.productId];
      return sum + (p ? (p.sodium_mg ?? 0) * s.quantity : 0);
    }, 0);
    const availableWaterMl =
      target === 'start' || values.aidStations[target]?.waterRefill ? values.waterBagLiters * 1000 : 0;

    return [
      {
        key: 'carbs',
        label: 'Glucides',
        unit: 'g',
        color: '#2D5016',
        current: totalCarbs,
        target: sectionTarget?.targetCarbsG ?? 0,
        ratio: sectionTarget && sectionTarget.targetCarbsG > 0 ? totalCarbs / sectionTarget.targetCarbsG : 0,
      },
      {
        key: 'sodium',
        label: 'Sodium',
        unit: 'mg',
        color: '#3B82F6',
        current: totalSodium,
        target: sectionTarget?.targetSodiumMg ?? 0,
        ratio: sectionTarget && sectionTarget.targetSodiumMg > 0 ? totalSodium / sectionTarget.targetSodiumMg : 0,
      },
      {
        key: 'water',
        label: 'Eau',
        unit: 'ml',
        color: '#06B6D4',
        current: availableWaterMl,
        target: sectionTarget?.targetWaterMl ?? 0,
        ratio: sectionTarget && sectionTarget.targetWaterMl > 0 ? availableWaterMl / sectionTarget.targetWaterMl : 0,
      },
    ];
  }

  function buildSectionIntakeTimeline(
    target: 'start' | number,
    sectionDurationMin: number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ): IntakeTimelineItem[] {
    const supplies = getSupplies(target);
    const events: IntakeTimelineItem[] = [];
    const safeDuration = Math.max(0, sectionDurationMin);

    supplies.forEach((supply) => {
      const product = productMap[supply.productId];
      if (!product || supply.quantity <= 0) return;

      const isSmoothed = product.fuel_type === 'drink_mix' || product.fuel_type === 'electrolyte';
      if (!isSmoothed || safeDuration <= 0) {
        events.push({
          minute: 0,
          label: product.name,
          detail: `x${supply.quantity} immédiat`,
          immediate: true,
        });
        return;
      }

      for (let i = 0; i < supply.quantity; i += 1) {
        const minute = Math.max(1, Math.round(((i + 1) / (supply.quantity + 1)) * safeDuration));
        events.push({
          minute,
          label: product.name,
          detail: `prise ${i + 1}/${supply.quantity}`,
        });
      }
    });

    if (sectionTarget && sectionTarget.targetWaterMl > 0 && safeDuration > 0) {
      const availableWaterMl =
        target === 'start' || values.aidStations[target]?.waterRefill ? values.waterBagLiters * 1000 : 0;
      const plannedWaterMl = Math.min(sectionTarget.targetWaterMl, availableWaterMl);
      if (plannedWaterMl > 0) {
        const sipCount = Math.max(1, Math.round(safeDuration / 20));
        const mlPerSip = Math.max(1, Math.round(plannedWaterMl / sipCount));
        for (let i = 0; i < sipCount; i += 1) {
          const minute = Math.max(1, Math.round(((i + 1) / (sipCount + 1)) * safeDuration));
          events.push({
            minute,
            label: 'Eau',
            detail: `${mlPerSip} ml`,
          });
        }
      }
    }

    events.sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      if ((a.immediate ? 0 : 1) !== (b.immediate ? 0 : 1)) return (a.immediate ? 0 : 1) - (b.immediate ? 0 : 1);
      return a.label.localeCompare(b.label);
    });
    return events;
  }
  function buildSectionIntakeTimelineV2(
    target: 'start' | number,
    sectionDurationMin: number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ): IntakeTimelineItem[] {
    const supplies = getSupplies(target);
    const safeDuration = Math.max(0, Math.round(sectionDurationMin));
    const totalTargetCarbs = Math.max(sectionTarget?.targetCarbsG ?? 0, 0);
    const totalTargetSodium = Math.max(sectionTarget?.targetSodiumMg ?? 0, 0);
    const availableWaterMl =
      target === 'start' || values.aidStations[target]?.waterRefill ? values.waterBagLiters * 1000 : 0;
    const totalTargetWater = Math.max(Math.min(sectionTarget?.targetWaterMl ?? 0, availableWaterMl), 0);

    const expandedUnits = supplies.flatMap((supply) => {
      const product = productMap[supply.productId];
      if (!product || supply.quantity <= 0) return [];

      return Array.from({ length: supply.quantity }, () => ({
        label: product.name,
        carbs: Math.max(product.carbs_g ?? 0, 0),
        sodium: Math.max(product.sodium_mg ?? 0, 0),
        fluid: product.fuel_type === 'drink_mix' || product.fuel_type === 'electrolyte',
      }));
    });

    const events: IntakeTimelineItem[] = [];

    if (safeDuration <= 0) {
      expandedUnits.forEach((unit) => {
        const detailParts: string[] = [];
        if (unit.carbs > 0) detailParts.push(`${Math.round(unit.carbs)}g glucides`);
        if (unit.sodium > 0) detailParts.push(`${Math.round(unit.sodium)}mg sodium`);
        events.push({
          minute: 0,
          label: unit.label,
          detail: detailParts.length > 0 ? detailParts.join(' - ') : '1 prise',
          immediate: true,
        });
      });
      return events;
    }

    let cumulativeCarbs = 0;
    let cumulativeSodium = 0;
    const fluidEventMinutes: number[] = [];

    expandedUnits.forEach((unit, index) => {
      const candidates: Array<{ minute: number; weight: number }> = [];

      if (totalTargetCarbs > 0 && unit.carbs > 0) {
        const nextCarbs = cumulativeCarbs + unit.carbs;
        candidates.push({
          minute: (nextCarbs / totalTargetCarbs) * safeDuration,
          weight: unit.carbs / totalTargetCarbs,
        });
      }

      if (totalTargetSodium > 0 && unit.sodium > 0) {
        const nextSodium = cumulativeSodium + unit.sodium;
        candidates.push({
          minute: (nextSodium / totalTargetSodium) * safeDuration,
          weight: unit.sodium / totalTargetSodium,
        });
      }

      let minute = 0;
      if (candidates.length > 0) {
        const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
        minute = Math.round(
          candidates.reduce((sum, candidate) => sum + candidate.minute * candidate.weight, 0) / Math.max(totalWeight, 1),
        );
      } else {
        minute = Math.round(((index + 1) / (expandedUnits.length + 1)) * safeDuration);
      }

      minute = Math.min(safeDuration, Math.max(1, minute));
      cumulativeCarbs += unit.carbs;
      cumulativeSodium += unit.sodium;

      const detailParts: string[] = [];
      if (unit.carbs > 0) detailParts.push(`${Math.round(unit.carbs)}g glucides`);
      if (unit.sodium > 0) detailParts.push(`${Math.round(unit.sodium)}mg sodium`);
      events.push({
        minute,
        label: unit.label,
        detail: detailParts.length > 0 ? detailParts.join(' - ') : '1 prise',
      });

      if (unit.fluid) fluidEventMinutes.push(minute);
    });

    if (totalTargetWater > 0) {
      const waterRatePerMinute = totalTargetWater / safeDuration;
      let remainingWaterMl = totalTargetWater;
      let lastWaterMinute = 0;
      const waterEvents: Array<{ minute: number; amountMl: number }> = [];

      for (
        let targetMinute = Math.min(10, safeDuration);
        targetMinute <= safeDuration && remainingWaterMl > 0;
        targetMinute += 10
      ) {
        let scheduledMinute = targetMinute;

        while (
          scheduledMinute < safeDuration &&
          fluidEventMinutes.some((fluidMinute) => Math.abs(fluidMinute - scheduledMinute) <= 1)
        ) {
          scheduledMinute = Math.min(safeDuration, scheduledMinute + 2);
        }

        const elapsedMinutes = Math.max(1, scheduledMinute - lastWaterMinute);
        const sipMl = Math.min(
          remainingWaterMl,
          Math.max(1, Math.round(waterRatePerMinute * elapsedMinutes)),
        );

        waterEvents.push({ minute: scheduledMinute, amountMl: sipMl });
        remainingWaterMl = Math.max(0, remainingWaterMl - sipMl);
        lastWaterMinute = scheduledMinute;
      }

      if (remainingWaterMl > 0) {
        if (waterEvents.length > 0) {
          waterEvents[waterEvents.length - 1].amountMl += Math.round(remainingWaterMl);
        } else {
          waterEvents.push({ minute: Math.min(10, safeDuration), amountMl: Math.round(remainingWaterMl) });
        }
      }

      waterEvents.forEach((waterEvent) => {
        events.push({
          minute: waterEvent.minute,
          label: 'Eau',
          detail: `${Math.round(waterEvent.amountMl)} ml`,
        });
      });
    }

    events.sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      if ((a.label === 'Eau' ? 1 : 0) !== (b.label === 'Eau' ? 1 : 0)) {
        return (a.label === 'Eau' ? 1 : 0) - (b.label === 'Eau' ? 1 : 0);
      }
      return a.label.localeCompare(b.label);
    });

    return events;
  }
  function handleAddProductFromPicker(product: Product) {
    if (pickerTarget === null) return;
    addSupplyToStation(pickerTarget, product.id);
    if (!productMap[product.id]) setProductMap((prev) => ({ ...prev, [product.id]: product }));
  }

  function renderSupplies(target: 'start' | number) {
    const supplies = getSupplies(target);
    return (
      <View style={styles.suppliesSection}>
        <View style={styles.suppliesHeader}>
          <Text style={styles.suppliesLabel}>Produits</Text>
          <TouchableOpacity onPress={() => openPicker(target)}>
            <Text style={styles.suppliesAddBtn}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>
        {supplies.length === 0 ? (
          <Text style={styles.suppliesEmpty}>Aucun produit assigné</Text>
        ) : (
          supplies.map((supply) => {
            const product = productMap[supply.productId];
            return (
              <View key={supply.productId} style={styles.supplyRow}>
                <View style={styles.supplyInfo}>
                  <Text style={styles.supplyName} numberOfLines={1}>
                    {product?.name ?? '…'}
                  </Text>
                  {product && (
                    <>
                      <Text style={styles.supplyType}>
                        {FUEL_LABELS[product.fuel_type] ?? product.fuel_type.toUpperCase()}
                      </Text>
                      <Text style={styles.supplyMeta}>
                        {(product.carbs_g ?? 0) * supply.quantity}g glucides · {(product.sodium_mg ?? 0) * supply.quantity}mg sodium
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.supplyControls}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, supply.quantity <= 1 && styles.qtyBtnDisabled]}
                    onPress={() => decreaseQty(target, supply.productId)}
                    disabled={supply.quantity <= 1}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{supply.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => increaseQty(target, supply.productId)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeSupplyBtn} onPress={() => removeSupply(target, supply.productId)}>
                    <Text style={styles.removeSupplyText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  }

  function renderGauges(
    target: 'start' | number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
    compact = false,
  ) {
    const metrics = buildGaugeMetrics(target, sectionTarget);

    return (
      <View style={compact ? styles.gaugesRowCompact : styles.gaugesRow}>
        {metrics.map((metric) => (
          <GaugeArc
            key={metric.key}
            metric={metric}
            formatGaugeValue={formatGaugeValue}
            getGaugeColor={getGaugeColor}
            compact={compact}
          />
        ))}
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const waterBagOptions = [0.5, 1.0, 1.5, 2.0, 2.5];
  const intermediateCount = values.aidStations.filter((s) => s.id !== DEPART_ID && s.id !== ARRIVEE_ID).length;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PlanBasicsSection
          values={values}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          update={update}
          NumberInput={NumberInput}
          waterBagOptions={waterBagOptions}
        />

        <AidStationsSection
          values={values}
          basePaceMinutesPerKm={60 / getBaseSpeedKph()}
          departId={DEPART_ID}
          arriveeId={ARRIVEE_ID}
          expandedStations={expandedStations}
          toggleStation={toggleStation}
          setEditingStation={(value) => setEditingStation(value)}
          removeAidStation={removeAidStation}
          addAidStation={addAidStation}
          fillSuppliesAuto={fillSuppliesAuto}
          intermediateCount={intermediateCount}
          renderGauges={renderGauges}
          renderSupplies={renderSupplies}
          getGaugeMetrics={buildGaugeMetrics}
          getGaugeColor={getGaugeColor}
          getSectionSummary={buildSectionSummary}
          getSectionIntakeTimeline={buildSectionIntakeTimelineV2}
          onSplitSectionSegment={splitSectionSegment}
          onRemoveSectionSegment={removeSectionSegment}
          onUpdateSectionSegmentPaceAdjustment={updateSectionSegmentPaceAdjustment}
        />
        <View style={styles.saveSpacer} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.floatingSaveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={Colors.textOnBrand} />
        ) : (
          <Ionicons name="save-outline" size={20} color={Colors.textOnBrand} />
        )}
      </TouchableOpacity>

      <ProductPickerModal
        visible={pickerTarget !== null}
        pickerSearch={pickerSearch}
        setPickerSearch={setPickerSearch}
        productsLoading={productsLoading}
        pickerFavorites={pickerFavorites}
        filteredAllProducts={filteredAllProducts}
        currentSupplyIds={currentSupplyIds}
        fuelLabels={FUEL_LABELS}
        onClose={() => setPickerTarget(null)}
        onAddProduct={handleAddProductFromPicker}
      />

      <EditStationModal editingStation={editingStation} setEditingStation={setEditingStation} onSave={handleEditSave} />
    </>
  );
}

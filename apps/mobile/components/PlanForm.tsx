import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { usePremium } from '../hooks/usePremium';

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
};

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

type Product = {
  id: string;
  name: string;
  fuel_type: string;
  carbs_g: number | null;
  sodium_mg: number | null;
  calories_kcal: number | null;
};

type Props = {
  initialValues: PlanFormValues;
  onSave: (values: PlanFormValues) => void;
  loading?: boolean;
  saveLabel?: string;
  favoriteProducts?: FavProduct[];
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

const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface, color: Colors.textPrimary, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, flex: 1,
  },
});

// ─── PlanForm ─────────────────────────────────────────────────────────────────

export default function PlanForm({ initialValues, onSave, loading, saveLabel, favoriteProducts }: Props) {
  const { isPremium } = usePremium();
  const [values, setValues] = useState<PlanFormValues>({
    ...initialValues,
    startSupplies: normalizeSupplies((initialValues as any).startSupplies),
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
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());
  const [editingStation, setEditingStation] = useState<{
    index: number;
    name: string;
    km: string;
  } | null>(null);

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
    update('aidStations', updated);
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
      { text: 'Générer', onPress: () => update('aidStations', injectSystemStations(newIntermediates, values.raceDistanceKm)) },
    ]);
  }

  function fillSuppliesAuto() {
    if (!isPremium) return;

    // Favorites-first product pool, fallback to all products with carbs
    const allWithCarbs = allProducts.filter((p) => (p.carbs_g ?? 0) > 0);
    const favWithCarbs = allWithCarbs.filter((p) => favoriteProductIds.has(p.id));
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

    const speedKph = values.paceType === 'pace'
      ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
      : Math.max(values.speedKph, 0.1);

    const intermediates = values.aidStations.filter((s) => s.id !== DEPART_ID && s.id !== ARRIVEE_ID);
    const stops = [0, ...intermediates.map((s) => s.distanceKm), values.raceDistanceKm];

    const startSegKm = (stops[1] ?? values.raceDistanceKm) - 0;
    const startDurationH = startSegKm / speedKph;
    const newStartSupplies = startSegKm > 0
      ? buildPlanForTarget(
          values.targetIntakePerHour * startDurationH,
          values.sodiumIntakePerHour * startDurationH,
          poolAsFavProducts
        )
      : [];

    const updatedIntermediates = intermediates.map((station, idx) => {
      const segFrom = stops[idx + 1];
      const segTo = stops[idx + 2];
      if (segTo === undefined || segTo <= segFrom) return { ...station, supplies: [] as Supply[] };
      const durationH = (segTo - segFrom) / speedKph;
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
    update('aidStations', values.aidStations.filter((_, i) => i !== index));
  }

  function moveAidStation(index: number, direction: 'up' | 'down') {
    const arr = [...values.aidStations];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    if (arr[index].id === DEPART_ID || arr[index].id === ARRIVEE_ID) return;
    if (arr[target].id === DEPART_ID || arr[target].id === ARRIVEE_ID) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    update('aidStations', arr);
  }

  function handleSave() {
    if (!values.name.trim()) { Alert.alert('Champ requis', 'Le nom du plan est obligatoire.'); return; }
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) { Alert.alert('Champ requis', 'La distance doit être supérieure à 0.'); return; }
    onSave({ ...values, aidStations: values.aidStations.filter((s) => s.id !== ARRIVEE_ID) });
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

  function renderPickerRow(product: Product) {
    const added = currentSupplyIds.has(product.id);
    return (
      <View key={product.id} style={styles.pickerRow}>
        <View style={styles.pickerRowInfo}>
          <Text style={styles.pickerRowName} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.pickerRowType}>{FUEL_LABELS[product.fuel_type] ?? product.fuel_type.toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.pickerAddBtn, added && styles.pickerAddBtnDone]}
          onPress={() => {
            if (!added && pickerTarget !== null) {
              addSupplyToStation(pickerTarget, product.id);
              if (!productMap[product.id]) setProductMap((prev) => ({ ...prev, [product.id]: product }));
            }
          }}
          disabled={added}
        >
          <Text style={[styles.pickerAddBtnText, added && styles.pickerAddBtnTextDone]}>
            {added ? '✓ Ajouté' : '+ Ajouter'}
          </Text>
        </TouchableOpacity>
      </View>
    );
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
                    <Text style={styles.supplyType}>
                      {FUEL_LABELS[product.fuel_type] ?? product.fuel_type.toUpperCase()}
                    </Text>
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  const waterBagOptions = [0.5, 1.0, 1.5, 2.0, 2.5];
  const intermediateCount = values.aidStations.filter((s) => s.id !== DEPART_ID && s.id !== ARRIVEE_ID).length;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Course */}
        <Text style={styles.sectionTitle}>Course</Text>
        <Text style={styles.label}>Nom du plan</Text>
        <TextInput style={styles.textInput} value={values.name} onChangeText={(t) => update('name', t)} placeholder="Ex : UTMB 2025" placeholderTextColor={Colors.textMuted} />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Distance (km)</Text>
            <NumberInput value={values.raceDistanceKm} onChange={(v) => update('raceDistanceKm', v)} placeholder="50" />
          </View>
          <View style={[styles.rowItem, { marginLeft: 12 }]}>
            <Text style={styles.label}>D+ (m)</Text>
            <NumberInput value={values.elevationGain} onChange={(v) => update('elevationGain', v)} placeholder="3000" />
          </View>
        </View>

        {/* Allure */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Allure</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity style={[styles.toggleBtn, values.paceType === 'pace' && styles.toggleBtnActive]} onPress={() => update('paceType', 'pace')}>
            <Text style={[styles.toggleBtnText, values.paceType === 'pace' && styles.toggleBtnTextActive]}>Allure (min/km)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, values.paceType === 'speed' && styles.toggleBtnActive]} onPress={() => update('paceType', 'speed')}>
            <Text style={[styles.toggleBtnText, values.paceType === 'speed' && styles.toggleBtnTextActive]}>Vitesse (km/h)</Text>
          </TouchableOpacity>
        </View>
        {values.paceType === 'pace' ? (
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Minutes</Text>
              <NumberInput value={values.paceMinutes} onChange={(v) => update('paceMinutes', Math.floor(v))} placeholder="6" />
            </View>
            <View style={[styles.rowItem, { marginLeft: 12 }]}>
              <Text style={styles.label}>Secondes</Text>
              <NumberInput value={values.paceSeconds} onChange={(v) => update('paceSeconds', Math.min(59, Math.floor(v)))} placeholder="30" />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Vitesse (km/h)</Text>
            <NumberInput value={values.speedKph} onChange={(v) => update('speedKph', v)} placeholder="10" />
          </>
        )}

        {/* Nutrition */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Nutrition (cibles/heure)</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Glucides (g/h)</Text>
            <NumberInput value={values.targetIntakePerHour} onChange={(v) => update('targetIntakePerHour', v)} placeholder="70" />
          </View>
          <View style={[styles.rowItem, { marginLeft: 12 }]}>
            <Text style={styles.label}>Eau (ml/h)</Text>
            <NumberInput value={values.waterIntakePerHour} onChange={(v) => update('waterIntakePerHour', v)} placeholder="500" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Sodium (mg/h)</Text>
            <NumberInput value={values.sodiumIntakePerHour} onChange={(v) => update('sodiumIntakePerHour', v)} placeholder="600" />
          </View>
          <View style={[styles.rowItem, { marginLeft: 12 }]} />
        </View>

        <Text style={styles.label}>Volume sac à eau</Text>
        <View style={styles.waterBagRow}>
          {waterBagOptions.map((opt) => (
            <TouchableOpacity key={opt} style={[styles.waterBagBtn, values.waterBagLiters === opt && styles.waterBagBtnActive]} onPress={() => update('waterBagLiters', opt)}>
              <Text style={[styles.waterBagBtnText, values.waterBagLiters === opt && styles.waterBagBtnTextActive]}>{opt}L</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ravitaillements */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Ravitaillements</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity style={styles.fillBtn} onPress={fillSuppliesAuto}>
              <Text style={styles.fillBtnText}>⭐ Remplir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={addAidStation}>
              <Text style={styles.addBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {intermediateCount === 0 && (
          <Text style={styles.emptyText}>Pas de ravito intermédiaire. Utilise "+ Ajouter" pour en créer.</Text>
        )}

        {(() => {
          const elements: React.ReactElement[] = [];
          values.aidStations.forEach((station, index) => {
            const isDepart = station.id === DEPART_ID;
            const isArrivee = station.id === ARRIVEE_ID;
            const stationKey = station.id ?? String(index);

            let card: React.ReactElement;

            if (isDepart) {
              card = (
                <View key={stationKey} style={styles.stationCard}>
                  <View style={styles.stationHeaderRow}>
                    <Text style={styles.stationIcon}>🟢</Text>
                    <Text style={styles.stationName}>{station.name}</Text>
                    <Text style={styles.stationKm}>{station.distanceKm} km</Text>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Eau disponible</Text>
                    <Switch
                      value={station.waterRefill}
                      onValueChange={(v) => updateAidStation(index, { waterRefill: v })}
                      trackColor={{ false: Colors.border, true: Colors.brandPrimary }}
                      thumbColor={station.waterRefill ? Colors.textOnBrand : Colors.textMuted}
                    />
                  </View>
                  {renderSupplies('start')}
                </View>
              );
            } else if (isArrivee) {
              card = (
                <View key={stationKey} style={styles.stationCard}>
                  <View style={styles.stationHeaderRow}>
                    <Text style={styles.stationIcon}>🏁</Text>
                    <Text style={styles.stationName}>{station.name}</Text>
                    <Text style={styles.stationKm}>{station.distanceKm} km</Text>
                  </View>
                </View>
              );
            } else {
              const isExpanded = expandedStations.has(stationKey);
              card = (
                <View key={stationKey} style={styles.stationCard}>
                  <TouchableOpacity
                    onPress={() => toggleStation(stationKey)}
                    activeOpacity={0.7}
                    style={styles.stationHeaderRow}
                  >
                    <Text style={styles.stationIcon}>📍</Text>
                    <Text style={styles.stationName} numberOfLines={1}>{station.name}</Text>
                    <Text style={styles.stationKm}>{station.distanceKm} km</Text>
                    <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {isExpanded && (
                    <>
                      <View style={styles.cardDivider} />
                      <View style={styles.editDeleteRow}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() =>
                            setEditingStation({ index, name: station.name, km: String(station.distanceKm) })
                          }
                        >
                          <Text style={styles.editBtnText}>✏️ Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => removeAidStation(index)}>
                          <Text style={styles.deleteBtnText}>🗑️ Supprimer</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.cardDivider} />
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Eau disponible</Text>
                        <Switch
                          value={station.waterRefill}
                          onValueChange={(v) => updateAidStation(index, { waterRefill: v })}
                          trackColor={{ false: Colors.border, true: Colors.brandPrimary }}
                          thumbColor={station.waterRefill ? Colors.textOnBrand : Colors.textMuted}
                        />
                      </View>
                      {renderSupplies(index)}
                    </>
                  )}
                </View>
              );
            }

            elements.push(card);

            if (index < values.aidStations.length - 1) {
              const nextSt = values.aidStations[index + 1];
              const distKm = nextSt.distanceKm - station.distanceKm;
              const speedKph =
                values.paceType === 'pace'
                  ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
                  : Math.max(values.speedKph, 0.1);
              const durationMin = (distKm / speedKph) * 60;
              const hours = Math.floor(durationMin / 60);
              const mins = Math.round(durationMin % 60);
              const timeLabel =
                hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
              elements.push(
                <View key={`sep-${index}`} style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>
                    {distKm.toFixed(1)} km · {timeLabel}
                  </Text>
                  <View style={styles.separatorLine} />
                </View>
              );
            }
          });
          return elements;
        })()}

        <TouchableOpacity style={[styles.saveButton, loading && styles.saveButtonDisabled]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.textOnBrand} /> : <Text style={styles.saveButtonText}>{saveLabel ?? 'Enregistrer'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Product picker modal */}
      <Modal visible={pickerTarget !== null} transparent animationType="slide" onRequestClose={() => setPickerTarget(null)}>
        <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={() => setPickerTarget(null)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir un produit</Text>
              <TouchableOpacity onPress={() => setPickerTarget(null)} style={styles.pickerCloseBtn}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.pickerSearchInput}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Rechercher..."
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
            />

            {productsLoading ? (
              <ActivityIndicator color={Colors.brandPrimary} style={{ marginTop: 24 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {pickerFavorites.length > 0 && (
                  <>
                    <Text style={styles.pickerSectionTitle}>Mes favoris</Text>
                    {pickerFavorites.map(renderPickerRow)}
                  </>
                )}
                <Text style={styles.pickerSectionTitle}>Tous les produits</Text>
                {filteredAllProducts.length === 0 ? (
                  <Text style={styles.pickerEmpty}>Aucun produit trouvé.</Text>
                ) : (
                  filteredAllProducts.map(renderPickerRow)
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit station modal */}
      <Modal
        visible={editingStation !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingStation(null)}
      >
        <Pressable style={styles.editModalOverlay} onPress={() => setEditingStation(null)}>
          <Pressable style={styles.editModalCard} onPress={() => {}}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Modifier le ravitaillement</Text>
              <TouchableOpacity onPress={() => setEditingStation(null)} style={styles.pickerCloseBtn}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.textInput}
              value={editingStation?.name ?? ''}
              onChangeText={(t) =>
                setEditingStation((prev) => (prev ? { ...prev, name: t } : prev))
              }
              placeholder="Nom du ravitaillement"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Distance (km)</Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 20 }]}
              value={editingStation?.km ?? ''}
              onChangeText={(t) =>
                setEditingStation((prev) => (prev ? { ...prev, km: t } : prev))
              }
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleEditSave}>
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandPrimary, marginBottom: 12 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  textInput: { backgroundColor: Colors.surface, color: Colors.textPrimary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 4 },
  stationInput: { backgroundColor: Colors.surfaceSecondary, color: Colors.textPrimary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  rowItem: { flex: 1 },
  toggleRow: { flexDirection: 'row', backgroundColor: Colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 4, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: Colors.surface },
  toggleBtnText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  toggleBtnTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  waterBagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  waterBagBtn: { backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.border },
  waterBagBtnActive: { backgroundColor: Colors.brandPrimary, borderColor: Colors.brandPrimary },
  waterBagBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  waterBagBtnTextActive: { color: Colors.textOnBrand },
  sectionActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  fillBtn: { backgroundColor: 'transparent', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#7C3AED' },
  fillBtnText: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },
  addBtn: { backgroundColor: 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.brandLight },
  addBtnText: { color: Colors.brandLight, fontSize: 14, fontWeight: '600' },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  stationCard: { backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  stationCardSystem: { backgroundColor: Colors.surfaceSecondary },
  stationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stationHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  stationIcon: { fontSize: 16, marginRight: 8 },
  stationName: { flex: 1, color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
  stationKm: { color: Colors.textSecondary, fontSize: 13 },
  chevron: { color: Colors.textMuted, fontSize: 12, marginLeft: 8 },
  cardDivider: { height: 1, backgroundColor: Colors.border },
  editDeleteRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  editBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.dangerSurface },
  deleteBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  separator: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, paddingHorizontal: 8 },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorText: { marginHorizontal: 10, color: Colors.textMuted, fontSize: 12 },
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  editModalCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, width: '100%' },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editModalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  stationOrderButtons: { flexDirection: 'row', gap: 4, marginRight: 8 },
  orderBtn: { backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  orderBtnDisabled: { opacity: 0.3 },
  orderBtnText: { color: Colors.textSecondary, fontSize: 14 },
  stationIndex: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  stationSystemLabel: { flex: 1, color: Colors.brandPrimary, fontSize: 14, fontWeight: '700' },
  stationLockedKm: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  arriveeNote: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dangerSurface, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  switchLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  // Supplies within station card
  suppliesSection: { marginTop: 0, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 6 },
  suppliesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  suppliesLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  suppliesAddBtn: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '600' },
  suppliesEmpty: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  supplyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  supplyInfo: { flex: 1 },
  supplyName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  supplyType: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  supplyControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  qtyText: { color: Colors.textPrimary, fontWeight: '700', minWidth: 24, textAlign: 'center', fontSize: 15 },
  removeSupplyBtn: { paddingLeft: 8 },
  removeSupplyText: { color: Colors.danger, fontSize: 18 },
  // Save
  saveButton: { backgroundColor: Colors.brandPrimary, borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginTop: 32 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: Colors.textOnBrand, fontSize: 17, fontWeight: '700' },
  // Picker modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '80%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  pickerCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  pickerCloseText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  pickerSearchInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary, marginBottom: 12 },
  pickerSectionTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 6 },
  pickerEmpty: { color: Colors.textMuted, fontSize: 14, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerRowInfo: { flex: 1, marginRight: 12 },
  pickerRowName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  pickerRowType: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  pickerAddBtn: { backgroundColor: 'transparent', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.brandPrimary },
  pickerAddBtnDone: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimary },
  pickerAddBtnText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '600' },
  pickerAddBtnTextDone: { color: Colors.textOnBrand },
});

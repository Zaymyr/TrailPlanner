import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { usePremium } from '../hooks/usePremium';
import { useI18n } from '../lib/i18n';
import { AidStationsSectionV3 as AidStationsSection } from './plan-form/AidStationsSectionV3';
import {
  ARRIVEE_ID,
  DEPART_ID,
  DEFAULT_PLAN_VALUES,
  FUEL_LABELS,
  type AccordionSection,
  type AidStationFormItem,
  type FavProduct,
  type PlanFormValues,
  type PlanTarget,
  type Supply,
} from './plan-form/contracts';
import { EditStationModal, type EditingStation } from './plan-form/EditStationModal';
import { buildInitialPlanValues, getEffectiveSodiumTarget } from './plan-form/helpers';
import {
  buildGaugeMetrics,
  buildPlanHighlights,
  buildSectionIntakeTimelineV2,
  formatGaugeValue,
  getGaugeColor,
} from './plan-form/metrics';
import { NumberInput } from './plan-form/NumberInput';
import { PlanBasicsSection } from './plan-form/PlanBasicsSection';
import { PlanHighlightsSection } from './plan-form/PlanHighlightsSection';
import { ProductPickerModal, type PickerProduct } from './plan-form/ProductPickerModal';
import { PremiumUpsellModal } from './premium/PremiumUpsellModal';
import { styles } from './plan-form/styles';
import { usePlanProducts } from './plan-form/usePlanProducts';
import { usePlanSections } from './plan-form/usePlanSections';
import { usePlanSupplies } from './plan-form/usePlanSupplies';
import type { GaugeMetric } from './plan-form/GaugeArc';
import type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset } from './plan-form/profile-utils';
import {
  buildContinuousIntakeTimeline,
  buildContinuousSections,
  buildSectionTimelineFromContinuous,
} from '../lib/continuousNutrition';

export type { Supply, AidStationFormItem, FavProduct, PlanFormValues };
export type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset };
export { DEFAULT_PLAN_VALUES };

type Props = {
  initialValues: PlanFormValues;
  onSave: (values: PlanFormValues) => void;
  onValuesChange?: (values: PlanFormValues) => void;
  loading?: boolean;
  saveLabel?: string;
  favoriteProducts?: FavProduct[];
  elevationProfile?: ElevationPoint[];
  compactBasicsByDefault?: boolean;
};

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];

function getTargetCacheKey(target: PlanTarget) {
  return target === 'start' ? 'start' : String(target);
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function PlanForm({
  initialValues,
  onSave,
  onValuesChange,
  loading,
  saveLabel,
  favoriteProducts,
  elevationProfile = [],
  compactBasicsByDefault = false,
}: Props) {
  const { isPremium } = usePremium();
  const { t } = useI18n();
  const [values, setValues] = useState<PlanFormValues>(() => buildInitialPlanValues(initialValues));
  const debouncedValues = useDebounced(values, 300);
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set([DEPART_ID]));
  const [expandedSections, setExpandedSections] = useState<Record<AccordionSection, boolean>>({
    course: !compactBasicsByDefault,
    pace: !compactBasicsByDefault,
    nutrition: !compactBasicsByDefault,
    summary: !compactBasicsByDefault,
  });
  const [editingStation, setEditingStation] = useState<EditingStation>(null);
  const [gaugeAnimateSignals, setGaugeAnimateSignals] = useState<Record<string, number>>({});
  const [showPremiumUpsell, setShowPremiumUpsell] = useState(false);

  void favoriteProducts;
  void saveLabel;

  useEffect(() => {
    setValues(buildInitialPlanValues(initialValues));
    setExpandedStations(new Set([DEPART_ID]));
    setExpandedSections({
      course: !compactBasicsByDefault,
      pace: !compactBasicsByDefault,
      nutrition: !compactBasicsByDefault,
      summary: !compactBasicsByDefault,
    });
    setEditingStation(null);
    setGaugeAnimateSignals({});
    setShowPremiumUpsell(false);
  }, [compactBasicsByDefault, initialValues]);

  const openPremiumUpsell = useCallback(() => {
    setShowPremiumUpsell(true);
  }, []);

  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);

  const triggerGaugeAnimation = useCallback((target: PlanTarget) => {
    const key = getTargetCacheKey(target);
    setGaugeAnimateSignals((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  const update = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'raceDistanceKm') {
        next.aidStations = next.aidStations.map((station) =>
          station.id === ARRIVEE_ID ? { ...station, distanceKm: value as number } : station,
        );
      }
      return next;
    });
  };

  const {
    baseSpeedKph,
    buildSectionSummary,
    getSectionSegmentControls,
    updateSectionSegmentPaceAdjustment,
    splitSectionSegment,
    removeSectionSegment,
  } = usePlanSections({ values, setValues, elevationProfile });

  const {
    productMap,
    allProducts,
    favoriteProductIds,
    setFavoriteProductIds,
    productsLoading,
    pickerTarget,
    setPickerTarget,
    pickerSearch,
    setPickerSearch,
    pickerSort,
    setPickerSort,
    filteredAllProducts,
    pickerFavorites,
    currentSupplyIds,
    openPicker,
  } = usePlanProducts({ values });

  const {
    updateAidStation,
    getSupplies,
    increaseQty,
    decreaseQty,
    removeSupply,
    addSupplyToStation,
    addAidStation,
    fillSuppliesAuto,
    removeAidStation,
  } = usePlanSupplies({
    values,
    setValues,
    allProducts,
    favoriteProductIds,
    setFavoriteProductIds,
    buildSectionSummary,
    isPremium,
    elevationProfile,
    onRequirePremium: openPremiumUpsell,
  });

  const basePaceMinutesPerKm = 60 / baseSpeedKph;
  const aidStationsSummaryKey = useMemo(
    () =>
      values.aidStations
        .map((station) => `${station.id ?? ''}|${station.distanceKm}|${station.pauseMinutes ?? 0}|${station.name}`)
        .join(';'),
    [values.aidStations],
  );
  const liveSectionSummaries = useMemo(
    () =>
      values.aidStations
        .slice(0, -1)
        .map((_, index) => buildSectionSummary(index === 0 ? 'start' : index))
        .filter((summary): summary is NonNullable<typeof summary> => summary !== null),
    [buildSectionSummary, aidStationsSummaryKey],
  );
  const liveSectionSummaryMap = useMemo(() => {
    const map = new Map<number, (typeof liveSectionSummaries)[number]>();
    liveSectionSummaries.forEach((summary) => {
      map.set(summary.sectionIndex, summary);
    });
    return map;
  }, [liveSectionSummaries]);
  const getSectionSummaryForTarget = useCallback(
    (target: PlanTarget) => liveSectionSummaryMap.get(target === 'start' ? 0 : target) ?? null,
    [liveSectionSummaryMap],
  );
  const highlights = useMemo(
    () =>
      buildPlanHighlights({
        values: debouncedValues,
        productMap,
        buildSectionSummary: getSectionSummaryForTarget,
      }),
    [getSectionSummaryForTarget, productMap, debouncedValues],
  );
  const continuousSections = useMemo(
    () => buildContinuousSections({ values: debouncedValues, elevationProfile }),
    [elevationProfile, debouncedValues],
  );
  const continuousTimeline = useMemo(
    () => buildContinuousIntakeTimeline({ values: debouncedValues, productMap, elevationProfile }),
    [elevationProfile, productMap, debouncedValues],
  );
  const paceLabel = useMemo(() => {
    const safeMinutesPerKm = highlights.totalDurationMin / Math.max(values.raceDistanceKm, 0.01);
    const totalSeconds = Math.max(1, Math.round(safeMinutesPerKm * 60));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [highlights.totalDurationMin, values.raceDistanceKm]);

  const gaugeMetricsMap = useMemo(() => {
    const map = new Map<string, GaugeMetric[]>();

    liveSectionSummaries.forEach((summary) => {
      const target: PlanTarget = summary.sectionIndex === 0 ? 'start' : summary.sectionIndex;
      map.set(
        getTargetCacheKey(target),
        buildGaugeMetrics({
          target,
          sectionTarget: {
            targetCarbsG: summary.targetCarbsG,
            targetSodiumMg: getEffectiveSodiumTarget(summary.targetSodiumMg),
            targetWaterMl: summary.targetWaterMl,
          },
          getSupplies,
          productMap,
          aidStations: values.aidStations,
          waterBagLiters: values.waterBagLiters,
        }),
      );
    });

    return map;
  }, [getSupplies, liveSectionSummaries, productMap, values.aidStations, values.waterBagLiters]);

  const getGaugeMetricsForTarget = useCallback(
    (
      target: PlanTarget,
      sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
    ) => {
      const cached = gaugeMetricsMap.get(getTargetCacheKey(target));
      if (cached) return cached;

      const effectiveSectionTarget = sectionTarget
        ? {
            ...sectionTarget,
            targetSodiumMg: getEffectiveSodiumTarget(sectionTarget.targetSodiumMg),
          }
        : undefined;

      return buildGaugeMetrics({
        target,
        sectionTarget: effectiveSectionTarget,
        getSupplies,
        productMap,
        aidStations: values.aidStations,
        waterBagLiters: values.waterBagLiters,
      });
    },
    [gaugeMetricsMap, getSupplies, productMap, values.aidStations, values.waterBagLiters],
  );

  const sectionTimelineMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof buildSectionTimelineFromContinuous>>();
    continuousSections.forEach((section) => {
      map.set(section.sectionIndex, buildSectionTimelineFromContinuous(continuousTimeline, section));
    });
    return map;
  }, [continuousSections, continuousTimeline]);

  const getSectionIntakeTimeline = useCallback((
    target: PlanTarget,
    sectionDurationMin: number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ) => {
    const targetIndex = target === 'start' ? 0 : target;
    const sectionTimeline = sectionTimelineMap.get(targetIndex);

    if (sectionTimeline) {
      return sectionTimeline;
    }

    return buildSectionIntakeTimelineV2({
      target,
      sectionDurationMin,
      sectionTarget,
      getSupplies,
      productMap,
      aidStations: values.aidStations,
      waterBagLiters: values.waterBagLiters,
    });
  }, [getSupplies, productMap, sectionTimelineMap, values.aidStations, values.waterBagLiters]);

  const toggleSection = (section: AccordionSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleStation = useCallback((stationKey: string) => {
    setExpandedStations((prev) => {
      const next = new Set(prev);
      if (next.has(stationKey)) next.delete(stationKey);
      else next.add(stationKey);
      return next;
    });
  }, []);

  const handleAddProductFromPicker = useCallback((product: PickerProduct) => {
    if (pickerTarget === null) return;
    addSupplyToStation(pickerTarget, product.id);
    triggerGaugeAnimation(pickerTarget);
  }, [pickerTarget, addSupplyToStation, triggerGaugeAnimation]);

  const handleIncreaseQty = useCallback((target: Parameters<typeof increaseQty>[0], productId: string) => {
    increaseQty(target, productId);
    triggerGaugeAnimation(target);
  }, [increaseQty, triggerGaugeAnimation]);

  const handleDecreaseQty = useCallback((target: Parameters<typeof decreaseQty>[0], productId: string) => {
    decreaseQty(target, productId);
    triggerGaugeAnimation(target);
  }, [decreaseQty, triggerGaugeAnimation]);

  const handleRemoveSupply = useCallback((target: Parameters<typeof removeSupply>[0], productId: string) => {
    removeSupply(target, productId);
    triggerGaugeAnimation(target);
  }, [removeSupply, triggerGaugeAnimation]);

  const getGaugeAnimateSignal = useCallback((target: PlanTarget) => {
    return gaugeAnimateSignals[getTargetCacheKey(target)] ?? 0;
  }, [gaugeAnimateSignals]);

  const handleEditSave = () => {
    if (!editingStation) return;
    const km = parseFloat(editingStation.km.replace(',', '.'));
    const pauseMinutes = parseFloat(editingStation.pauseMinutes.replace(',', '.'));
    updateAidStation(editingStation.index, {
      name: editingStation.name,
      distanceKm: Number.isNaN(km) ? 0 : km,
      pauseMinutes: Number.isNaN(pauseMinutes) ? 0 : Math.max(0, pauseMinutes),
    });
    setEditingStation(null);
  };

  const handleSave = () => {
    if (!values.name.trim()) {
      Alert.alert('Champ requis', 'Le nom du plan est obligatoire.');
      return;
    }
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) {
      Alert.alert('Champ requis', 'La distance doit etre superieure a 0.');
      return;
    }

    onSave({
      ...values,
      aidStations: values.aidStations.filter((station) => station.id !== ARRIVEE_ID),
    });
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <PlanBasicsSection
          values={values}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          update={update}
          NumberInput={NumberInput}
          waterBagOptions={WATER_BAG_OPTIONS}
        />

        <PlanHighlightsSection
          expanded={expandedSections.summary}
          onToggle={() => toggleSection('summary')}
          totalDurationLabel={highlights.totalDurationLabel}
          paceLabel={paceLabel}
          intermediateCount={highlights.intermediateCount}
          plannedCarbsG={highlights.plannedCarbsG}
          plannedSodiumMg={highlights.plannedSodiumMg}
          productBreakdown={highlights.productBreakdown}
        />

        <View>
          <AidStationsSection
            values={values}
            basePaceMinutesPerKm={basePaceMinutesPerKm}
            departId={DEPART_ID}
            arriveeId={ARRIVEE_ID}
            expandedStations={expandedStations}
            toggleStation={toggleStation}
            setEditingStation={setEditingStation}
            removeAidStation={removeAidStation}
            addAidStation={addAidStation}
            fillSuppliesAuto={fillSuppliesAuto}
            isPremium={isPremium}
            intermediateCount={highlights.intermediateCount}
            getSupplies={getSupplies}
            openPicker={openPicker}
            increaseQty={handleIncreaseQty}
            decreaseQty={handleDecreaseQty}
            removeSupply={handleRemoveSupply}
            productMap={productMap}
            fuelLabels={FUEL_LABELS}
            getGaugeMetrics={getGaugeMetricsForTarget}
            getGaugeColor={getGaugeColor}
            formatGaugeValue={formatGaugeValue}
            getSectionSummary={getSectionSummaryForTarget}
            getSectionIntakeTimeline={getSectionIntakeTimeline}
            getGaugeAnimateSignal={getGaugeAnimateSignal}
            getSectionSegmentControls={getSectionSegmentControls}
            onSplitSectionSegment={splitSectionSegment}
            onRemoveSectionSegment={removeSectionSegment}
            onUpdateSectionSegmentPaceAdjustment={updateSectionSegmentPaceAdjustment}
          />
        </View>

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
        pickerSort={pickerSort}
        setPickerSort={setPickerSort}
        productsLoading={productsLoading}
        pickerFavorites={pickerFavorites}
        filteredAllProducts={filteredAllProducts}
        currentSupplyIds={currentSupplyIds}
        fuelLabels={FUEL_LABELS}
        onClose={() => setPickerTarget(null)}
        onAddProduct={handleAddProductFromPicker}
      />

      <EditStationModal editingStation={editingStation} setEditingStation={setEditingStation} onSave={handleEditSave} />
      <PremiumUpsellModal
        visible={showPremiumUpsell}
        title={t.plans.autoFillPremiumTitle}
        message={t.plans.autoFillPremiumMessage}
        onClose={() => setShowPremiumUpsell(false)}
      />
    </>
  );
}

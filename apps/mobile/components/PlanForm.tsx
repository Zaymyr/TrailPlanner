import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { usePremium } from '../hooks/usePremium';
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
import { styles } from './plan-form/styles';
import { usePlanProducts } from './plan-form/usePlanProducts';
import { usePlanSections } from './plan-form/usePlanSections';
import { usePlanSupplies } from './plan-form/usePlanSupplies';
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
  const scrollRef = useRef<ScrollView>(null);
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
  const [gaugeAnimateSignal, setGaugeAnimateSignal] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [aidStationsTopY, setAidStationsTopY] = useState(0);

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
    setGaugeAnimateSignal(0);
  }, [compactBasicsByDefault, initialValues]);

  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);

  const triggerGaugeAnimation = useCallback(() => {
    setGaugeAnimateSignal((prev) => prev + 1);
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
    canSplitSectionSegment,
    canRemoveSectionSegment,
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
  });

  const basePaceMinutesPerKm = 60 / baseSpeedKph;
  const highlights = useMemo(
    () =>
      buildPlanHighlights({
        values: debouncedValues,
        productMap,
        buildSectionSummary,
      }),
    [buildSectionSummary, productMap, debouncedValues],
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

  const getGaugeMetricsForTarget = (
    target: PlanTarget,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ) => {
    // Keep the displayed sodium need aligned with the effective planning target
    // so the gauge and the ravito verdict talk about the same reference.
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
  };

  const getSectionIntakeTimeline = (
    target: PlanTarget,
    sectionDurationMin: number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ) => {
    const targetIndex = target === 'start' ? 0 : target;
    const section = continuousSections.find((candidate) => candidate.sectionIndex === targetIndex);

    if (section) {
      return buildSectionTimelineFromContinuous(continuousTimeline, section);
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
  };

  const toggleSection = (section: AccordionSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleStation = (stationKey: string) => {
    setExpandedStations((prev) => {
      const next = new Set(prev);
      if (next.has(stationKey)) next.delete(stationKey);
      else next.add(stationKey);
      return next;
    });
  };

  const handleAddProductFromPicker = useCallback((product: PickerProduct) => {
    if (pickerTarget === null) return;
    addSupplyToStation(pickerTarget, product.id);
    triggerGaugeAnimation();
  }, [pickerTarget, addSupplyToStation, triggerGaugeAnimation]);

  const handleIncreaseQty = useCallback((target: Parameters<typeof increaseQty>[0], productId: string) => {
    increaseQty(target, productId);
    triggerGaugeAnimation();
  }, [increaseQty, triggerGaugeAnimation]);

  const handleDecreaseQty = useCallback((target: Parameters<typeof decreaseQty>[0], productId: string) => {
    decreaseQty(target, productId);
    triggerGaugeAnimation();
  }, [decreaseQty, triggerGaugeAnimation]);

  const handleRemoveSupply = useCallback((target: Parameters<typeof removeSupply>[0], productId: string) => {
    removeSupply(target, productId);
    triggerGaugeAnimation();
  }, [removeSupply, triggerGaugeAnimation]);

  const handleScrollY = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  }, []);

  const handleAidStationsLayout = useCallback((event: { nativeEvent: { layout: { y: number } } }) => {
    setAidStationsTopY(event.nativeEvent.layout.y);
  }, []);

  const handleRequestParentScroll = useCallback((nextY: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, nextY), animated: false });
  }, []);

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
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScrollY}
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

        <View onLayout={handleAidStationsLayout}>
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
            getSectionSummary={buildSectionSummary}
            getSectionIntakeTimeline={getSectionIntakeTimeline}
            gaugeAnimateSignal={gaugeAnimateSignal}
            canSplitSectionSegment={canSplitSectionSegment}
            canRemoveSectionSegment={canRemoveSectionSegment}
            onSplitSectionSegment={splitSectionSegment}
            onRemoveSectionSegment={removeSectionSegment}
            onUpdateSectionSegmentPaceAdjustment={updateSectionSegmentPaceAdjustment}
            parentScrollY={scrollY}
            containerTopY={aidStationsTopY}
            onRequestParentScroll={handleRequestParentScroll}
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
    </>
  );
}

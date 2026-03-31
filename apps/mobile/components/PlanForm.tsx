import React, { useMemo, useState } from 'react';
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
import { buildInitialPlanValues } from './plan-form/helpers';
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

export type { Supply, AidStationFormItem, FavProduct, PlanFormValues };
export type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset };
export { DEFAULT_PLAN_VALUES };

type Props = {
  initialValues: PlanFormValues;
  onSave: (values: PlanFormValues) => void;
  loading?: boolean;
  saveLabel?: string;
  favoriteProducts?: FavProduct[];
  elevationProfile?: ElevationPoint[];
  compactBasicsByDefault?: boolean;
};

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];

export default function PlanForm({
  initialValues,
  onSave,
  loading,
  saveLabel,
  favoriteProducts,
  elevationProfile = [],
  compactBasicsByDefault = false,
}: Props) {
  const { isPremium } = usePremium();
  const [values, setValues] = useState<PlanFormValues>(() => buildInitialPlanValues(initialValues));
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set([DEPART_ID]));
  const [expandedSections, setExpandedSections] = useState<Record<AccordionSection, boolean>>({
    course: !compactBasicsByDefault,
    pace: !compactBasicsByDefault,
    nutrition: !compactBasicsByDefault,
    summary: !compactBasicsByDefault,
  });
  const [editingStation, setEditingStation] = useState<EditingStation>(null);
  const [gaugeAnimateSignal, setGaugeAnimateSignal] = useState(0);

  void favoriteProducts;
  void saveLabel;

  const triggerGaugeAnimation = () => {
    setGaugeAnimateSignal((prev) => prev + 1);
  };

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
  });

  const basePaceMinutesPerKm = 60 / baseSpeedKph;
  const highlights = useMemo(
    () =>
      buildPlanHighlights({
        values,
        productMap,
        buildSectionSummary,
      }),
    [buildSectionSummary, productMap, values],
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
  ) =>
    buildGaugeMetrics({
      target,
      sectionTarget,
      getSupplies,
      productMap,
      aidStations: values.aidStations,
      waterBagLiters: values.waterBagLiters,
    });

  const getSectionIntakeTimeline = (
    target: PlanTarget,
    sectionDurationMin: number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ) =>
    buildSectionIntakeTimelineV2({
      target,
      sectionDurationMin,
      sectionTarget,
      getSupplies,
      productMap,
      aidStations: values.aidStations,
      waterBagLiters: values.waterBagLiters,
    });

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

  const handleAddProductFromPicker = (product: PickerProduct) => {
    if (pickerTarget === null) return;
    addSupplyToStation(pickerTarget, product.id);
    triggerGaugeAnimation();
  };

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
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          increaseQty={(target, productId) => {
            increaseQty(target, productId);
            triggerGaugeAnimation();
          }}
          decreaseQty={(target, productId) => {
            decreaseQty(target, productId);
            triggerGaugeAnimation();
          }}
          removeSupply={(target, productId) => {
            removeSupply(target, productId);
            triggerGaugeAnimation();
          }}
          productMap={productMap}
          fuelLabels={FUEL_LABELS}
          getGaugeMetrics={getGaugeMetricsForTarget}
          getGaugeColor={getGaugeColor}
          formatGaugeValue={formatGaugeValue}
          getSectionSummary={buildSectionSummary}
          getSectionIntakeTimeline={getSectionIntakeTimeline}
          gaugeAnimateSignal={gaugeAnimateSignal}
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

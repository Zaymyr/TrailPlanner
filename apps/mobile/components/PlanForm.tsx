import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { TutorialTarget, type TutorialMeasurableTarget } from './help/SpotlightTutorial';
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
import { type PlanProductsBootstrap, usePlanProducts } from './plan-form/usePlanProducts';
import { usePlanSections } from './plan-form/usePlanSections';
import { usePlanSupplies } from './plan-form/usePlanSupplies';
import type { GaugeMetric } from './plan-form/GaugeArc';
import type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset } from './plan-form/profile-utils';
import {
  buildContinuousIntakeTimeline,
  buildContinuousSections,
  buildSectionTimelineFromContinuous,
} from '../lib/continuousNutrition';
import type { PlanEditTutorialTargetKey } from '../hooks/usePlanEditTutorial';

export type { Supply, AidStationFormItem, FavProduct, PlanFormValues };
export type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset };
export { DEFAULT_PLAN_VALUES };

type Props = {
  initialValues: PlanFormValues;
  onSave: (values: PlanFormValues) => void;
  onValuesChange?: (values: PlanFormValues) => void;
  loading?: boolean;
  isPremium: boolean;
  saveLabel?: string;
  productData?: PlanProductsBootstrap | null;
  elevationProfile?: ElevationPoint[];
  compactBasicsByDefault?: boolean;
  onMissingFavoriteProducts?: () => void;
  tutorial?: {
    scrollRef: React.MutableRefObject<ScrollView | null>;
    onContentSizeChange: (height: number) => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollSettled: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onTargetMeasure: (targetKey: PlanEditTutorialTargetKey, layout: LayoutRectangle) => void;
    onTargetRegisterRef: (targetKey: PlanEditTutorialTargetKey, ref: TutorialMeasurableTarget) => void;
  };
};

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];
const AUTO_FILL_LOADING_MESSAGES = [
  'Analyse du parcours...',
  'Dosage des ravitos...',
  'Optimisation gourmande...',
] as const;
const AUTO_FILL_MIN_LOADING_MS = 2400;

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
  isPremium,
  saveLabel,
  productData,
  elevationProfile = [],
  compactBasicsByDefault = false,
  onMissingFavoriteProducts,
  tutorial,
}: Props) {
  const { t } = useI18n();
  const [values, setValues] = useState<PlanFormValues>(() => buildInitialPlanValues(initialValues));
  const debouncedValues = useDebounced(values, 300);
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Record<AccordionSection, boolean>>({
    course: !compactBasicsByDefault,
    pace: !compactBasicsByDefault,
    nutrition: !compactBasicsByDefault,
    summary: !compactBasicsByDefault,
  });
  const [editingStation, setEditingStation] = useState<EditingStation>(null);
  const [gaugeAnimateSignals, setGaugeAnimateSignals] = useState<Record<string, number>>({});
  const [showPremiumUpsell, setShowPremiumUpsell] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillLoadingMessage, setAutoFillLoadingMessage] = useState<string>(AUTO_FILL_LOADING_MESSAGES[0]);
  const mainScrollRef = useRef<ScrollView>(null);
  const mainScrollYRef = useRef(0);
  const aidStationsSectionYRef = useRef(0);
  const lastAidStationsAlignAtRef = useRef(0);
  const autoFillMessageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  void saveLabel;

  useEffect(() => {
    setValues(buildInitialPlanValues(initialValues));
    setExpandedStations(new Set());
    setExpandedSections({
      course: !compactBasicsByDefault,
      pace: !compactBasicsByDefault,
      nutrition: !compactBasicsByDefault,
      summary: !compactBasicsByDefault,
    });
    setEditingStation(null);
    setGaugeAnimateSignals({});
    setShowPremiumUpsell(false);
    setIsAutoFilling(false);
    setAutoFillLoadingMessage(AUTO_FILL_LOADING_MESSAGES[0]);
  }, [compactBasicsByDefault, initialValues]);

  const clearAutoFillLoadingInterval = useCallback(() => {
    if (autoFillMessageIntervalRef.current) {
      clearInterval(autoFillMessageIntervalRef.current);
      autoFillMessageIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAutoFillLoadingInterval();
    };
  }, [clearAutoFillLoadingInterval]);

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
    hasSectionTimingOverrides,
    getSectionSegmentControls,
    updateSectionSegmentPaceAdjustment,
    splitSectionSegment,
    removeSectionSegment,
    resetSectionTimingOverrides,
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
  } = usePlanProducts({ values, initialData: productData });

  const {
    updateAidStation,
    getSupplies,
    increaseQty,
    decreaseQty,
    removeSupply,
    addSupplyToStation,
    createAidStation,
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
    onMissingFavoriteProducts,
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

  const alignAidStationsSection = useCallback(() => {
    const targetY = Math.max(0, aidStationsSectionYRef.current - 12);
    const now = Date.now();

    if (Math.abs(mainScrollYRef.current - targetY) < 24) return;
    if (now - lastAidStationsAlignAtRef.current < 300) return;

    lastAidStationsAlignAtRef.current = now;
    mainScrollRef.current?.scrollTo({ y: targetY, animated: true });
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

    const trimmedName = editingStation.name.trim();
    const km = parseFloat(editingStation.km.replace(',', '.'));
    const pauseMinutes = parseFloat(editingStation.pauseMinutes.replace(',', '.'));

    const nextDistanceKm = Number.isNaN(km) ? 0 : km;
    const nextPauseMinutes = Number.isNaN(pauseMinutes) ? 0 : Math.max(0, pauseMinutes);
    const fallbackName =
      editingStation.mode === 'create'
        ? `Ravito ${values.aidStations.filter((station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID).length + 1}`
        : values.aidStations[editingStation.index]?.name ?? 'Ravito';
    const nextName = trimmedName || fallbackName;

    if (editingStation.mode === 'create') {
      createAidStation({
        name: nextName,
        distanceKm: nextDistanceKm,
        waterRefill: true,
        pauseMinutes: nextPauseMinutes,
        supplies: [],
      });
      setEditingStation(null);
      return;
    }

    updateAidStation(editingStation.index, {
      name: nextName,
      distanceKm: nextDistanceKm,
      pauseMinutes: nextPauseMinutes,
    });
    setEditingStation(null);
  };

  const handleAddAidStationPress = useCallback(() => {
    const intermediates = values.aidStations.filter(
      (station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID,
    );
    const lastIntermediate = intermediates[intermediates.length - 1];
    const arriveeKm = values.raceDistanceKm;
    const fromKm = lastIntermediate ? lastIntermediate.distanceKm : 0;
    const rawKm = (fromKm + arriveeKm) / 2;
    const suggestedKm = arriveeKm > 0 ? Math.min(Math.round(rawKm * 10) / 10, arriveeKm - 0.1) : 10;

    setEditingStation({
      mode: 'create',
      index: -1,
      name: `Ravito ${intermediates.length + 1}`,
      km: suggestedKm > 0 ? String(suggestedKm) : '10',
      pauseMinutes: '0',
    });
  }, [values.aidStations, values.raceDistanceKm]);

  const handleFillSuppliesAuto = useCallback(async () => {
    if (!isPremium) {
      void Promise.resolve(fillSuppliesAuto());
      return;
    }

    if (isAutoFilling) return;

    let messageIndex = 0;
    setAutoFillLoadingMessage(AUTO_FILL_LOADING_MESSAGES[messageIndex]);
    setIsAutoFilling(true);
    clearAutoFillLoadingInterval();

    autoFillMessageIntervalRef.current = setInterval(() => {
      messageIndex = (messageIndex + 1) % AUTO_FILL_LOADING_MESSAGES.length;
      setAutoFillLoadingMessage(AUTO_FILL_LOADING_MESSAGES[messageIndex]);
    }, 850);

    try {
      await Promise.all([
        Promise.resolve(fillSuppliesAuto()),
        new Promise((resolve) => setTimeout(resolve, AUTO_FILL_MIN_LOADING_MS)),
      ]);
    } finally {
      clearAutoFillLoadingInterval();
      setIsAutoFilling(false);
      setAutoFillLoadingMessage(AUTO_FILL_LOADING_MESSAGES[0]);
    }
  }, [clearAutoFillLoadingInterval, fillSuppliesAuto, isAutoFilling, isPremium]);

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

  const handleTutorialTargetMeasure = useCallback(
    (targetKey: PlanEditTutorialTargetKey, layout: LayoutRectangle) => {
      if (targetKey === 'aidStations' || targetKey === 'views' || targetKey === 'autoFill') {
        const normalizedLayout = {
          ...layout,
          y: layout.y + aidStationsSectionYRef.current,
        };

        tutorial?.onTargetMeasure(targetKey, normalizedLayout);
        return;
      }

      tutorial?.onTargetMeasure(targetKey, layout);
    },
    [tutorial],
  );

  const setScrollRefs = useCallback(
    (node: ScrollView | null) => {
      mainScrollRef.current = node;

      if (tutorial) {
        tutorial.scrollRef.current = node;
      }
    },
    [tutorial],
  );

  return (
    <>
      <ScrollView
        ref={setScrollRefs}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onContentSizeChange={(_, height) => tutorial?.onContentSizeChange(height)}
        onScroll={(event) => {
          mainScrollYRef.current = event.nativeEvent.contentOffset.y;
          tutorial?.onScroll(event);
        }}
        onMomentumScrollEnd={tutorial?.onScrollSettled}
        onScrollEndDrag={tutorial?.onScrollSettled}
      >
        <TutorialTarget
          onMeasure={handleTutorialTargetMeasure}
          onRegisterRef={tutorial?.onTargetRegisterRef}
          targetKey="basics"
        >
          <View>
            <PlanBasicsSection
              values={values}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              update={update}
              hasSectionTimingOverrides={hasSectionTimingOverrides}
              onResetSectionTimingOverrides={resetSectionTimingOverrides}
              NumberInput={NumberInput}
              waterBagOptions={WATER_BAG_OPTIONS}
            />
          </View>
        </TutorialTarget>

        <TutorialTarget
          onMeasure={handleTutorialTargetMeasure}
          onRegisterRef={tutorial?.onTargetRegisterRef}
          targetKey="summary"
        >
          <View>
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
          </View>
        </TutorialTarget>

        <View
          onLayout={(event) => {
            aidStationsSectionYRef.current = event.nativeEvent.layout.y;
          }}
        >
          <AidStationsSection
            values={values}
            basePaceMinutesPerKm={basePaceMinutesPerKm}
            departId={DEPART_ID}
            arriveeId={ARRIVEE_ID}
            expandedStations={expandedStations}
            toggleStation={toggleStation}
            setEditingStation={setEditingStation}
            removeAidStation={removeAidStation}
            addAidStation={handleAddAidStationPress}
            fillSuppliesAuto={handleFillSuppliesAuto}
            isAutoFilling={isAutoFilling}
            autoFillLoadingMessage={autoFillLoadingMessage}
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
            onNestedScrollInteractionStart={alignAidStationsSection}
            tutorial={
              tutorial
                ? {
                    onTargetMeasure: handleTutorialTargetMeasure,
                    onTargetRegisterRef: tutorial.onTargetRegisterRef,
                  }
                : undefined
            }
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
      {showPremiumUpsell ? (
        <PremiumUpsellModal
          visible={showPremiumUpsell}
          title={t.plans.autoFillPremiumTitle}
          message={t.plans.autoFillPremiumMessage}
          onClose={() => setShowPremiumUpsell(false)}
        />
      ) : null}
    </>
  );
}

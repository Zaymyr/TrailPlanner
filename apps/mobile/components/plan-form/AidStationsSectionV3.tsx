import Ionicons from '@expo/vector-icons/Ionicons';
import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  type LayoutRectangle,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native';
import {
  AidStationIcon,
  colors,
  radius,
  shadows,
  spacing
} from '@pace-yourself/design-system';
import { TutorialTarget, type TutorialMeasurableTarget } from '../help/SpotlightTutorial';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text, Text as ThemedText } from '../themed/Text';
import type { GaugeMetric } from './GaugeArc';
import { GaugesRow } from './GaugesRow';
import { AidStationCoveragePanel } from './AidStationCoveragePanel';
import { AidStationProfileSegmentCard } from './AidStationProfileSegmentCard';
import { ProfileMiniChart } from './ProfileMiniChart';
import { SuppliesList } from './SuppliesList';
import type { EditingStation } from './EditStationModal';
import type {
  IntakeTimelineItem,
  PlanFormValues,
  PlanProduct,
  PlanTarget,
  SectionSummary,
  SectionTarget
} from './contracts';
import { adjustedPaceMinutesPerKm, getElevationSlice } from './profile-utils';
import {
  formatPace,
  formatSectionDuration,
  formatSectionTarget,
  formatTimelineMinute,
  getSegmentCardTitle,
  parsePaceInput,
} from './aidStationPresentationHelpers';
import { styles } from './styles';
import type { PlanEditTutorialTargetKey } from '../../hooks/usePlanEditTutorial';
import { findPlanViewAnchorAtFocus, getPlanViewScrollTarget } from '../../lib/planWorkspace';

type Props = {
  values: Pick<PlanFormValues, 'sectionSegments' | 'aidStations' | 'fatigueLevel'>;
  basePaceMinutesPerKm: number;
  departId: string;
  arriveeId: string;
  expandedStations: Set<string>;
  toggleStation: (stationKey: string) => void;
  setEditingStation: (value: EditingStation) => void;
  removeAidStation: (index: number) => void;
  addAidStation: () => void;
  fillSuppliesAuto: () => void;
  isAutoFilling: boolean;
  autoFillLoadingMessage: string;
  isPremium: boolean;
  intermediateCount: number;
  getSupplies: (target: PlanTarget) => { productId: string; quantity: number }[];
  openPicker: (target: PlanTarget) => void;
  increaseQty: (target: PlanTarget, productId: string) => void;
  decreaseQty: (target: PlanTarget, productId: string) => void;
  removeSupply: (target: PlanTarget, productId: string) => void;
  productMap: Record<string, PlanProduct>;
  fuelLabels: Record<string, string>;
  getGaugeMetrics: (target: PlanTarget, sectionTarget?: SectionTarget) => GaugeMetric[];
  getGaugeColor: (key: GaugeMetric['key'], ratio: number) => string;
  formatGaugeValue: (metric: GaugeMetric, value: number) => string;
  getSectionSummary: (target: PlanTarget) => SectionSummary | null;
  getSectionIntakeTimeline: (
    target: PlanTarget,
    sectionDurationMin: number,
    sectionTarget?: SectionTarget,
  ) => IntakeTimelineItem[];
  getGaugeAnimateSignal: (target: PlanTarget) => number;
  getSectionSegmentControls: (
    target: PlanTarget,
  ) => {
    canSplit: boolean;
    canRemove: boolean;
  }[];
  onSplitSectionSegment: (target: PlanTarget, segmentIndex: number) => void;
  onRemoveSectionSegment: (target: PlanTarget, segmentIndex: number) => void;
  onUpdateSectionSegmentPaceAdjustment: (
    target: PlanTarget,
    segmentIndex: number,
    paceAdjustmentMinutesPerKm: number | undefined,
  ) => void;
  getParentScrollY: () => number;
  getSectionTop: () => number;
  parentFocusOffset: number;
  scrollParentTo: (y: number) => void;
  onViewModeChange?: (mode: PlanViewMode) => void;
  onToolbarLayout?: (top: number, height: number) => void;
  toolbarHidden?: boolean;
  tutorial?: {
    onTargetMeasure: (targetKey: PlanEditTutorialTargetKey, layout: LayoutRectangle) => void;
    onTargetRegisterRef: (targetKey: PlanEditTutorialTargetKey, ref: TutorialMeasurableTarget) => void;
  };
};

export type PlanViewMode = 'stations' | 'sections' | 'profile';

export type AidStationsSectionHandle = {
  selectViewMode: (mode: PlanViewMode) => void;
  updateParentScroll: (scrollY: number) => void;
};

type ToolbarProps = {
  mode: PlanViewMode;
  onSelectMode: (mode: PlanViewMode) => void;
  addAidStation: () => void;
  fillSuppliesAuto: () => void;
  isAutoFilling: boolean;
  autoFillLoadingMessage: string;
  isPremium: boolean;
  compact?: boolean;
  tutorial?: Props['tutorial'];
};

export function AidStationsToolbar({
  mode,
  onSelectMode,
  addAidStation,
  fillSuppliesAuto,
  isAutoFilling,
  autoFillLoadingMessage,
  isPremium,
  compact = false,
  tutorial,
}: ToolbarProps) {
  return (
    <View style={[planDetailStyles.toolbar, compact && planDetailStyles.toolbarCompact]}>
      <TutorialTarget
        onMeasure={tutorial?.onTargetMeasure ?? (() => undefined)}
        onRegisterRef={tutorial?.onTargetRegisterRef}
        style={compact ? planDetailStyles.toolbarTabsTargetCompact : undefined}
        targetKey="views"
      >
        <View accessibilityRole="tablist" style={[styles.toggleRow, planDetailStyles.toolbarTabs, compact && planDetailStyles.toolbarTabsCompact]}>
          {([
            ['stations', 'Ravitos'],
            ['sections', 'Chronologie'],
            ['profile', 'Allures'],
          ] as const).map(([key, label]) => (
            <TouchableOpacity
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === key }}
              key={key}
              style={[styles.toggleBtn, compact && planDetailStyles.toolbarTabCompact, mode === key && styles.toggleBtnActive]}
              onPress={() => onSelectMode(key)}
              activeOpacity={0.8}
            >
              <Text
                adjustsFontSizeToFit={compact}
                minimumFontScale={0.82}
                numberOfLines={1}
                style={[styles.toggleBtnText, compact && planDetailStyles.toolbarTabTextCompact, mode === key && styles.toggleBtnTextActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TutorialTarget>
      {compact ? <View style={planDetailStyles.toolbarDivider} /> : null}
      <View style={[styles.sectionActions, planDetailStyles.toolbarActions, compact && planDetailStyles.toolbarActionsCompact]}>
        <TutorialTarget
          onMeasure={tutorial?.onTargetMeasure ?? (() => undefined)}
          onRegisterRef={tutorial?.onTargetRegisterRef}
          targetKey="autoFill"
        >
          <TouchableOpacity
            accessibilityLabel="Remplir automatiquement"
            accessibilityRole="button"
            style={[
              styles.fillBtn,
              compact && planDetailStyles.toolbarIconAction,
              !isPremium && styles.fillBtnPremiumLocked,
              isAutoFilling && styles.fillBtnLoading,
            ]}
            onPress={fillSuppliesAuto}
            disabled={isAutoFilling}
            activeOpacity={0.88}
          >
            <View style={styles.fillBtnContent}>
              {isAutoFilling ? (
                compact
                  ? <ActivityIndicator size="small" color={colors.text.inverse} />
                  : <><ActivityIndicator size="small" color={colors.text.inverse} /><Text style={[styles.fillBtnText, styles.fillBtnTextLoading]} numberOfLines={1}>{autoFillLoadingMessage}</Text></>
              ) : (
                compact
                  ? <Ionicons name="sparkles" size={18} color={isPremium ? colors.text.inverse : colors.accent.amber} />
                  : <Text style={[styles.fillBtnText, !isPremium && styles.fillBtnTextPremiumLocked]}>Remplir auto</Text>
              )}
            </View>
          </TouchableOpacity>
        </TutorialTarget>
        <TouchableOpacity
          accessibilityLabel="Ajouter un ravitaillement"
          accessibilityRole="button"
          style={[styles.addBtn, compact && planDetailStyles.toolbarIconActionSecondary]}
          onPress={addAidStation}
        >
          {compact
            ? <Ionicons name="add" size={22} color={colors.brand.forest} />
            : <Text style={styles.addBtnText}>+ Ajouter</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const AidStationsSectionV3 = forwardRef<AidStationsSectionHandle, Props>(function AidStationsSectionV3({
  values,
  basePaceMinutesPerKm,
  departId,
  arriveeId,
  expandedStations,
  toggleStation,
  setEditingStation,
  removeAidStation,
  addAidStation,
  fillSuppliesAuto,
  isAutoFilling,
  autoFillLoadingMessage,
  isPremium,
  intermediateCount,
  getSupplies,
  openPicker,
  increaseQty,
  decreaseQty,
  removeSupply,
  productMap,
  fuelLabels,
  getGaugeMetrics,
  getGaugeColor,
  formatGaugeValue,
  getSectionSummary,
  getSectionIntakeTimeline,
  getGaugeAnimateSignal,
  getSectionSegmentControls,
  onSplitSectionSegment,
  onRemoveSectionSegment,
  onUpdateSectionSegmentPaceAdjustment,
  getParentScrollY,
  getSectionTop,
  parentFocusOffset,
  scrollParentTo,
  onViewModeChange,
  onToolbarLayout,
  toolbarHidden = false,
  tutorial,
}: Props, ref) {
  const pendingSyncRef = useRef<null | { mode: PlanViewMode; stationId: string | null }>(null);
  const activeViewTopRef = useRef(0);
  const focusedAidStationIdRef = useRef<string | null>(values.aidStations[0]?.id ?? null);
  const viewAnchorsRef = useRef<
    Record<
      PlanViewMode,
      Record<
        number,
        {
          top: number;
          bottom: number;
        }
      >
    >
  >({
    stations: {},
    sections: {},
    profile: {},
  });
  const [selectedViewMode, setSelectedViewMode] = useState<PlanViewMode>('stations');
  const [focusedAidStationId, setFocusedAidStationId] = useState<string | null>(values.aidStations[0]?.id ?? null);
  const [paceDrafts, setPaceDrafts] = useState<Record<string, string>>({});
  const [anchorsVersion, setAnchorsVersion] = useState(0);
  const aidStationsMetaKey = useMemo(
    () =>
      values.aidStations
        .map(
          (station) =>
            `${station.id ?? ''}|${station.distanceKm}|${station.pauseMinutes ?? 0}|${station.name}|${station.waterRefill !== false}|${station.solidRefill !== false}|${station.assistanceAllowed !== false}`,
        )
        .join(';'),
    [values.aidStations],
  );
  const paceStepMinutes = 5 / 60;

  function getStationBadge(index: number, stationId: string | undefined) {
    if (stationId === departId) return 'D';
    if (stationId === arriveeId) return 'A';
    return `R${index}`;
  }

  function renderStationBadge(label: string, compact = false) {
    return (
      <View style={[compact ? styles.stationBadgeMini : styles.stationBadge, planDetailStyles.stationBadge]}>
        <AidStationIcon
          color={colors.brand.forest}
          size={compact ? 13 : 15}
          strokeWidth={2.1}
        />
        <DataText
          tone="brand"
          size="xs"
          weight="semibold"
          style={compact ? planDetailStyles.stationBadgeMiniText : planDetailStyles.stationBadgeText}
        >
          {label}
        </DataText>
      </View>
    );
  }

  function renderPauseBadge(pauseMinutes: number | undefined) {
    const safePause = Math.max(0, Math.round(pauseMinutes ?? 0));
    if (safePause <= 0) return null;

    return (
      <View style={styles.stationPauseBadge}>
        <Text style={styles.stationPauseText}>+{safePause} min</Text>
      </View>
    );
  }

  function getServiceLabel(waterRefill: boolean, solidRefill: boolean) {
    if (waterRefill && solidRefill) return 'Eau + solide';
    if (waterRefill) return 'Eau seulement';
    if (solidRefill) return 'Solide seulement';
    return 'Aucun service';
  }

  function renderServiceChips(station: PlanFormValues['aidStations'][number], isDepart: boolean, isArrivee: boolean) {
    if (isArrivee) return null;

    const waterRefill = isDepart || station.waterRefill !== false;
    const solidRefill = isDepart || station.solidRefill !== false;
    const assistanceAllowed = isDepart || station.assistanceAllowed !== false;
    const serviceLabel = isDepart ? 'Stock initial' : getServiceLabel(waterRefill, solidRefill);
    const active = waterRefill || solidRefill;

    return (
      <View style={styles.stationServiceChipRow}>
        <View style={[styles.stationServiceChip, active && styles.stationServiceChipActive]}>
          <Ionicons
            name={waterRefill && solidRefill ? 'restaurant-outline' : waterRefill ? 'water-outline' : solidRefill ? 'nutrition-outline' : 'remove-circle-outline'}
            size={13}
            color={active ? colors.brand.forest : colors.text.tertiary}
          />
          <Text style={[styles.stationServiceChipText, active && styles.stationServiceChipTextActive]}>
            {serviceLabel}
          </Text>
        </View>
        {!isDepart ? (
          <View style={[styles.stationServiceChip, assistanceAllowed && styles.stationServiceChipActive]}>
            <Ionicons
              name={assistanceAllowed ? 'people-outline' : 'walk-outline'}
              size={13}
              color={assistanceAllowed ? colors.brand.forest : colors.text.tertiary}
            />
            <Text style={[styles.stationServiceChipText, assistanceAllowed && styles.stationServiceChipTextActive]}>
              {assistanceAllowed ? 'Assistance' : 'Sans assistance'}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  function setPaceDraft(key: string, value: string) {
    setPaceDrafts((prev) => ({ ...prev, [key]: value }));
  }

  function clearPaceDraft(key: string) {
    setPaceDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function applyAbsolutePace(
    target: 'start' | number,
    segmentIndex: number,
    paceMinutesPerKm: number | undefined,
    referencePaceMinutesPerKm: number,
    draftKey?: string,
  ) {
    if (paceMinutesPerKm === undefined) {
      onUpdateSectionSegmentPaceAdjustment(target, segmentIndex, undefined);
      if (draftKey) clearPaceDraft(draftKey);
      return;
    }

    const nextPace = Math.max(0.01, paceMinutesPerKm);
    onUpdateSectionSegmentPaceAdjustment(target, segmentIndex, nextPace - referencePaceMinutesPerKm);
    if (draftKey) {
      setPaceDraft(draftKey, formatPace(nextPace));
    }
  }

  function getStationIdentity(index: number) {
    const station = values.aidStations[index];
    if (!station) return null;
    return station.id ?? `__station_index_${index}`;
  }

  function getStationIdAtIndex(index: number) {
    return getStationIdentity(index);
  }

  function getStationIndexById(stationId: string | null | undefined, fallbackIndex = 0) {
    if (!stationId) return fallbackIndex;
    const resolvedIndex = values.aidStations.findIndex((_, index) => getStationIdentity(index) === stationId);
    return resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;
  }

  function commitFocusedAidStation(index: number) {
    const nextStationId = getStationIdAtIndex(index);
    focusedAidStationIdRef.current = nextStationId;
    setFocusedAidStationId((prev) => (prev === nextStationId ? prev : nextStationId));
    return nextStationId;
  }

  const contextAnchorIndex = useMemo(() => {
    return getStationIndexById(focusedAidStationId, 0);
  }, [focusedAidStationId, values.aidStations]);

  useEffect(() => {
    const nextIndex = getStationIndexById(focusedAidStationIdRef.current, -1);
    if (nextIndex >= 0) {
      setFocusedAidStationId((prev) => (prev === focusedAidStationIdRef.current ? prev : focusedAidStationIdRef.current));
      return;
    }

    const fallbackStationId = values.aidStations[0]?.id ?? null;
    focusedAidStationIdRef.current = fallbackStationId;
    setFocusedAidStationId((prev) => (prev === fallbackStationId ? prev : fallbackStationId));
  }, [values.aidStations]);

  const registerAnchor = useCallback((mode: PlanViewMode, index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const nextTop = Math.round(y);
    const nextBottom = Math.round(y + height);
    const prev = viewAnchorsRef.current[mode][index];
    if (prev?.top === nextTop && prev?.bottom === nextBottom) return;
    viewAnchorsRef.current[mode][index] = { top: nextTop, bottom: nextBottom };
    setAnchorsVersion((prevVersion) => prevVersion + 1);
  }, []);

  function getTopVisibleAnchor(mode: PlanViewMode, parentScrollY = getParentScrollY()) {
    const focusLineY = parentScrollY + parentFocusOffset - getSectionTop() - activeViewTopRef.current;

    const anchors = Object.entries(viewAnchorsRef.current[mode])
      .map(([index, anchor]) => ({ index: Number(index), top: anchor.top, bottom: anchor.bottom }))
      .sort((a, b) => a.top - b.top);

    if (anchors.length === 0) {
      return { index: 0, stationId: getStationIdAtIndex(0) };
    }

    const chosen = findPlanViewAnchorAtFocus(anchors, focusLineY) ?? anchors[0];
    return {
      index: chosen.index,
      stationId: getStationIdAtIndex(chosen.index),
    };
  }

  function getAnchorTopForStation(mode: PlanViewMode, stationId: string | null | undefined) {
    const anchorIndex = getStationIndexById(stationId, 0);
    const anchor = viewAnchorsRef.current[mode][anchorIndex];
    if (!anchor) return null;
    return { anchorIndex, top: anchor.top };
  }

  function alignParentScroll(
    nextMode: PlanViewMode,
    stationId = focusedAidStationIdRef.current,
  ) {
    const targetAnchor = getAnchorTopForStation(nextMode, stationId);
    if (!targetAnchor) return false;
    const nextParentScrollY = getPlanViewScrollTarget(
      getSectionTop(),
      activeViewTopRef.current,
      targetAnchor.top,
      parentFocusOffset,
    );
    scrollParentTo(nextParentScrollY);
    return true;
  }

  function captureFocusedStation(mode: PlanViewMode, parentScrollY = getParentScrollY()) {
    const anchor = getTopVisibleAnchor(mode, parentScrollY);
    commitFocusedAidStation(anchor.index);
    return anchor;
  }

  function switchViewMode(nextMode: PlanViewMode) {
    if (nextMode === selectedViewMode) return;
    const capturedFocus = captureFocusedStation(selectedViewMode);
    pendingSyncRef.current = { mode: nextMode, stationId: capturedFocus.stationId };
    viewAnchorsRef.current[nextMode] = {};
    setSelectedViewMode(nextMode);
    onViewModeChange?.(nextMode);
  }

  useEffect(() => {
    const pendingSync = pendingSyncRef.current;
    if (!pendingSync) return;
    if (alignParentScroll(pendingSync.mode, pendingSync.stationId)) {
      pendingSyncRef.current = null;
    }
  }, [aidStationsMetaKey, anchorsVersion, selectedViewMode]);

  useImperativeHandle(ref, () => ({
    selectViewMode: switchViewMode,
    updateParentScroll: (scrollY: number) => {
      const anchor = getTopVisibleAnchor(selectedViewMode, scrollY);
      if (anchor.stationId !== focusedAidStationIdRef.current) {
        commitFocusedAidStation(anchor.index);
      }
    },
  }));

  function renderCoveragePanel(target: PlanTarget, summary: SectionSummary | null, compact = false) {
    return (
      <AidStationCoveragePanel
        target={target}
        summary={summary}
        compact={compact}
        getGaugeMetrics={getGaugeMetrics}
      />
    );
  }

  function getCollapsedTint(metrics: GaugeMetric[]) {
    const statuses = metrics.map((metric) => getGaugeColor(metric.key, metric.statusRatio ?? metric.ratio));
    const allGreen = statuses.every((color) => color === '#2D5016');
    const hasRed = statuses.some((color) => color === '#EF4444');
    if (allGreen) return styles.stationCardCollapsedGreen;
    if (hasRed) return styles.stationCardCollapsedRed;
    return styles.stationCardCollapsedOrange;
  }

  function renderStationsView() {
    const elements: ReactElement[] = [];

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const stationKey = station.id ?? String(index);
      const isExpanded = expandedStations.has(stationKey);
      const isFocused = index === contextAnchorIndex;
      const targetKey: PlanTarget = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;
      const sectionTarget = formatSectionTarget(summary);
      const metrics = isArrivee ? [] : getGaugeMetrics(targetKey, sectionTarget);
      const animateSignal = isArrivee ? 0 : getGaugeAnimateSignal(targetKey);

      let card: ReactElement;

      if (isDepart) {
        const collapsedTintStyle = getCollapsedTint(metrics);
        card = (
          <Pressable
            key={stationKey}
            accessibilityLabel={`${station.name}, ${station.distanceKm} km, ${isExpanded ? 'réduire' : 'développer'}`}
            accessibilityRole="button"
            onPress={() => toggleStation(stationKey)}
            style={[
              styles.stationCard,
              planDetailStyles.stationCard,
              index % 2 === 0 ? planDetailStyles.cardWhite : planDetailStyles.cardCream,
              !isExpanded && collapsedTintStyle,
              isFocused && styles.stationCardFocused,
              isFocused && planDetailStyles.stationCardFocused,
            ]}
            onLayout={(event) => registerAnchor('stations', index, event)}
          >
            <View style={styles.stationHeaderRow}>
              {renderStationBadge(getStationBadge(index, station.id))}
              <Heading variant="h3" numberOfLines={1} style={planDetailStyles.stationName}>
                {station.name}
              </Heading>
              {renderPauseBadge(station.pauseMinutes)}
              <DataText tone="secondary" size="xs" weight="medium" style={planDetailStyles.stationKm}>
                {station.distanceKm} km
              </DataText>
              <Text style={styles.chevron}>{isExpanded ? '^' : 'v'}</Text>
            </View>
            {renderServiceChips(station, isDepart, isArrivee)}
            {isExpanded && (
              <>
                <View style={styles.cardDivider} />
                {renderCoveragePanel('start', summary)}
                <GaugesRow
                  metrics={metrics}
                  formatGaugeValue={formatGaugeValue}
                  getGaugeColor={getGaugeColor}
                  animateSignal={animateSignal}
                />
                <SuppliesList
                  supplies={getSupplies('start')}
                  productMap={productMap}
                  fuelLabels={fuelLabels}
                  onOpenPicker={() => openPicker('start')}
                  onIncreaseQty={(productId) => increaseQty('start', productId)}
                  onDecreaseQty={(productId) => decreaseQty('start', productId)}
                  onRemoveSupply={(productId) => removeSupply('start', productId)}
                />
              </>
            )}
            {!isExpanded && (
              <>
                {renderCoveragePanel('start', summary, true)}
                <View style={styles.collapsedGaugeRow}>
                  <GaugesRow
                    metrics={metrics}
                    formatGaugeValue={formatGaugeValue}
                    getGaugeColor={getGaugeColor}
                    compact
                  />
                </View>
              </>
            )}
          </Pressable>
        );
      } else if (isArrivee) {
        card = (
          <View
            key={stationKey}
            style={[
              styles.stationCard,
              planDetailStyles.stationCard,
              index % 2 === 0 ? planDetailStyles.cardWhite : planDetailStyles.cardCream,
              isFocused && styles.stationCardFocused,
              isFocused && planDetailStyles.stationCardFocused,
            ]}
            onLayout={(event) => registerAnchor('stations', index, event)}
          >
            <View style={styles.stationHeaderRow}>
              {renderStationBadge(getStationBadge(index, station.id))}
              <Heading variant="h3" numberOfLines={1} style={planDetailStyles.stationName}>
                {station.name}
              </Heading>
              {renderPauseBadge(station.pauseMinutes)}
              <DataText tone="secondary" size="xs" weight="medium" style={planDetailStyles.stationKm}>
                {station.distanceKm} km
              </DataText>
            </View>
            {renderServiceChips(station, isDepart, isArrivee)}
          </View>
        );
      } else {
        const collapsedTintStyle = getCollapsedTint(metrics);
        card = (
          <Pressable
            key={stationKey}
            onPress={() => toggleStation(stationKey)}
            style={[
              styles.stationCard,
              planDetailStyles.stationCard,
              index % 2 === 0 ? planDetailStyles.cardWhite : planDetailStyles.cardCream,
              !isExpanded && collapsedTintStyle,
              isFocused && styles.stationCardFocused,
              isFocused && planDetailStyles.stationCardFocused,
            ]}
            onLayout={(event) => registerAnchor('stations', index, event)}
          >
            <View style={styles.stationHeaderRow}>
              {renderStationBadge(getStationBadge(index, station.id))}
              <Heading variant="h3" style={planDetailStyles.stationName} numberOfLines={1}>
                {station.name}
              </Heading>
              {renderPauseBadge(station.pauseMinutes)}
              <TouchableOpacity
                accessibilityLabel={`Modifier ${station.name}`}
                accessibilityRole="button"
                style={styles.headerIconBtn}
                onPress={() =>
                  setEditingStation({
                    mode: 'edit',
                    index,
                    name: station.name,
                    km: String(station.distanceKm),
                    pauseMinutes: String(station.pauseMinutes ?? 0),
                    waterRefill: station.waterRefill !== false,
                    solidRefill: station.solidRefill !== false,
                    assistanceAllowed: station.assistanceAllowed !== false,
                  })
                }
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="create-outline" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel={`Supprimer ${station.name}`}
                accessibilityRole="button"
                style={styles.headerIconBtn}
                onPress={() => removeAidStation(index)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              <DataText tone="secondary" size="xs" weight="medium" style={planDetailStyles.stationKm}>
                {station.distanceKm} km
              </DataText>
              <Text style={styles.chevron}>{isExpanded ? '^' : 'v'}</Text>
            </View>
            {renderServiceChips(station, isDepart, isArrivee)}
            {isExpanded && (
              <>
                <View style={styles.cardDivider} />
                {renderCoveragePanel(index, summary)}
                <GaugesRow
                  metrics={metrics}
                  formatGaugeValue={formatGaugeValue}
                  getGaugeColor={getGaugeColor}
                  animateSignal={animateSignal}
                />
                {station.assistanceAllowed === false ? (
                  <View style={styles.suppliesDisabledBox}>
                    <Text style={styles.suppliesDisabledText}>
                      Pas d'assistance : tes produits favoris doivent etre pris au point assistance precedent.
                    </Text>
                  </View>
                ) : (
                  <SuppliesList
                    supplies={getSupplies(index)}
                    productMap={productMap}
                    fuelLabels={fuelLabels}
                    onOpenPicker={() => openPicker(index)}
                    onIncreaseQty={(productId) => increaseQty(index, productId)}
                    onDecreaseQty={(productId) => decreaseQty(index, productId)}
                    onRemoveSupply={(productId) => removeSupply(index, productId)}
                  />
                )}
              </>
            )}
            {!isExpanded && (
              <>
                {renderCoveragePanel(index, summary, true)}
                <View style={styles.collapsedGaugeRow}>
                  <GaugesRow
                    metrics={metrics}
                    formatGaugeValue={formatGaugeValue}
                    getGaugeColor={getGaugeColor}
                    compact
                  />
                </View>
              </>
            )}
          </Pressable>
        );
      }

      elements.push(card);

      if (index < values.aidStations.length - 1 && summary) {
        elements.push(
          <View key={`sep-${index}`} style={styles.separator}>
            <View style={styles.separatorLine} />
            <DataText tone="tertiary" size="xs" weight="medium" style={planDetailStyles.separatorText}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </DataText>
            <View style={styles.separatorLine} />
          </View>,
        );
      }
    });

    return elements;
  }

  function renderSectionsView() {
    const elements: ReactElement[] = [];

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const nextStation = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
      const targetKey: PlanTarget = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;

      elements.push(
        <View
          key={`station-line-${station.id ?? index}`}
          style={[styles.sectionStationRow, index === contextAnchorIndex && styles.sectionStationRowFocused]}
          onLayout={(event) => registerAnchor('sections', index, event)}
        >
          <View style={styles.sectionStationLine} />
          {renderStationBadge(getStationBadge(index, station.id), true)}
          <Heading variant="h3" style={planDetailStyles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Heading>
          <DataText tone="tertiary" size="xs" weight="medium" style={planDetailStyles.sectionStationKm}>
            {station.distanceKm} km
          </DataText>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;

      const sectionTimeline = getSectionIntakeTimeline(targetKey, Math.max(0, summary.durationMin), formatSectionTarget(summary));
      const sectionDPlus = summary.segmentStats.reduce((sum, segmentStat) => sum + Math.max(0, segmentStat.dPlus), 0);
      const sectionDMinus = summary.segmentStats.reduce((sum, segmentStat) => sum + Math.max(0, segmentStat.dMinus), 0);

      elements.push(
        <View
          key={`section-card-${station.id ?? index}`}
          style={[
            styles.sectionViewCard,
            planDetailStyles.sectionCard,
            index % 2 === 0 ? planDetailStyles.cardWhite : planDetailStyles.cardCream,
          ]}
        >
          <View style={styles.sectionViewHeader}>
            <Heading variant="h3" style={planDetailStyles.sectionViewTitle} numberOfLines={1}>
              {station.name} vers {nextStation.name}
            </Heading>
            <DataText tone="secondary" size="xs" weight="medium" style={planDetailStyles.sectionViewMeta}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </DataText>
          </View>
          {summary.profilePoints.length > 1 ? (
            <ProfileMiniChart points={summary.profilePoints} />
          ) : (
            <Text style={styles.profileEmptyText}>Profil indisponible pour cette section.</Text>
          )}
          <View style={styles.profileMetricsRow}>
            <View style={styles.profileMetricPill}>
              <DataText tone="secondary" size="xs" weight="semibold">
                {summary.distanceKm.toFixed(2)} km
              </DataText>
            </View>
            <View style={styles.profileMetricPill}>
              <DataText tone="secondary" size="xs" weight="semibold">
                D+ {Math.round(sectionDPlus)} m
              </DataText>
            </View>
            <View style={styles.profileMetricPill}>
              <DataText tone="secondary" size="xs" weight="semibold">
                D- {Math.round(sectionDMinus)} m
              </DataText>
            </View>
          </View>
          {sectionTimeline.length === 0 ? (
            <Text style={styles.sectionTimelineEmpty}>Aucune prise prévue</Text>
          ) : (
            sectionTimeline.map((item, timelineIndex) => (
              <View
                key={`timeline-${station.id ?? index}-${item.minute}-${item.label}-${timelineIndex}`}
                style={[
                  styles.sectionTimelineRow,
                  timelineIndex === sectionTimeline.length - 1 ? styles.sectionTimelineRowLast : null,
                ]}
              >
                <DataText tone="secondary" size="xs" weight="medium" style={planDetailStyles.sectionTimelineTime}>
                  {formatTimelineMinute(item.minute)}
                </DataText>
                <View style={styles.sectionTimelineInfo}>
                  <ThemedText tone="primary" size="sm" weight="semibold">
                    {item.label}
                  </ThemedText>
                  <ThemedText tone="secondary" size="xs" style={planDetailStyles.sectionTimelineDetail}>
                    {item.detail}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </View>,
      );
    });

    return elements;
  }

  function renderProfileView() {
    const elements: ReactElement[] = [];

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const nextStation = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
      const targetKey: PlanTarget = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;

      elements.push(
        <View
          key={`profile-station-line-${station.id ?? index}`}
          style={[styles.sectionStationRow, index === contextAnchorIndex && styles.sectionStationRowFocused]}
          onLayout={(event) => registerAnchor('profile', index, event)}
        >
          <View style={styles.sectionStationLine} />
          {renderStationBadge(getStationBadge(index, station.id), true)}
          <Heading variant="h3" style={planDetailStyles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Heading>
          <DataText tone="tertiary" size="xs" weight="medium" style={planDetailStyles.sectionStationKm}>
            {station.distanceKm} km
          </DataText>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;
      const segmentControls = getSectionSegmentControls(targetKey);

      elements.push(
        <View key={`profile-section-${station.id ?? index}`} style={styles.profileSectionBlock}>
          <View style={styles.profileSectionHeader}>
            <Heading variant="h3" style={planDetailStyles.profileTitle} numberOfLines={1}>
              {station.name} vers {nextStation.name}
            </Heading>
            <DataText tone="secondary" size="xs" weight="medium" style={planDetailStyles.profileMeta}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </DataText>
          </View>

          {summary.segmentStats.length === 0 ? (
            <Text style={styles.profileEmptyText}>Aucun découpage disponible pour cette section.</Text>
          ) : (
            <View style={styles.profileSegmentsList}>
              {summary.segmentStats.map((segmentStat, segmentIndex) => {
                const segment = summary.segments[segmentIndex];
                if (!segment) return null;

                const baseAdjustedPaceMinutes =
                  adjustedPaceMinutesPerKm(basePaceMinutesPerKm, {
                    distKm: segmentStat.distKm,
                    dPlus: segmentStat.dPlus,
                    dMinus: segmentStat.dMinus,
                    elapsedBeforeSeconds: segmentStat.elapsedStartSeconds,
                    fatigueLevel: values.fatigueLevel,
                  }) ?? basePaceMinutesPerKm;
                const currentPaceMinutes =
                  Math.max(
                    0.01,
                    baseAdjustedPaceMinutes +
                      (typeof segment.paceAdjustmentMinutesPerKm === 'number' && Number.isFinite(segment.paceAdjustmentMinutesPerKm)
                        ? segment.paceAdjustmentMinutesPerKm
                        : 0),
                  );
                const paceDraftKey = `${summary.sectionIndex}-${segmentIndex}`;
                const adjustmentValue = paceDrafts[paceDraftKey] ?? formatPace(currentPaceMinutes);
                const segmentProfile = getElevationSlice(
                  summary.profilePoints,
                  segmentStat.startDistanceKm,
                  segmentStat.endDistanceKm,
                );
                const controls = segmentControls[segmentIndex] ?? { canSplit: false, canRemove: false };
                const canSplit = controls.canSplit;
                const canRemove = controls.canRemove;

                return (
                  <AidStationProfileSegmentCard
                    key={`sub-segment-${summary.sectionIndex}-${segmentIndex}`}
                    title={getSegmentCardTitle(segment.label, segmentIndex)}
                    durationLabel={formatSectionDuration(segmentStat.etaSeconds / 60)}
                    paceValue={adjustmentValue}
                    profilePoints={segmentProfile}
                    stats={segmentStat}
                    alternateBackground={segmentIndex % 2 !== 0}
                    canSplit={canSplit}
                    canRemove={canRemove}
                    onDecreasePace={() =>
                      applyAbsolutePace(
                        targetKey,
                        segmentIndex,
                        currentPaceMinutes - paceStepMinutes,
                        baseAdjustedPaceMinutes,
                        paceDraftKey,
                      )
                    }
                    onIncreasePace={() =>
                      applyAbsolutePace(
                        targetKey,
                        segmentIndex,
                        currentPaceMinutes + paceStepMinutes,
                        baseAdjustedPaceMinutes,
                        paceDraftKey,
                      )
                    }
                    onPaceChange={(text) => {
                      setPaceDraft(paceDraftKey, text);
                      const parsed = parsePaceInput(text);
                      if (parsed === undefined) {
                        onUpdateSectionSegmentPaceAdjustment(targetKey, segmentIndex, undefined);
                        return;
                      }
                      if (parsed !== null) {
                        applyAbsolutePace(targetKey, segmentIndex, parsed, baseAdjustedPaceMinutes);
                      }
                    }}
                    onPaceBlur={() => {
                      const draft = paceDrafts[paceDraftKey];
                      const parsed = parsePaceInput(draft ?? adjustmentValue);
                      if (parsed === undefined) {
                        onUpdateSectionSegmentPaceAdjustment(targetKey, segmentIndex, undefined);
                      } else if (parsed !== null) {
                        applyAbsolutePace(targetKey, segmentIndex, parsed, baseAdjustedPaceMinutes);
                      }
                      clearPaceDraft(paceDraftKey);
                    }}
                    onSplit={() => onSplitSectionSegment(targetKey, segmentIndex)}
                    onRemove={() => onRemoveSectionSegment(targetKey, segmentIndex)}
                  />
                );
              })}
            </View>
          )}
        </View>,
      );
    });

    return elements;
  }

  const stationsElements = useMemo(() => renderStationsView(), [
    values.aidStations,
    departId,
    arriveeId,
    contextAnchorIndex,
    expandedStations,
    toggleStation,
    setEditingStation,
    removeAidStation,
    intermediateCount,
    getSupplies,
    openPicker,
    increaseQty,
    decreaseQty,
    removeSupply,
    productMap,
    fuelLabels,
    getGaugeMetrics,
    getGaugeColor,
    formatGaugeValue,
    getSectionSummary,
    getGaugeAnimateSignal,
    registerAnchor,
  ]);

  const sectionsElements = useMemo(() => renderSectionsView(), [
    values.aidStations,
    departId,
    arriveeId,
    contextAnchorIndex,
    getSectionSummary,
    getSectionIntakeTimeline,
    registerAnchor,
  ]);

  const profileElements = useMemo(() => renderProfileView(), [
    aidStationsMetaKey,
    departId,
    arriveeId,
    contextAnchorIndex,
    basePaceMinutesPerKm,
    paceDrafts,
    getSectionSummary,
    getSectionSegmentControls,
    onSplitSectionSegment,
    onRemoveSectionSegment,
    onUpdateSectionSegmentPaceAdjustment,
    registerAnchor,
  ]);

  function renderViewForMode(mode: PlanViewMode) {
    if (mode === 'stations') {
      return (
        <>
          {intermediateCount === 0 && (
            <Text style={styles.emptyText}>Pas de ravito intermédiaire. Utilise "+ Ajouter" pour en créer.</Text>
          )}
          {stationsElements}
        </>
      );
    }

    if (mode === 'sections') {
      return sectionsElements;
    }

    return profileElements;
  }
  const contextInfo = useMemo(() => {
    const station = values.aidStations[contextAnchorIndex];
    if (!station) {
      return { badge: 'R', label: 'Segment', meta: '' };
    }

    const badge = getStationBadge(contextAnchorIndex, station.id);
    const nextStation = values.aidStations[contextAnchorIndex + 1];
    const startKm = Number.isFinite(station.distanceKm) ? station.distanceKm : 0;
    const endKm =
      nextStation && Number.isFinite(nextStation.distanceKm) && nextStation.distanceKm > startKm
        ? nextStation.distanceKm
        : null;
    const meta = endKm !== null ? `${startKm.toFixed(1)}–${endKm.toFixed(1)} km` : `${startKm.toFixed(1)} km`;
    const label = nextStation && station.id !== arriveeId ? `${station.name} → ${nextStation.name}` : station.name;

    return { badge, label, meta };
  }, [arriveeId, contextAnchorIndex, values.aidStations]);

  return (
    <>
      <View
        accessibilityElementsHidden={toolbarHidden}
        importantForAccessibility={toolbarHidden ? 'no-hide-descendants' : 'auto'}
        pointerEvents={toolbarHidden ? 'none' : 'auto'}
        onLayout={(event) => onToolbarLayout?.(event.nativeEvent.layout.y, event.nativeEvent.layout.height)}
        style={toolbarHidden && planDetailStyles.hiddenToolbar}
      >
        <AidStationsToolbar
          mode={selectedViewMode}
          onSelectMode={switchViewMode}
          addAidStation={addAidStation}
          fillSuppliesAuto={fillSuppliesAuto}
          isAutoFilling={isAutoFilling}
          autoFillLoadingMessage={autoFillLoadingMessage}
          isPremium={isPremium}
          tutorial={tutorial}
        />
      </View>

      <View style={styles.scrollContextBar}>
        {renderStationBadge(contextInfo.badge, true)}
        <Heading variant="h3" style={planDetailStyles.scrollContextLabel} numberOfLines={1}>
          {contextInfo.label}
        </Heading>
        <DataText tone="tertiary" size="xs" weight="medium">
          {contextInfo.meta}
        </DataText>
      </View>

      <TutorialTarget
        onMeasure={tutorial?.onTargetMeasure ?? (() => undefined)}
        onRegisterRef={tutorial?.onTargetRegisterRef}
        targetKey="aidStations"
      >
        <View
          onLayout={(event) => {
            activeViewTopRef.current = event.nativeEvent.layout.y;
          }}
          style={planDetailStyles.activeView}
        >
          {renderViewForMode(selectedViewMode)}
        </View>
      </TutorialTarget>
    </>
  );
});

const planDetailStyles = StyleSheet.create({
  toolbar: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  toolbarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: 0,
  },
  hiddenToolbar: {
    opacity: 0,
  },
  toolbarTabs: {
    marginBottom: 0,
  },
  toolbarTabsTargetCompact: {
    flex: 1,
    minWidth: 0,
  },
  toolbarTabsCompact: {
    flex: 1,
    minWidth: 0,
    padding: 3,
  },
  toolbarTabCompact: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 7,
  },
  toolbarTabTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  toolbarDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.subtle,
  },
  toolbarActions: {
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
  },
  toolbarActionsCompact: {
    gap: spacing[1],
  },
  toolbarIconAction: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 13,
    shadowOpacity: 0,
    elevation: 0,
  },
  toolbarIconActionSecondary: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 13,
    borderColor: colors.border.brand,
    backgroundColor: colors.surface.cream,
  },
  activeView: {
    paddingBottom: spacing[6],
  },
  stationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.cream,
  },
  stationBadgeText: {
    fontSize: 12,
    lineHeight: 15,
  },
  stationBadgeMiniText: {
    fontSize: 10,
    lineHeight: 13,
  },
  stationCard: {
    borderRadius: radius.card,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.white,
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: shadows.sm,
  } as ViewStyle,
  stationCardFocused: {
    borderColor: colors.border.brand,
    boxShadow: shadows.md,
  } as ViewStyle,
  cardWhite: {
    backgroundColor: colors.surface.white,
  },
  cardCream: {
    backgroundColor: colors.surface.cream,
  },
  stationName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 18,
    lineHeight: 22,
  },
  stationKm: {
    marginLeft: spacing[2],
  },
  separatorText: {
    marginHorizontal: spacing[3],
  },
  sectionStationLabel: {
    flexShrink: 1,
    maxWidth: '50%',
    color: colors.text.primary,
    fontSize: 16,
    lineHeight: 20,
  },
  sectionStationKm: {
    flexShrink: 0,
  },
  sectionCard: {
    borderRadius: radius.card,
    borderColor: colors.border.subtle,
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: shadows.sm,
  } as ViewStyle,
  sectionViewTitle: {
    color: colors.text.primary,
    fontSize: 18,
    lineHeight: 22,
  },
  sectionViewMeta: {
    marginTop: spacing[1],
  },
  sectionTimelineTime: {
    width: 58,
  },
  sectionTimelineDetail: {
    marginTop: spacing[0.5],
  },
  profileTitle: {
    color: colors.text.primary,
    fontSize: 18,
    lineHeight: 22,
  },
  profileMeta: {
    marginTop: spacing[1],
  },
  scrollContextLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 19,
  },
});

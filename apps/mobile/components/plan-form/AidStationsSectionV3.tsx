import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { GaugeMetric } from './GaugeArc';
import { GaugesRow } from './GaugesRow';
import { ProfileMiniChart } from './ProfileMiniChart';
import { SuppliesList } from './SuppliesList';
import type { EditingStation } from './EditStationModal';
import type { AidStationFormItem, PlanProduct, PlanTarget, SectionSummary, SectionTarget, SectionSegment, IntakeTimelineItem } from './contracts';
import { getGaugeTolerance } from './metrics';
import { adjustedPaceMinutesPerKm, getElevationSlice } from './profile-utils';
import { styles } from './styles';

type Props = {
  values: {
    sectionSegments?: Record<string, SectionSegment[]>;
    aidStations: AidStationFormItem[];
  };
  basePaceMinutesPerKm: number;
  departId: string;
  arriveeId: string;
  expandedStations: Set<string>;
  toggleStation: (stationKey: string) => void;
  setEditingStation: (value: EditingStation) => void;
  removeAidStation: (index: number) => void;
  addAidStation: () => void;
  fillSuppliesAuto: () => void;
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
  ) => Array<{
    canSplit: boolean;
    canRemove: boolean;
  }>;
  onSplitSectionSegment: (target: PlanTarget, segmentIndex: number) => void;
  onRemoveSectionSegment: (target: PlanTarget, segmentIndex: number) => void;
  onUpdateSectionSegmentPaceAdjustment: (
    target: PlanTarget,
    segmentIndex: number,
    paceAdjustmentMinutesPerKm: number | undefined,
  ) => void;
  onNestedScrollInteractionStart?: () => void;
};

const VIEW_MODES: Array<'stations' | 'sections' | 'profile'> = ['stations', 'sections', 'profile'];
const PAGER_MODES: Array<'profile' | 'stations' | 'sections' | 'profile' | 'stations'> = [
  'profile',
  'stations',
  'sections',
  'profile',
  'stations',
];

export function AidStationsSectionV3({
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
  onNestedScrollInteractionStart,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const pageWidth = Math.max(280, windowWidth - 40);
  const defaultViewportHeight = Math.max(360, Math.min(Math.round(windowHeight * 0.68), 760));
  const pagerRef = useRef<ScrollView>(null);
  const lastPagerWidthRef = useRef(pageWidth);
  const currentPagerPageIndexRef = useRef(1);
  const pageScrollRefs = useRef<Record<number, ScrollView | null>>({});
  const pageScrollYRef = useRef<Record<'stations' | 'sections' | 'profile', number>>({
    stations: 0,
    sections: 0,
    profile: 0,
  });
  const pageContentHeightRef = useRef<Record<'stations' | 'sections' | 'profile', number>>({
    stations: 0,
    sections: 0,
    profile: 0,
  });
  const pageUserScrollingRef = useRef<Record<'stations' | 'sections' | 'profile', boolean>>({
    stations: false,
    sections: false,
    profile: false,
  });
  const userDraggingRef = useRef(false);
  const dragStartModeRef = useRef<'stations' | 'sections' | 'profile'>('stations');
  const previewTargetModeRef = useRef<null | 'stations' | 'sections' | 'profile'>(null);
  const pendingSyncRef = useRef<null | { mode: 'stations' | 'sections' | 'profile'; stationId: string | null; viewportOffset: number }>(null);
  const focusedAidStationIdRef = useRef<string | null>(values.aidStations[0]?.id ?? null);
  const focusedViewportOffsetRef = useRef(0);
  const viewAnchorsRef = useRef<
    Record<
      'stations' | 'sections' | 'profile',
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
  const [selectedViewMode, setSelectedViewMode] = useState<'stations' | 'sections' | 'profile'>('stations');
  const [displayedViewMode, setDisplayedViewMode] = useState<'stations' | 'sections' | 'profile'>('stations');
  const [focusedAidStationId, setFocusedAidStationId] = useState<string | null>(values.aidStations[0]?.id ?? null);
  const [pagerHoldPageIndex, setPagerHoldPageIndex] = useState<number | null>(null);
  const [paceDrafts, setPaceDrafts] = useState<Record<string, string>>({});
  const [viewportHeight, setViewportHeight] = useState(defaultViewportHeight);
  const [anchorsVersion, setAnchorsVersion] = useState(0);
  const aidStationsMetaKey = useMemo(
    () =>
      values.aidStations
        .map((station) => `${station.id ?? ''}|${station.distanceKm}|${station.pauseMinutes ?? 0}|${station.name}`)
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
      <View style={compact ? styles.stationBadgeMini : styles.stationBadge}>
        <Text style={compact ? styles.stationBadgeMiniText : styles.stationBadgeText}>{label}</Text>
      </View>
    );
  }

  function formatTimelineMinute(minute: number) {
    if (minute <= 0) return 'Depart';
    return `${minute} min`;
  }

  function formatSectionDuration(durationMin: number) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
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

  function formatPace(minutesPerKm: number) {
    const safeValue = Math.max(0.01, minutesPerKm);
    const minutes = Math.floor(safeValue);
    const seconds = Math.round((safeValue - minutes) * 60);
    if (seconds === 60) {
      return `${minutes + 1}:00`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function parsePaceInput(text: string) {
    const trimmed = text.trim().replace(',', '.');
    if (trimmed === '') return undefined;

    if (trimmed.includes(':')) {
      const [minutesPart, secondsPart = '0'] = trimmed.split(':');
      const minutes = Number(minutesPart);
      const seconds = Number(secondsPart);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0) {
        return null;
      }
      return minutes + seconds / 60;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
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

  function getPagerPageIndicesForMode(mode: 'stations' | 'sections' | 'profile') {
    return PAGER_MODES.map((pageMode, pageIndex) => (pageMode === mode ? pageIndex : -1)).filter((pageIndex) => pageIndex >= 0);
  }

  function getStationIndexById(stationId: string | null | undefined, fallbackIndex = 0) {
    if (!stationId) return fallbackIndex;
    const resolvedIndex = values.aidStations.findIndex((_, index) => getStationIdentity(index) === stationId);
    return resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;
  }

  function getFocusLineOffset() {
    return Math.round(Math.min(240, Math.max(92, windowHeight * 0.25)));
  }

  function commitFocusedAidStation(index: number, viewportOffset = focusedViewportOffsetRef.current || getFocusLineOffset()) {
    const nextStationId = getStationIdAtIndex(index);
    focusedAidStationIdRef.current = nextStationId;
    focusedViewportOffsetRef.current = viewportOffset;
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
    focusedViewportOffsetRef.current = getFocusLineOffset();
    setFocusedAidStationId((prev) => (prev === fallbackStationId ? prev : fallbackStationId));
  }, [values.aidStations]);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.max(1, Math.ceil(event.nativeEvent.layout.height));
    setViewportHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const registerAnchor = useCallback((mode: 'stations' | 'sections' | 'profile', index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const nextTop = Math.round(y);
    const nextBottom = Math.round(y + height);
    const prev = viewAnchorsRef.current[mode][index];
    if (prev?.top === nextTop && prev?.bottom === nextBottom) return;
    viewAnchorsRef.current[mode][index] = { top: nextTop, bottom: nextBottom };
    setAnchorsVersion((prevVersion) => prevVersion + 1);
  }, []);

  function getPageScrollY(mode: 'stations' | 'sections' | 'profile') {
    return pageScrollYRef.current[mode];
  }

  function getTopVisibleAnchor(mode: 'stations' | 'sections' | 'profile', pageScrollY = getPageScrollY(mode)) {
    const focusOffset = getFocusLineOffset();
    const focusLineY = pageScrollY + focusOffset;

    const anchors = Object.entries(viewAnchorsRef.current[mode])
      .map(([index, anchor]) => ({ index: Number(index), top: anchor.top, bottom: anchor.bottom }))
      .sort((a, b) => a.top - b.top);

    if (anchors.length === 0) {
      return { index: 0, stationId: getStationIdAtIndex(0), viewportOffset: getFocusLineOffset() };
    }

    const containing = anchors.find((anchor) => anchor.top <= focusLineY && focusLineY <= anchor.bottom);
    const previous = [...anchors].reverse().find((anchor) => anchor.top <= focusLineY);
    const chosen = containing ?? previous ?? anchors[0];
    return {
      index: chosen.index,
      stationId: getStationIdAtIndex(chosen.index),
      viewportOffset: chosen.top - pageScrollY,
    };
  }

  function getBottomSpacerHeight() {
    return Math.max(72, Math.round(viewportHeight - getFocusLineOffset() + 32));
  }

  function getAnchorTopForStation(mode: 'stations' | 'sections' | 'profile', stationId: string | null | undefined) {
    const anchorIndex = getStationIndexById(stationId, 0);
    const anchor = viewAnchorsRef.current[mode][anchorIndex];
    if (!anchor) return null;
    return { anchorIndex, top: anchor.top };
  }

  function alignParentScroll(
    nextMode: 'stations' | 'sections' | 'profile',
    stationId = focusedAidStationIdRef.current,
    viewportOffset = focusedViewportOffsetRef.current || getFocusLineOffset(),
  ) {
    const targetAnchor = getAnchorTopForStation(nextMode, stationId);
    if (!targetAnchor) return false;
    const rawScrollY = Math.max(0, Math.round(targetAnchor.top - viewportOffset));
    const maxScrollY = Math.max(0, pageContentHeightRef.current[nextMode] - viewportHeight);
    const nextPageScrollY = Math.min(maxScrollY, rawScrollY);
    pageScrollYRef.current[nextMode] = nextPageScrollY;
    getPagerPageIndicesForMode(nextMode).forEach((pageIndex) => {
      pageScrollRefs.current[pageIndex]?.scrollTo({ y: nextPageScrollY, animated: false });
    });
    return true;
  }

  function captureFocusedStation(mode: 'stations' | 'sections' | 'profile', pageScrollY = getPageScrollY(mode)) {
    const anchor = getTopVisibleAnchor(mode, pageScrollY);
    commitFocusedAidStation(anchor.index, anchor.viewportOffset);
    return anchor;
  }

  function queueModeSync(
    mode: 'stations' | 'sections' | 'profile',
    stationId = focusedAidStationIdRef.current,
    viewportOffset = focusedViewportOffsetRef.current || getFocusLineOffset(),
    deferUntilSettled = false,
  ) {
    pendingSyncRef.current = { mode, stationId, viewportOffset };
    if (deferUntilSettled) return;
    if (alignParentScroll(mode, stationId, viewportOffset)) {
      pendingSyncRef.current = null;
    }
  }

  function getNearestPagerPageIndex(nextMode: 'stations' | 'sections' | 'profile') {
    const currentPageIndex = currentPagerPageIndexRef.current;
    const candidates = getPagerPageIndicesForMode(nextMode);
    if (candidates.length === 0) {
      return VIEW_MODES.indexOf(nextMode) + 1;
    }

    return candidates.reduce((best, candidate) => {
      const bestDistance = Math.abs(best - currentPageIndex);
      const candidateDistance = Math.abs(candidate - currentPageIndex);
      if (candidateDistance !== bestDistance) {
        return candidateDistance < bestDistance ? candidate : best;
      }
      return candidate < best ? candidate : best;
    }, candidates[0]);
  }

  function switchViewMode(nextMode: 'stations' | 'sections' | 'profile') {
    if (nextMode === displayedViewMode) return;

    const nextPageIndex = getNearestPagerPageIndex(nextMode);
    const capturedFocus = captureFocusedStation(displayedViewMode);
    dragStartModeRef.current = displayedViewMode;
    previewTargetModeRef.current = nextMode;
    setSelectedViewMode(nextMode);
    queueModeSync(nextMode, capturedFocus.stationId, capturedFocus.viewportOffset, true);
    pagerRef.current?.scrollTo({ x: nextPageIndex * pageWidth, animated: true });
  }

  function resolvePagerMode(pageIndex: number) {
    const boundedPageIndex = Math.max(0, Math.min(PAGER_MODES.length - 1, pageIndex));
    if (boundedPageIndex === 0) {
      return { mode: 'profile' as const, resetPageIndex: 3 };
    }
    if (boundedPageIndex === PAGER_MODES.length - 1) {
      return { mode: 'stations' as const, resetPageIndex: 1 };
    }
    return { mode: VIEW_MODES[boundedPageIndex - 1], resetPageIndex: null };
  }

  useEffect(() => {
    const pendingSync = pendingSyncRef.current;
    if (!pendingSync) return;
    if (userDraggingRef.current) return;
    if (alignParentScroll(pendingSync.mode, pendingSync.stationId, pendingSync.viewportOffset)) {
      pendingSyncRef.current = null;
    }
  }, [aidStationsMetaKey, anchorsVersion, displayedViewMode, pageWidth, selectedViewMode, viewportHeight, windowHeight]);

  useEffect(() => {
    const currentPageIndex = VIEW_MODES.indexOf(displayedViewMode) + 1;
    if (currentPageIndex <= 0) return;
    if (lastPagerWidthRef.current === pageWidth) return;
    lastPagerWidthRef.current = pageWidth;
    currentPagerPageIndexRef.current = currentPageIndex;
    pagerRef.current?.scrollTo({ x: currentPageIndex * pageWidth, animated: false });
  }, [pageWidth, displayedViewMode]);

  function handlePagerBeginDrag() {
    onNestedScrollInteractionStart?.();
    userDraggingRef.current = true;
    dragStartModeRef.current = displayedViewMode;
    previewTargetModeRef.current = null;
    setSelectedViewMode(displayedViewMode);
    captureFocusedStation(displayedViewMode);
  }

  function handlePagerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!userDraggingRef.current || previewTargetModeRef.current !== null) return;

    const dragStartMode = dragStartModeRef.current;
    const startPageIndex = VIEW_MODES.indexOf(dragStartMode) + 1;
    if (startPageIndex <= 0) return;

    const currentX = event.nativeEvent.contentOffset.x;
    const deltaX = currentX - startPageIndex * pageWidth;
    const activationThreshold = Math.max(12, Math.round(pageWidth * 0.04));
    if (Math.abs(deltaX) < activationThreshold) return;

    const previewPageIndex = deltaX > 0 ? startPageIndex + 1 : startPageIndex - 1;
    const { mode: previewMode } = resolvePagerMode(previewPageIndex);
    if (previewMode === dragStartMode) return;

    if (previewTargetModeRef.current === previewMode) return;
    previewTargetModeRef.current = previewMode;
    setSelectedViewMode(previewMode);
    queueModeSync(previewMode, focusedAidStationIdRef.current, focusedViewportOffsetRef.current || getFocusLineOffset(), false);
  }

  function handlePagerMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const rawPageIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1));
    const boundedPageIndex = Math.max(0, Math.min(PAGER_MODES.length - 1, rawPageIndex));
    const dragStartMode = dragStartModeRef.current;
    const previewTargetMode = previewTargetModeRef.current;
    userDraggingRef.current = false;
    previewTargetModeRef.current = null;

    const { mode: nextMode, resetPageIndex } = resolvePagerMode(boundedPageIndex);

    if (resetPageIndex !== null) {
      setPagerHoldPageIndex(boundedPageIndex);
    }

    if (nextMode !== displayedViewMode) {
      queueModeSync(nextMode, focusedAidStationIdRef.current, focusedViewportOffsetRef.current || getFocusLineOffset(), true);
      setSelectedViewMode(nextMode);
      setDisplayedViewMode(nextMode);
      currentPagerPageIndexRef.current = resetPageIndex ?? boundedPageIndex;
    } else if (previewTargetMode !== null && previewTargetMode !== dragStartMode) {
      pendingSyncRef.current = null;
      setSelectedViewMode(displayedViewMode);
      currentPagerPageIndexRef.current = VIEW_MODES.indexOf(displayedViewMode) + 1;
    }

    if (resetPageIndex !== null) {
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({ x: resetPageIndex * pageWidth, animated: false });
        currentPagerPageIndexRef.current = resetPageIndex;
        requestAnimationFrame(() => {
          setPagerHoldPageIndex((prev) => (prev === boundedPageIndex ? null : prev));
        });
      });
    } else if (nextMode === displayedViewMode) {
      currentPagerPageIndexRef.current = boundedPageIndex;
    }
  }

  function handlePageScroll(mode: 'stations' | 'sections' | 'profile', event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextY = event.nativeEvent.contentOffset.y;
    pageScrollYRef.current[mode] = nextY;
    if (mode !== displayedViewMode || !pageUserScrollingRef.current[mode]) return;
    const anchor = getTopVisibleAnchor(mode, nextY);
    commitFocusedAidStation(anchor.index, anchor.viewportOffset);
  }

  function handlePageScrollBeginDrag(mode: 'stations' | 'sections' | 'profile') {
    onNestedScrollInteractionStart?.();
    pageUserScrollingRef.current[mode] = true;
  }

  function handlePageScrollEnd(mode: 'stations' | 'sections' | 'profile') {
    pageUserScrollingRef.current[mode] = false;
  }

  function handlePageContentSizeChange(mode: 'stations' | 'sections' | 'profile', _: number, height: number) {
    const nextHeight = Math.ceil(height);
    if (pageContentHeightRef.current[mode] === nextHeight) return;
    pageContentHeightRef.current[mode] = nextHeight;
    setAnchorsVersion((prevVersion) => prevVersion + 1);
  }

  function formatSectionTarget(summary: SectionSummary | null): SectionTarget {
    return {
      targetCarbsG: summary?.targetCarbsG ?? 0,
      targetSodiumMg: summary?.targetSodiumMg ?? 0,
      targetWaterMl: summary?.targetWaterMl ?? 0,
    };
  }

  function formatCoveragePair(metric: {
    key: GaugeMetric['key'];
    current: number;
    target: number;
    unit: string;
    label: string;
  }) {
    if (metric.key === 'water') {
      const currentMl = Math.round(metric.current / 100) * 100;
      const targetMl = Math.round(metric.target / 100) * 100;
      return `${currentMl} / ${targetMl} ml eau`;
    }

    return `${Math.round(metric.current)} / ${Math.round(metric.target)} ${metric.unit} ${metric.label.toLowerCase()}`;
  }

  function summarizeCoverage(target: 'start' | number, summary: SectionSummary | null) {
    const metrics = getGaugeMetrics(target, formatSectionTarget(summary));
    const chips = metrics.map((metric) => formatCoveragePair(metric));
    const deficits = metrics
      .map((metric) => ({
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        ratio: metric.statusRatio ?? metric.ratio,
        missing: Math.max(0, metric.target - metric.current),
        tolerance: getGaugeTolerance(metric.key, metric.target),
      }))
      .filter((metric) => metric.missing > metric.tolerance);

    const hasCritical = deficits.some((metric) => metric.ratio < 0.82);
    const hasWarning = deficits.some((metric) => metric.ratio < 1);

    const severity = hasCritical ? 'danger' : hasWarning ? 'warning' : 'ok';
    const title =
      severity === 'ok'
        ? 'Couvert pour le prochain segment'
        : severity === 'warning'
          ? 'Un peu juste pour tenir'
          : 'Risque de manque sur le segment';

    const shortLabel =
      severity === 'ok'
        ? 'OK'
        : severity === 'warning'
          ? 'A ajuster'
          : 'Insuffisant';

    if (deficits.length === 0) {
      return {
        severity,
        title,
        shortLabel,
        detail: 'Ce que tu emportes ici suffit pour couvrir le prochain segment avec une marge correcte.',
        action: 'Tu peux repartir comme ca.',
        chips,
      };
    }

    const topDeficit = [...deficits].sort((a, b) => b.missing - a.missing)[0];
    const deficitChips = deficits.slice(0, 2).map((metric) => {
      if (metric.key === 'water') return `${Math.round(metric.missing / 100) * 100} ml manquants`;
      return `${Math.round(metric.missing)} ${metric.unit} manquants`;
    });

    let action = 'Ajoute un peu de ravitaillement avant de repartir.';
    if (topDeficit.key === 'carbs') {
      action =
        topDeficit.missing <= 30
          ? 'Ajoute 1 prise sucree de plus pour eviter le deficit.'
          : 'Ajoute au moins 2 prises glucides avant de repartir.';
    } else if (topDeficit.key === 'water') {
      action =
        topDeficit.missing <= 300
          ? 'Ajoute un petit complement d eau avant de repartir.'
          : 'Remplis au moins 500 ml de plus avant de repartir.';
    } else if (topDeficit.key === 'sodium') {
      action =
        topDeficit.missing <= 250
          ? 'Ajoute un peu de sodium pour securiser ce segment.'
          : 'Ajoute une source de sodium en plus avant de repartir.';
    }

    const detail =
      topDeficit.key === 'water'
        ? `Il manque environ ${Math.round(topDeficit.missing / 100) * 100} ml pour tenir jusqu au prochain point.`
        : `Il manque environ ${Math.round(topDeficit.missing)} ${topDeficit.unit} de ${topDeficit.label.toLowerCase()} pour tenir correctement.`;

    return {
      severity,
      title,
      shortLabel,
      detail,
      action,
      chips: [...chips, ...deficitChips],
    };
  }

  function renderCoveragePanel(target: 'start' | number, summary: SectionSummary | null, compact = false) {
    const coverage = summarizeCoverage(target, summary);
    const toneStyle =
      coverage.severity === 'ok'
        ? styles.coveragePanelOk
        : coverage.severity === 'warning'
          ? styles.coveragePanelWarning
          : styles.coveragePanelDanger;
    const pillStyle =
      coverage.severity === 'ok'
        ? styles.coveragePillOk
        : coverage.severity === 'warning'
          ? styles.coveragePillWarning
          : styles.coveragePillDanger;
    const pillTextStyle =
      coverage.severity === 'ok'
        ? styles.coveragePillTextOk
        : coverage.severity === 'warning'
          ? styles.coveragePillTextWarning
          : styles.coveragePillTextDanger;

    if (compact) {
      return (
        <View style={[styles.coverageCompactRow, toneStyle]}>
          <View style={[styles.coveragePill, pillStyle]}>
            <Text style={[styles.coveragePillText, pillTextStyle]}>{coverage.shortLabel}</Text>
          </View>
          <Text style={styles.coverageCompactTitle} numberOfLines={1}>
            {coverage.title}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.coveragePanel, toneStyle]}>
        <View style={styles.coveragePanelHeader}>
          <View style={[styles.coveragePill, pillStyle]}>
            <Text style={[styles.coveragePillText, pillTextStyle]}>{coverage.shortLabel}</Text>
          </View>
          <Text style={styles.coveragePanelTitle}>{coverage.title}</Text>
        </View>
        <Text style={styles.coveragePanelDetail}>{coverage.detail}</Text>
        <Text style={styles.coveragePanelAction}>{coverage.action}</Text>
        <View style={styles.coverageChipRow}>
          {coverage.chips.map((chip) => (
            <View key={chip} style={styles.coverageChip}>
              <Text style={styles.coverageChipText}>{chip}</Text>
            </View>
          ))}
        </View>
      </View>
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

  function getSegmentLabel(label: string | undefined, index: number) {
    if (label === 'climb') return 'Montee';
    if (label === 'descent') return 'Descente';
    if (label === 'flat') return 'Plat';
    return `Segment ${index + 1}`;
  }

  function getSegmentCardTitle(label: string | undefined, index: number) {
    const baseLabel = getSegmentLabel(label, index);
    return baseLabel.startsWith('Segment') ? baseLabel : `${baseLabel} ${index + 1}`;
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
          <View
            key={stationKey}
            style={[styles.stationCard, !isExpanded && collapsedTintStyle, isFocused && styles.stationCardFocused]}
            onLayout={(event) => registerAnchor('stations', index, event)}
          >
            <TouchableOpacity
              onPress={() => toggleStation(stationKey)}
              activeOpacity={0.7}
              style={styles.stationHeaderRow}
            >
              {renderStationBadge(getStationBadge(index, station.id))}
              <Text style={styles.stationName}>{station.name}</Text>
              {renderPauseBadge(station.pauseMinutes)}
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
              <Text style={styles.chevron}>{isExpanded ? '^' : 'v'}</Text>
            </TouchableOpacity>
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
          </View>
        );
      } else if (isArrivee) {
        card = (
          <View
            key={stationKey}
            style={[styles.stationCard, isFocused && styles.stationCardFocused]}
            onLayout={(event) => registerAnchor('stations', index, event)}
          >
            <View style={styles.stationHeaderRow}>
              {renderStationBadge(getStationBadge(index, station.id))}
              <Text style={styles.stationName}>{station.name}</Text>
              {renderPauseBadge(station.pauseMinutes)}
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
            </View>
          </View>
        );
      } else {
        const collapsedTintStyle = getCollapsedTint(metrics);
        card = (
          <View
            key={stationKey}
            style={[styles.stationCard, !isExpanded && collapsedTintStyle, isFocused && styles.stationCardFocused]}
            onLayout={(event) => registerAnchor('stations', index, event)}
          >
            <TouchableOpacity
              onPress={() => toggleStation(stationKey)}
              activeOpacity={0.7}
              style={styles.stationHeaderRow}
            >
              {renderStationBadge(getStationBadge(index, station.id))}
              <Text style={styles.stationName} numberOfLines={1}>
                {station.name}
              </Text>
              {renderPauseBadge(station.pauseMinutes)}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() =>
                  setEditingStation({
                    index,
                    name: station.name,
                    km: String(station.distanceKm),
                    pauseMinutes: String(station.pauseMinutes ?? 0),
                  })
                }
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="create-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => removeAidStation(index)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="trash-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
              <Text style={styles.chevron}>{isExpanded ? '^' : 'v'}</Text>
            </TouchableOpacity>
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
                <SuppliesList
                  supplies={getSupplies(index)}
                  productMap={productMap}
                  fuelLabels={fuelLabels}
                  onOpenPicker={() => openPicker(index)}
                  onIncreaseQty={(productId) => increaseQty(index, productId)}
                  onDecreaseQty={(productId) => decreaseQty(index, productId)}
                  onRemoveSupply={(productId) => removeSupply(index, productId)}
                />
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
          </View>
        );
      }

      elements.push(card);

      if (index < values.aidStations.length - 1 && summary) {
        elements.push(
          <View key={`sep-${index}`} style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </Text>
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
          <Text style={styles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.sectionStationKm}>{station.distanceKm} km</Text>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;

      const sectionTimeline = getSectionIntakeTimeline(targetKey, Math.max(0, summary.durationMin), formatSectionTarget(summary));
      const sectionDPlus = summary.segmentStats.reduce((sum, segmentStat) => sum + Math.max(0, segmentStat.dPlus), 0);
      const sectionDMinus = summary.segmentStats.reduce((sum, segmentStat) => sum + Math.max(0, segmentStat.dMinus), 0);

      elements.push(
        <View key={`section-card-${station.id ?? index}`} style={styles.sectionViewCard}>
          <View style={styles.sectionViewHeader}>
            <Text style={styles.sectionViewTitle} numberOfLines={1}>
              {station.name} vers {nextStation.name}
            </Text>
            <Text style={styles.sectionViewMeta}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </Text>
          </View>
          {summary.profilePoints.length > 1 ? (
            <ProfileMiniChart points={summary.profilePoints} />
          ) : (
            <Text style={styles.profileEmptyText}>Profil indisponible pour cette section.</Text>
          )}
          <View style={styles.profileMetricsRow}>
            <View style={styles.profileMetricPill}>
              <Text style={styles.profileMetricPillText}>{summary.distanceKm.toFixed(2)} km</Text>
            </View>
            <View style={styles.profileMetricPill}>
              <Text style={styles.profileMetricPillText}>D+ {Math.round(sectionDPlus)} m</Text>
            </View>
            <View style={styles.profileMetricPill}>
              <Text style={styles.profileMetricPillText}>D- {Math.round(sectionDMinus)} m</Text>
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
                <Text style={styles.sectionTimelineTime}>{formatTimelineMinute(item.minute)}</Text>
                <View style={styles.sectionTimelineInfo}>
                  <Text style={styles.sectionTimelineLabel}>{item.label}</Text>
                  <Text style={styles.sectionTimelineDetail}>{item.detail}</Text>
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
          <Text style={styles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.sectionStationKm}>{station.distanceKm} km</Text>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;
      const segmentControls = getSectionSegmentControls(targetKey);

      elements.push(
        <View key={`profile-section-${station.id ?? index}`} style={styles.profileSectionBlock}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileTitle} numberOfLines={1}>
              {station.name} vers {nextStation.name}
            </Text>
            <Text style={styles.profileMeta}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </Text>
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
                  <View key={`sub-segment-${summary.sectionIndex}-${segmentIndex}`} style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                      <View style={styles.profileHeaderText}>
                        <Text style={styles.profileSegmentLabel}>{getSegmentCardTitle(segment.label, segmentIndex)}</Text>
                        <Text style={styles.profileSegmentTimeLabel}>Temps estime</Text>
                        <Text style={styles.profileSegmentTime}>{formatSectionDuration(segmentStat.etaSeconds / 60)}</Text>
                      </View>
                      <View style={styles.profilePaceWrap}>
                        <Text style={styles.profilePaceLabel}>Allure</Text>
                        <View style={styles.profilePaceControlRow}>
                          <TouchableOpacity
                            style={styles.profilePaceStepBtn}
                            onPress={() =>
                              applyAbsolutePace(
                                targetKey,
                                segmentIndex,
                                currentPaceMinutes - paceStepMinutes,
                                baseAdjustedPaceMinutes,
                                paceDraftKey,
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <Text style={styles.profilePaceStepBtnText}>-</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.profilePaceInput}
                            value={adjustmentValue}
                            onChangeText={(text) => {
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
                            onBlur={() => {
                              const draft = paceDrafts[paceDraftKey];
                              const parsed = parsePaceInput(draft ?? adjustmentValue);
                              if (parsed === undefined) {
                                onUpdateSectionSegmentPaceAdjustment(targetKey, segmentIndex, undefined);
                              } else if (parsed !== null) {
                                applyAbsolutePace(targetKey, segmentIndex, parsed, baseAdjustedPaceMinutes);
                              }
                              clearPaceDraft(paceDraftKey);
                            }}
                            keyboardType="numbers-and-punctuation"
                            placeholder="6:00"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          <TouchableOpacity
                            style={styles.profilePaceStepBtn}
                            onPress={() =>
                              applyAbsolutePace(
                                targetKey,
                                segmentIndex,
                                currentPaceMinutes + paceStepMinutes,
                                baseAdjustedPaceMinutes,
                                paceDraftKey,
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <Text style={styles.profilePaceStepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.profilePaceHint}>min/km</Text>
                      </View>
                    </View>

                    {segmentProfile.length > 1 ? (
                      <ProfileMiniChart points={segmentProfile} />
                    ) : (
                      <Text style={styles.profileEmptyText}>Profil indisponible pour ce segment.</Text>
                    )}

                    <View style={styles.profileMetricsRow}>
                      <View style={styles.profileMetricPill}>
                        <Text style={styles.profileMetricPillText}>{segmentStat.distKm.toFixed(2)} km</Text>
                      </View>
                      <View style={styles.profileMetricPill}>
                        <Text style={styles.profileMetricPillText}>D+ {Math.round(segmentStat.dPlus)} m</Text>
                      </View>
                      <View style={styles.profileMetricPill}>
                        <Text style={styles.profileMetricPillText}>D- {Math.round(segmentStat.dMinus)} m</Text>
                      </View>
                    </View>

                    <View style={styles.profileSegmentControls}>
                      <View style={styles.profileSegmentActions}>
                        <TouchableOpacity
                          style={[styles.profileActionBtn, !canSplit && styles.profileActionBtnDisabled]}
                          onPress={() => onSplitSectionSegment(targetKey, segmentIndex)}
                          activeOpacity={0.8}
                          disabled={!canSplit}
                        >
                          <Text style={styles.profileActionBtnText}>
                            {canSplit ? 'Decouper plus finement' : 'Decoupage indisponible sur ce segment'}
                          </Text>
                        </TouchableOpacity>

                        {canRemove ? (
                          <TouchableOpacity
                            style={[styles.profileActionBtn, styles.profileDeleteBtn]}
                            onPress={() => onRemoveSectionSegment(targetKey, segmentIndex)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.profileDeleteBtnText}>Supprimer et fusionner</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
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

  function renderViewForMode(mode: 'stations' | 'sections' | 'profile') {
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
  const activePageIndex = VIEW_MODES.indexOf(displayedViewMode) + 1;
  const targetPageIndex = VIEW_MODES.indexOf(selectedViewMode) + 1;
  const visiblePageRadius = 1;
  const renderedPages = useMemo(() => {
    return PAGER_MODES.map((mode, pageIndex) => {
      const shouldRender =
        Math.abs(pageIndex - activePageIndex) <= visiblePageRadius ||
        Math.abs(pageIndex - targetPageIndex) <= visiblePageRadius;
      const shouldHold = pagerHoldPageIndex !== null && pageIndex === pagerHoldPageIndex;
      return { mode, pageIndex, shouldRender: shouldRender || shouldHold };
    });
  }, [activePageIndex, pagerHoldPageIndex, targetPageIndex]);

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

  // `contentOffset` is treated as an initial value by RN; keep it stable so we
  // don't accidentally "re-snap" the pager at the end of a swipe.
  const initialPagerOffset = useMemo(() => ({ x: pageWidth, y: 0 }), [pageWidth]);
  const bottomSpacerHeight = useMemo(() => getBottomSpacerHeight(), [viewportHeight, windowHeight]);

  return (
    <>
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Ravitaillements</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity
            style={[styles.fillBtn, !isPremium && styles.fillBtnPremiumLocked]}
            onPress={fillSuppliesAuto}
          >
            <Text style={[styles.fillBtnText, !isPremium && styles.fillBtnTextPremiumLocked]}>
              {isPremium ? 'Remplir' : 'Auto · Premium'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={addAidStation}>
            <Text style={styles.addBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, selectedViewMode === 'stations' && styles.toggleBtnActive]}
          onPress={() => switchViewMode('stations')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, selectedViewMode === 'stations' && styles.toggleBtnTextActive]}>Ravitos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, selectedViewMode === 'sections' && styles.toggleBtnActive]}
          onPress={() => switchViewMode('sections')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, selectedViewMode === 'sections' && styles.toggleBtnTextActive]}>Sections</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, selectedViewMode === 'profile' && styles.toggleBtnActive]}
          onPress={() => switchViewMode('profile')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, selectedViewMode === 'profile' && styles.toggleBtnTextActive]}>Profil</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scrollContextBar}>
        {renderStationBadge(contextInfo.badge, true)}
        <Text style={styles.scrollContextLabel} numberOfLines={1}>
          {contextInfo.label}
        </Text>
        <Text style={styles.scrollContextMeta}>{contextInfo.meta}</Text>
      </View>

      <View style={[styles.swipeViewport, { height: viewportHeight }]} onLayout={handleViewportLayout}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={handlePagerBeginDrag}
          onScroll={handlePagerScroll}
          onMomentumScrollEnd={handlePagerMomentumEnd}
          contentOffset={initialPagerOffset}
        >
          {renderedPages.map(({ mode, pageIndex, shouldRender }) => (
            <View key={`${mode}-${pageIndex}`} style={[styles.swipePage, { width: pageWidth }]}>
              {shouldRender ? (
                <ScrollView
                  ref={(node) => {
                    pageScrollRefs.current[pageIndex] = node;
                  }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  scrollEventThrottle={16}
                  onScroll={(event) => handlePageScroll(mode, event)}
                  onScrollBeginDrag={() => handlePageScrollBeginDrag(mode)}
                  onScrollEndDrag={() => handlePageScrollEnd(mode)}
                  onMomentumScrollBegin={() => handlePageScrollBeginDrag(mode)}
                  onMomentumScrollEnd={() => handlePageScrollEnd(mode)}
                  onContentSizeChange={(width, height) => handlePageContentSizeChange(mode, width, height)}
                  contentContainerStyle={{ paddingBottom: bottomSpacerHeight }}
                >
                  {renderViewForMode(mode)}
                </ScrollView>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

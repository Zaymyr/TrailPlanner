import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactElement } from 'react';
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
import { getElevationSlice } from './profile-utils';
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
  gaugeAnimateSignal: number;
  canSplitSectionSegment: (target: PlanTarget, segmentIndex: number) => boolean;
  canRemoveSectionSegment: (target: PlanTarget, segmentIndex: number) => boolean;
  onSplitSectionSegment: (target: PlanTarget, segmentIndex: number) => void;
  onRemoveSectionSegment: (target: PlanTarget, segmentIndex: number) => void;
  onUpdateSectionSegmentPaceAdjustment: (
    target: PlanTarget,
    segmentIndex: number,
    paceAdjustmentMinutesPerKm: number | undefined,
  ) => void;
  parentScrollY: number;
  containerTopY: number;
  onRequestParentScroll: (y: number) => void;
};

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
  gaugeAnimateSignal,
  canSplitSectionSegment,
  canRemoveSectionSegment,
  onSplitSectionSegment,
  onRemoveSectionSegment,
  onUpdateSectionSegmentPaceAdjustment,
  parentScrollY,
  containerTopY,
  onRequestParentScroll,
}: Props) {
  const viewModes: Array<'stations' | 'sections' | 'profile'> = ['stations', 'sections', 'profile'];
  const pagerModes: Array<'profile' | 'stations' | 'sections' | 'profile' | 'stations'> = [
    'profile',
    'stations',
    'sections',
    'profile',
    'stations',
  ];
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.max(280, windowWidth - 40);
  const pagerRef = useRef<ScrollView>(null);
  const [selectedViewMode, setSelectedViewMode] = useState<'stations' | 'sections' | 'profile'>('stations');
  const [displayedViewMode, setDisplayedViewMode] = useState<'stations' | 'sections' | 'profile'>('stations');
  const [pagerOffsetX, setPagerOffsetX] = useState(pageWidth);
  const [paceDrafts, setPaceDrafts] = useState<Record<string, string>>({});
  const [viewHeights, setViewHeights] = useState<Record<'stations' | 'sections' | 'profile', number>>({
    stations: 0,
    sections: 0,
    profile: 0,
  });
  const [viewAnchors, setViewAnchors] = useState<Record<'stations' | 'sections' | 'profile', Record<number, number>>>({
    stations: {},
    sections: {},
    profile: {},
  });
  const paceStepMinutes = 5 / 60;

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
    draftKey?: string,
  ) {
    if (paceMinutesPerKm === undefined) {
      onUpdateSectionSegmentPaceAdjustment(target, segmentIndex, undefined);
      if (draftKey) clearPaceDraft(draftKey);
      return;
    }

    const nextPace = Math.max(0.01, paceMinutesPerKm);
    onUpdateSectionSegmentPaceAdjustment(target, segmentIndex, nextPace - basePaceMinutesPerKm);
    if (draftKey) {
      setPaceDraft(draftKey, formatPace(nextPace));
    }
  }

  function getWrappedMode(index: number) {
    const wrappedIndex = (index + viewModes.length) % viewModes.length;
    return viewModes[wrappedIndex];
  }

  function handleViewLayout(mode: 'stations' | 'sections' | 'profile', event: LayoutChangeEvent) {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setViewHeights((prev) => {
      if (prev[mode] === nextHeight) return prev;
      return { ...prev, [mode]: nextHeight };
    });
  }

  function registerAnchor(mode: 'stations' | 'sections' | 'profile', index: number, event: LayoutChangeEvent) {
    const nextY = Math.round(event.nativeEvent.layout.y);
    setViewAnchors((prev) => {
      if (prev[mode][index] === nextY) return prev;
      return {
        ...prev,
        [mode]: {
          ...prev[mode],
          [index]: nextY,
        },
      };
    });
  }

  function getClosestAnchorIndex(mode: 'stations' | 'sections' | 'profile') {
    const localScrollY = Math.max(0, parentScrollY - containerTopY);
    const anchors = Object.entries(viewAnchors[mode]);
    if (anchors.length === 0) return 0;

    return anchors
      .map(([index, y]) => ({ index: Number(index), distance: Math.abs(y - localScrollY) }))
      .sort((left, right) => left.distance - right.distance)[0]?.index ?? 0;
  }

  function alignParentScroll(nextMode: 'stations' | 'sections' | 'profile', fromMode = displayedViewMode) {
    const anchorIndex = getClosestAnchorIndex(fromMode);
    const targetAnchorY = viewAnchors[nextMode][anchorIndex] ?? viewAnchors[nextMode][0] ?? 0;
    onRequestParentScroll(containerTopY + targetAnchorY);
  }

  function switchViewMode(nextMode: 'stations' | 'sections' | 'profile') {
    if (nextMode === displayedViewMode) return;

    alignParentScroll(nextMode, displayedViewMode);
    const nextPageIndex = viewModes.indexOf(nextMode) + 1;
    setSelectedViewMode(nextMode);
    setDisplayedViewMode(nextMode);
    pagerRef.current?.scrollTo({ x: nextPageIndex * pageWidth, animated: true });
  }

  function switchViewByDelta(delta: -1 | 1) {
    const currentIndex = viewModes.indexOf(displayedViewMode);
    if (currentIndex < 0) return;
    switchViewMode(getWrappedMode(currentIndex + delta));
  }

  useEffect(() => {
    const currentPageIndex = viewModes.indexOf(displayedViewMode) + 1;
    if (currentPageIndex <= 0) return;
    setPagerOffsetX(currentPageIndex * pageWidth);
    pagerRef.current?.scrollTo({ x: currentPageIndex * pageWidth, animated: false });
  }, [displayedViewMode, pageWidth]);

  function handlePagerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPagerOffsetX(event.nativeEvent.contentOffset.x);
  }

  function getViewportHeight() {
    const safePageWidth = Math.max(pageWidth, 1);
    const rawIndex = pagerOffsetX / safePageWidth;
    const fromIndex = Math.max(0, Math.min(pagerModes.length - 1, Math.floor(rawIndex)));
    const toIndex = Math.max(0, Math.min(pagerModes.length - 1, Math.ceil(rawIndex)));
    const progress = Math.max(0, Math.min(1, rawIndex - fromIndex));
    const fromHeight = Math.max(1, viewHeights[pagerModes[fromIndex]] || 0);
    const toHeight = Math.max(1, viewHeights[pagerModes[toIndex]] || 0);

    return Math.round(fromHeight + (toHeight - fromHeight) * progress);
  }

  function handlePagerMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const rawPageIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1));
    const boundedPageIndex = Math.max(0, Math.min(pagerModes.length - 1, rawPageIndex));

    let nextMode: 'stations' | 'sections' | 'profile';
    let resetPageIndex: number | null = null;

    if (boundedPageIndex === 0) {
      nextMode = 'profile';
      resetPageIndex = 3;
    } else if (boundedPageIndex === pagerModes.length - 1) {
      nextMode = 'stations';
      resetPageIndex = 1;
    } else {
      nextMode = viewModes[boundedPageIndex - 1];
    }

    if (nextMode !== displayedViewMode) {
      alignParentScroll(nextMode, displayedViewMode);
      setSelectedViewMode(nextMode);
      setDisplayedViewMode(nextMode);
    }

    if (resetPageIndex !== null) {
      requestAnimationFrame(() => {
        setPagerOffsetX(resetPageIndex * pageWidth);
        pagerRef.current?.scrollTo({ x: resetPageIndex * pageWidth, animated: false });
      });
    }
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

  function getCollapsedTint(target: 'start' | number, summary: SectionSummary | null) {
    const metrics = getGaugeMetrics(target, formatSectionTarget(summary));
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
      const targetKey: PlanTarget = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;

      let card: ReactElement;

      if (isDepart) {
        const collapsedTintStyle = getCollapsedTint('start', summary);
        card = (
          <View key={stationKey} style={[styles.stationCard, !isExpanded && collapsedTintStyle]} onLayout={(event) => registerAnchor('stations', index, event)}>
            <TouchableOpacity onPress={() => toggleStation(stationKey)} activeOpacity={0.7} style={styles.stationHeaderRow}>
              <Text style={styles.stationIcon}>D</Text>
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
                  metrics={getGaugeMetrics('start', formatSectionTarget(summary))}
                  formatGaugeValue={formatGaugeValue}
                  getGaugeColor={getGaugeColor}
                  animateSignal={gaugeAnimateSignal}
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
                    metrics={getGaugeMetrics('start', formatSectionTarget(summary))}
                    formatGaugeValue={formatGaugeValue}
                    getGaugeColor={getGaugeColor}
                    compact
                    animateSignal={gaugeAnimateSignal}
                  />
                </View>
              </>
            )}
          </View>
        );
      } else if (isArrivee) {
        card = (
          <View key={stationKey} style={styles.stationCard} onLayout={(event) => registerAnchor('stations', index, event)}>
            <View style={styles.stationHeaderRow}>
              <Text style={styles.stationIcon}>A</Text>
              <Text style={styles.stationName}>{station.name}</Text>
              {renderPauseBadge(station.pauseMinutes)}
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
            </View>
          </View>
        );
      } else {
        const collapsedTintStyle = getCollapsedTint(index, summary);
        card = (
          <View key={stationKey} style={[styles.stationCard, !isExpanded && collapsedTintStyle]} onLayout={(event) => registerAnchor('stations', index, event)}>
            <TouchableOpacity onPress={() => toggleStation(stationKey)} activeOpacity={0.7} style={styles.stationHeaderRow}>
              <Text style={styles.stationIcon}>R</Text>
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
                  metrics={getGaugeMetrics(index, formatSectionTarget(summary))}
                  formatGaugeValue={formatGaugeValue}
                  getGaugeColor={getGaugeColor}
                  animateSignal={gaugeAnimateSignal}
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
                    metrics={getGaugeMetrics(index, formatSectionTarget(summary))}
                    formatGaugeValue={formatGaugeValue}
                    getGaugeColor={getGaugeColor}
                    compact
                    animateSignal={gaugeAnimateSignal}
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
        <View key={`station-line-${station.id ?? index}`} style={styles.sectionStationRow} onLayout={(event) => registerAnchor('sections', index, event)}>
          <View style={styles.sectionStationLine} />
          <Text style={styles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.sectionStationKm}>{station.distanceKm} km</Text>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;

      const sectionTimeline = getSectionIntakeTimeline(targetKey, Math.max(0, summary.durationMin), formatSectionTarget(summary));

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
          {sectionTimeline.length === 0 ? (
            <Text style={styles.sectionTimelineEmpty}>Aucune prise prevue</Text>
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
        <View key={`profile-station-line-${station.id ?? index}`} style={styles.sectionStationRow} onLayout={(event) => registerAnchor('profile', index, event)}>
          <View style={styles.sectionStationLine} />
          <Text style={styles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.sectionStationKm}>{station.distanceKm} km</Text>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;

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
            <Text style={styles.profileEmptyText}>Aucun decoupage disponible pour cette section.</Text>
          ) : (
            <View style={styles.profileSegmentsList}>
              {summary.segmentStats.map((segmentStat, segmentIndex) => {
                const segment = summary.segments[segmentIndex];
                if (!segment) return null;

                const currentPaceMinutes =
                  Math.max(
                    0.01,
                    basePaceMinutesPerKm +
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
                const canSplit = canSplitSectionSegment(targetKey, segmentIndex);
                const canRemove = canRemoveSectionSegment(targetKey, segmentIndex);

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
                            onPress={() => applyAbsolutePace(targetKey, segmentIndex, currentPaceMinutes - paceStepMinutes, paceDraftKey)}
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
                                applyAbsolutePace(targetKey, segmentIndex, parsed);
                              }
                            }}
                            onBlur={() => {
                              const draft = paceDrafts[paceDraftKey];
                              const parsed = parsePaceInput(draft ?? adjustmentValue);
                              if (parsed === undefined) {
                                onUpdateSectionSegmentPaceAdjustment(targetKey, segmentIndex, undefined);
                              } else if (parsed !== null) {
                                applyAbsolutePace(targetKey, segmentIndex, parsed);
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
                            onPress={() => applyAbsolutePace(targetKey, segmentIndex, currentPaceMinutes + paceStepMinutes, paceDraftKey)}
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

  function renderViewForMode(mode: 'stations' | 'sections' | 'profile') {
    if (mode === 'stations') {
      return (
        <>
          {intermediateCount === 0 && (
            <Text style={styles.emptyText}>Pas de ravito intermediaire. Utilise "+ Ajouter" pour en creer.</Text>
          )}
          {renderStationsView()}
        </>
      );
    }

    if (mode === 'sections') {
      return renderSectionsView();
    }

    return renderProfileView();
  }
  const viewportHeight = getViewportHeight();

  return (
    <>
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Ravitaillements</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={styles.fillBtn} onPress={fillSuppliesAuto}>
            <Text style={styles.fillBtnText}>Remplir</Text>
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

      <View style={[styles.swipeViewport, { height: viewportHeight }]}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handlePagerScroll}
          onMomentumScrollEnd={handlePagerMomentumEnd}
          contentOffset={{ x: (viewModes.indexOf(displayedViewMode) + 1) * pageWidth, y: 0 }}
        >
          {pagerModes.map((mode, pageIndex) => (
            <View key={`${mode}-${pageIndex}`} style={[styles.swipePage, { width: pageWidth }]}>
              <View onLayout={(event) => handleViewLayout(mode, event)}>{renderViewForMode(mode)}</View>
            </View>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

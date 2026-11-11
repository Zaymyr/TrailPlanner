import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Colors } from '../../constants/colors';
import type { ElevationPoint } from '../plan-form/profile-utils';
import type { RacebookAidStation } from '../../lib/racebook';
import { getCourseProgressAtDistance, getElevationBounds, interpolateElevationAtDistance } from '../../lib/racebookCourseVisuals';
import { useI18n } from '../../lib/i18n';
import { colors } from '@pace-yourself/design-system';

import { Cote } from '../themed/Cote';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { formatDistance, formatDistanceValue } from '../../lib/displayFormat';

type Props = {
  points: ElevationPoint[];
  aidStations: RacebookAidStation[];
  accentColor: string;
  officialDistanceKm: number;
  locale: 'fr' | 'en';
  expanded?: boolean;
  profileHeight?: number;
};

// The curve spans the whole chart: elevation labels sit inside the plot,
// above their grid line, instead of in a reserved axis column.
const SIDE_PADDING = 12;
const LABEL_HEIGHT = 15;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 28;
const STATION_SNAP_DISTANCE_KM = 0.2;
/** Map-style figures inside the SVG (graduations, summit cote). */
const MONO_FONT = 'JetBrainsMono_600SemiBold';
/** Offset of the faint iso-line echoing the course below its own curve. */
const CONTOUR_ECHO_OFFSET = 7;
const SUMMIT_FLAG_HEIGHT = 16;

function formatNumber(value: number, locale: 'fr' | 'en') {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 }).format(value);
}

function samplePoints(points: ElevationPoint[], maxPoints: number) {
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const sampled = points.filter((_, index) => index % step === 0);
  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) sampled.push(lastPoint);
  return sampled;
}

export function RacebookElevationProfile({
  points,
  aidStations,
  accentColor,
  officialDistanceKm,
  locale,
  expanded = false,
  profileHeight,
}: Props) {
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [inspectedDistanceKm, setInspectedDistanceKm] = useState<number | null>(points[0]?.distanceKm ?? null);
  // Cumulative tiles show a placeholder until the runner touches the curve,
  // instead of a meaningless "0 km / 0 m" at the start line.
  const [hasInspected, setHasInspected] = useState(false);
  const chartHeight = profileHeight ?? (expanded ? 250 : 190);

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) setWidth(nextWidth);
  };

  const chart = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const sampled = samplePoints(points, expanded ? 220 : 110);
    const minDistance = sampled[0].distanceKm;
    const maxDistance = sampled[sampled.length - 1].distanceKm;
    const distanceSpan = Math.max(0.001, maxDistance - minDistance);
    const bounds = getElevationBounds(sampled);
    if (!bounds) return null;
    const elevationPadding = Math.max(15, (bounds.maxElevationM - bounds.minElevationM) * 0.08);
    const minElevation = bounds.minElevationM - elevationPadding;
    const maxElevation = bounds.maxElevationM + elevationPadding;
    const elevationSpan = Math.max(1, maxElevation - minElevation);
    const innerWidth = Math.max(1, width - SIDE_PADDING * 2);
    const innerHeight = chartHeight - TOP_PADDING - BOTTOM_PADDING;
    const xFor = (distanceKm: number) => SIDE_PADDING + ((distanceKm - minDistance) / distanceSpan) * innerWidth;
    const yFor = (elevationM: number) => TOP_PADDING + innerHeight - ((elevationM - minElevation) / elevationSpan) * innerHeight;
    const path = sampled.map((point, index) => `${index ? 'L' : 'M'} ${xFor(point.distanceKm)} ${yFor(point.elevationM)}`).join(' ');
    const baseline = TOP_PADDING + innerHeight;
    const ticks = [bounds.maxElevationM, (bounds.maxElevationM + bounds.minElevationM) / 2, bounds.minElevationM];
    const distanceTicks = [minDistance, minDistance + distanceSpan / 2, maxDistance];
    const summitPoint = sampled.reduce((highest, point) => (point.elevationM > highest.elevationM ? point : highest), sampled[0]);
    const stationPoints = aidStations.flatMap((station) => {
      const elevationM = interpolateElevationAtDistance(points, station.km);
      if (elevationM === null || station.km < minDistance || station.km > maxDistance) return [];
      return [{ station, x: xFor(station.km), y: yFor(elevationM) }];
    });

    return {
      areaPath: `${path} L ${xFor(maxDistance)} ${baseline} L ${SIDE_PADDING} ${baseline} Z`,
      baseline,
      bounds,
      distanceTicks,
      distanceSpan,
      innerWidth,
      maxDistance,
      minDistance,
      path,
      stationPoints,
      summit: { x: xFor(summitPoint.distanceKm), y: yFor(summitPoint.elevationM), elevationM: summitPoint.elevationM },
      ticks,
      xFor,
      yFor,
    };
  }, [aidStations, chartHeight, expanded, points, width]);

  const inspection = useMemo(
    () => inspectedDistanceKm === null ? null : getCourseProgressAtDistance(points, inspectedDistanceKm),
    [inspectedDistanceKm, points],
  );
  const inspectionPosition = chart && inspection
    ? { x: chart.xFor(inspection.distanceKm), y: chart.yFor(inspection.elevationM) }
    : null;
  const updateInspection = useCallback((distanceKm: number) => {
    if (!chart) return;
    const hoveredStation = chart.stationPoints.reduce<(typeof chart.stationPoints)[number] | null>((closest, candidate) => {
      if (Math.abs(candidate.station.km - distanceKm) > STATION_SNAP_DISTANCE_KM) return closest;
      if (!closest || Math.abs(candidate.station.km - distanceKm) < Math.abs(closest.station.km - distanceKm)) return candidate;
      return closest;
    }, null);

    setHasInspected(true);
    setInspectedDistanceKm(hoveredStation?.station.km ?? distanceKm);
    setSelectedStationId(hoveredStation?.station.id ?? null);
  }, [chart]);
  const chartResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      if (!chart) return;
      const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / chart.innerWidth));
      updateInspection(chart.minDistance + chart.distanceSpan * ratio);
    },
    onPanResponderMove: (event) => {
      if (!chart) return;
      const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / chart.innerWidth));
      updateInspection(chart.minDistance + chart.distanceSpan * ratio);
    },
    onPanResponderTerminationRequest: () => true,
  }), [chart, updateInspection]);

  const adjustInspection = (direction: -1 | 1) => {
    if (!chart) return;
    const step = Math.max(0.1, chart.distanceSpan / 20);
    const nextDistance = (() => {
      const current = inspectedDistanceKm;
      const startingDistance = current ?? chart.minDistance;
      return Math.max(chart.minDistance, Math.min(chart.maxDistance, startingDistance + direction * step));
    })();
    updateInspection(nextDistance);
  };

  const selectedStation = aidStations.find((station) => station.id === selectedStationId) ?? null;
  const selectedStationProgress = selectedStation ? getCourseProgressAtDistance(points, selectedStation.km) : null;
  const selectedStationCumulativeGain = selectedStation
    ? selectedStation.organizerDetails.cumulativeElevationGainM ?? selectedStationProgress?.elevationGainM
    : null;
  const selectedStationCumulativeLoss = selectedStation
    ? selectedStation.organizerDetails.cumulativeElevationLossM ?? selectedStationProgress?.elevationLossM
    : null;
  const profileDistanceKm = points[points.length - 1]?.distanceKm ?? 0;
  const isPartialProfile = officialDistanceKm > 0 && profileDistanceKm < officialDistanceKm * 0.9;
  const services = selectedStation
    ? [
        selectedStation.waterAvailable ? t.catalog.racebookAidWater : null,
        selectedStation.solidAvailable ? t.catalog.racebookAidFood : null,
        selectedStation.assistanceAllowed ? t.catalog.racebookAidAssistance : null,
        selectedStation.organizerDetails.dropBagAvailable ? t.catalog.racebookAidDropBag : null,
      ].filter(Boolean)
    : [];
  const stationNote = selectedStation
    ? selectedStation.organizerDetails.organizerNote ?? selectedStation.notes
    : null;
  const stationContext = selectedStation
    ? [
        services.join(' · ') || null,
        selectedStation.organizerDetails.cutoffTime
          ? `${t.catalog.racebookAidCutoffTime} ${selectedStation.organizerDetails.cutoffTime}`
          : null,
      ].filter(Boolean)
    : [];

  return (
    <View style={styles.root}>
      <View style={[styles.chart, expanded && styles.chartExpanded, { height: chartHeight }]} onLayout={onLayout}>
        {chart ? (
          <>
            <Svg width={width} height={chartHeight}>
              <Defs>
                <LinearGradient id="racebook-profile-area" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={accentColor} stopOpacity={0.38} />
                  <Stop offset="100%" stopColor={accentColor} stopOpacity={0.05} />
                </LinearGradient>
              </Defs>
              {chart.ticks.map((tick) => {
                const y = chart.yFor(tick);
                return <Line key={tick} x1={SIDE_PADDING} x2={width - SIDE_PADDING} y1={y} y2={y} stroke={Colors.border} strokeDasharray="4 5" />;
              })}
              <Path d={chart.areaPath} fill="url(#racebook-profile-area)" />
              {/* Decorative iso-line echo: the trail signature, not data. */}
              <Path
                d={chart.path}
                fill="none"
                stroke={accentColor}
                strokeLinejoin="round"
                strokeOpacity={0.22}
                strokeWidth={1.25}
                transform={`translate(0 ${CONTOUR_ECHO_OFFSET})`}
              />
              <Path d={chart.path} fill="none" stroke={accentColor} strokeWidth={expanded ? 4 : 3.5} strokeLinejoin="round" strokeLinecap="round" />
              {(() => {
                const { x, y, elevationM } = chart.summit;
                const flagTop = y - SUMMIT_FLAG_HEIGHT - 3;
                const label = `${formatNumber(elevationM, locale)} M`;
                const labelWidth = label.length * 6.4 + 10;
                // Keep the summit cote inside the chart and clear of the flag.
                const flagOnRight = x + 4 + 10 + labelWidth < width - SIDE_PADDING;
                const labelX = flagOnRight ? x + 16 : x - 6 - labelWidth;
                return (
                  <G>
                    <Line x1={x} x2={x} y1={flagTop} y2={y - 3} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
                    <Rect x={x + 0.75} y={flagTop} width={10} height={3} rx={1} fill={colors.accent.olive} />
                    <Rect x={x + 0.75} y={flagTop + 4.5} width={10} height={1.5} rx={0.75} fill={colors.accent.amber} fillOpacity={0.72} />
                    <Rect x={x + 0.75} y={flagTop + 7.5} width={10} height={3} rx={1} fill={colors.brand.forest} />
                    <Rect x={labelX} y={flagTop - 1} width={labelWidth} height={LABEL_HEIGHT} rx={4} fill="#FFFFFF" fillOpacity={0.9} />
                    <SvgText x={labelX + 5} y={flagTop + 10} fill={Colors.textPrimary} fontFamily={MONO_FONT} fontSize="10" letterSpacing={0.4}>
                      {label}
                    </SvgText>
                  </G>
                );
              })()}
              {/* The highest graduation is carried by the summit cote instead. */}
              {chart.ticks.slice(1).map((tick) => {
                const label = `${formatNumber(tick, locale)} M`;
                const top = Math.max(0, chart.yFor(tick) - LABEL_HEIGHT - 2);
                return (
                  <G key={`label-${tick}`}>
                    <Rect x={SIDE_PADDING - 4} y={top} width={label.length * 6 + 8} height={LABEL_HEIGHT} rx={4} fill="#FFFFFF" fillOpacity={0.82} />
                    <SvgText x={SIDE_PADDING} y={top + 11} fill={Colors.textSecondary} fontFamily={MONO_FONT} fontSize="10" letterSpacing={0.4} textAnchor="start">
                      {label}
                    </SvgText>
                  </G>
                );
              })}
              {chart.stationPoints.map(({ station, x, y }) => (
                <G key={station.id}>
                  <Line x1={x} x2={x} y1={y + 7} y2={chart.baseline} stroke={accentColor} strokeOpacity={0.28} strokeDasharray="3 5" />
                </G>
              ))}
              {inspectionPosition ? (
                <G>
                  <Line
                    x1={inspectionPosition.x}
                    x2={inspectionPosition.x}
                    y1={TOP_PADDING}
                    y2={chart.baseline}
                    stroke={Colors.textPrimary}
                    strokeOpacity={0.72}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  <Circle cx={inspectionPosition.x} cy={inspectionPosition.y} r={7} fill="#FFFFFF" stroke={accentColor} strokeWidth={3} />
                </G>
              ) : null}
              {chart.distanceTicks.map((tick, index) => (
                <SvgText
                  key={tick}
                  x={chart.xFor(tick)}
                  y={chartHeight - 7}
                  fill={Colors.textMuted}
                  fontFamily={MONO_FONT}
                  fontSize="10"
                  letterSpacing={0.4}
                  textAnchor={index === 0 ? 'start' : index === chart.distanceTicks.length - 1 ? 'end' : 'middle'}
                >
                  {formatDistance(tick, locale).replace(/km$/, 'KM')}
                </SvgText>
              ))}
            </Svg>
            <View
              {...chartResponder.panHandlers}
              style={styles.inspectionGestureLayer}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t.catalog.racebookProfileExplore}
              accessibilityHint={t.catalog.racebookProfileExploreHint}
              accessibilityValue={inspection ? {
                text: `${formatDistance(inspection.distanceKm, locale)}, D+ ${formatNumber(inspection.elevationGainM, locale)} m, D− ${formatNumber(inspection.elevationLossM, locale)} m`,
              } : undefined}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => adjustInspection(event.nativeEvent.actionName === 'decrement' ? -1 : 1)}
            />
            {chart.stationPoints.map(({ station, x, y }) => (
              <Pressable
                key={station.id}
                style={[styles.stationHitArea, { left: x - 22, top: y - 22 }]}
                onPress={() => {
                  setHasInspected(true);
                  setInspectedDistanceKm(station.km);
                  setSelectedStationId((current) => current === station.id ? null : station.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t.catalog.racebookAidStationSingular} ${station.name}, ${formatDistance(station.km, locale)}`}
                accessibilityHint={t.catalog.racebookAidStationDetailsHint}
              >
                <View style={[styles.stationMarker, { backgroundColor: accentColor }]}>
                  <View style={styles.stationMarkerCore} />
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </View>

      {selectedStation ? (
        expanded ? (
          <View style={[styles.stationDetail, styles.stationDetailExpanded, { borderColor: accentColor }]} accessibilityLiveRegion="polite">
            <View style={styles.stationDetailExpandedIdentity}>
              <View style={[styles.stationDetailIcon, styles.stationDetailIconExpanded, { backgroundColor: accentColor }]}>
                <Ionicons name="water" size={13} color="#FFFFFF" />
              </View>
              <View style={styles.stationDetailTitleWrap}>
                <Text style={styles.stationDetailEyebrow}>{t.catalog.racebookAidStationSingular}</Text>
                <Text style={styles.stationDetailTitle}>{selectedStation.name}</Text>
              </View>
            </View>

            <View style={styles.stationStatsExpanded}>
              <View style={styles.stationStatExpanded}>
                <Text style={styles.stationStatLabel}>Distance</Text>
                <DataText style={styles.stationStatValueExpanded}>
                  {formatDistance(selectedStation.km, locale)}
                </DataText>
              </View>
              <View style={styles.stationStatExpanded}>
                <Text style={styles.stationStatLabel}>{t.catalog.racebookCumulativeGain}</Text>
                <DataText style={styles.stationStatValueExpanded}>
                  {selectedStationCumulativeGain !== null && selectedStationCumulativeGain !== undefined
                    ? `${formatNumber(selectedStationCumulativeGain, locale)} m`
                    : '—'}
                </DataText>
              </View>
              <View style={styles.stationStatExpanded}>
                <Text style={styles.stationStatLabel}>{t.catalog.racebookCumulativeLoss}</Text>
                <DataText style={styles.stationStatValueExpanded}>
                  {selectedStationCumulativeLoss !== null && selectedStationCumulativeLoss !== undefined
                    ? `${formatNumber(selectedStationCumulativeLoss, locale)} m`
                    : '—'}
                </DataText>
              </View>
            </View>

            {stationContext.length > 0 || stationNote ? (
              <View style={styles.stationDetailExpandedContext}>
                {stationContext.length > 0 ? <Text style={styles.stationDetailMeta}>{stationContext.join(' · ')}</Text> : null}
                {stationNote ? <Text style={styles.stationDetailNoteExpanded}>{stationNote}</Text> : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => setSelectedStationId(null)}
              style={styles.closeDetail}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.common.close}
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.stationDetail, { borderColor: accentColor }]} accessibilityLiveRegion="polite">
            <View style={styles.stationDetailHeader}>
              <View style={[styles.stationDetailIcon, { backgroundColor: accentColor }]}>
                <Ionicons name="water" size={15} color="#FFFFFF" />
              </View>
              <View style={styles.stationDetailTitleWrap}>
                <Text style={styles.stationDetailEyebrow}>{t.catalog.racebookAidStationSingular}</Text>
                <Text style={styles.stationDetailTitle}>{selectedStation.name}</Text>
              </View>
              <Pressable
                onPress={() => setSelectedStationId(null)}
                style={styles.closeDetail}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.common.close}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.stationStats}>
              <View style={styles.stationStat}>
                <Text style={styles.stationStatLabel}>{t.catalog.racebookCumulativeDistance}</Text>
                <DataText style={styles.stationStatValue}>
                  {formatDistance(selectedStation.km, locale)}
                </DataText>
              </View>
              <View style={styles.stationStat}>
                <Text style={styles.stationStatLabel}>{t.catalog.racebookCumulativeGain}</Text>
                <DataText style={styles.stationStatValue}>
                  {selectedStationCumulativeGain !== null && selectedStationCumulativeGain !== undefined
                    ? `${formatNumber(selectedStationCumulativeGain, locale)} m`
                    : '—'}
                </DataText>
              </View>
            </View>
            {(() => {
              const details = [
                services.join(' · ') || null,
                selectedStationCumulativeLoss !== null && selectedStationCumulativeLoss !== undefined ? `D- ${formatNumber(selectedStationCumulativeLoss, locale)} m` : null,
                selectedStation.organizerDetails.cutoffTime ? `${t.catalog.racebookAidCutoffTime} ${selectedStation.organizerDetails.cutoffTime}` : null,
              ].filter(Boolean);
              return details.length > 0 ? <Text style={styles.stationDetailMeta}>{details.join(' · ')}</Text> : null;
            })()}
            {stationNote ? <Text style={styles.stationDetailNote}>{stationNote}</Text> : null}
          </View>
        )
      ) : inspection ? (
        <View style={styles.metricsRow} accessibilityLiveRegion="polite">
          <View style={styles.metric}>
            <Cote label={t.catalog.racebookCumulativeDistance} size="sm" value={hasInspected ? formatDistance(inspection.distanceKm, locale) : '—'} />
          </View>
          <View style={styles.metric}>
            <Cote label={t.catalog.racebookCumulativeGain} size="sm" value={hasInspected ? `${formatNumber(inspection.elevationGainM, locale)} m` : '—'} />
          </View>
          <View style={styles.metric}>
            <Cote label={t.catalog.racebookCumulativeLoss} size="sm" value={hasInspected ? `${formatNumber(inspection.elevationLossM, locale)} m` : '—'} />
          </View>
        </View>
      ) : null}

      {isPartialProfile && !expanded ? (
        <View style={styles.coverageNotice} accessibilityRole="text">
          <Ionicons name="information-circle-outline" size={17} color={Colors.warning} />
          <Text style={styles.coverageNoticeText}>
            {t.catalog.racebookProfileCoverage
              .replace('{covered}', formatDistanceValue(profileDistanceKm, locale))
              .replace('{official}', formatDistanceValue(officialDistanceKm, locale))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  // Bleeds into the card padding so the curve uses almost the full card width.
  chart: { alignSelf: 'stretch', marginHorizontal: -10, overflow: 'hidden', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.62)' },
  chartExpanded: { marginHorizontal: 0, backgroundColor: Colors.surface },
  inspectionGestureLayer: { position: 'absolute', zIndex: 2, left: SIDE_PADDING, right: SIDE_PADDING, top: 0, bottom: BOTTOM_PADDING },
  stationHitArea: { position: 'absolute', zIndex: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stationMarker: { width: 15, height: 15, borderRadius: 8, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  stationMarkerCore: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, minWidth: 68, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  coverageNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.warningSurface },
  coverageNoticeText: { flex: 1, color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  stationDetail: { padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: Colors.surface, gap: 5 },
  stationDetailExpanded: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  stationDetailExpandedIdentity: { width: 130, minWidth: 90, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  stationDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stationDetailIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stationDetailIconExpanded: { width: 26, height: 26, borderRadius: 13 },
  stationDetailTitleWrap: { flex: 1, minWidth: 0 },
  stationDetailEyebrow: { color: Colors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700', textTransform: 'uppercase' },
  stationDetailTitle: { color: Colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  closeDetail: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stationStats: { flexDirection: 'row', gap: 8 },
  stationStatsExpanded: { flexShrink: 1, flexDirection: 'row', gap: 4 },
  stationStat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surfaceSecondary },
  stationStatExpanded: { width: 72, minWidth: 58, flexShrink: 1, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 9, backgroundColor: Colors.surfaceSecondary },
  stationStatLabel: { color: Colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: '700', textTransform: 'uppercase' },
  stationStatValue: { marginTop: 1, color: Colors.textPrimary, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  stationStatValueExpanded: { marginTop: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  stationDetailMeta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  stationDetailNote: { marginTop: 2, paddingTop: 7, borderTopWidth: 1, borderTopColor: Colors.border, color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  stationDetailExpandedContext: { flex: 1, minWidth: 70, gap: 2 },
  stationDetailNoteExpanded: { color: Colors.textSecondary, fontSize: 11, lineHeight: 14 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { Colors } from '../../constants/colors';
import type { ElevationPoint } from '../plan-form/profile-utils';
import type { RacebookAidStation } from '../../lib/racebook';
import { getCourseProgressAtDistance, getElevationBounds, interpolateElevationAtDistance } from '../../lib/racebookCourseVisuals';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

type Props = {
  points: ElevationPoint[];
  aidStations: RacebookAidStation[];
  accentColor: string;
  officialDistanceKm: number;
  locale: 'fr' | 'en';
  expanded?: boolean;
  profileHeight?: number;
};

const AXIS_WIDTH = 48;
const RIGHT_PADDING = 22;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 28;
const STATION_SNAP_DISTANCE_KM = 0.2;

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
  const [width, setWidth] = useState(0);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [inspectedDistanceKm, setInspectedDistanceKm] = useState<number | null>(points[0]?.distanceKm ?? null);
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
    const innerWidth = Math.max(1, width - AXIS_WIDTH - RIGHT_PADDING);
    const innerHeight = chartHeight - TOP_PADDING - BOTTOM_PADDING;
    const xFor = (distanceKm: number) => AXIS_WIDTH + ((distanceKm - minDistance) / distanceSpan) * innerWidth;
    const yFor = (elevationM: number) => TOP_PADDING + innerHeight - ((elevationM - minElevation) / elevationSpan) * innerHeight;
    const path = sampled.map((point, index) => `${index ? 'L' : 'M'} ${xFor(point.distanceKm)} ${yFor(point.elevationM)}`).join(' ');
    const baseline = TOP_PADDING + innerHeight;
    const ticks = [bounds.maxElevationM, (bounds.maxElevationM + bounds.minElevationM) / 2, bounds.minElevationM];
    const distanceTicks = [minDistance, minDistance + distanceSpan / 2, maxDistance];
    const stationPoints = aidStations.flatMap((station) => {
      const elevationM = interpolateElevationAtDistance(points, station.km);
      if (elevationM === null || station.km < minDistance || station.km > maxDistance) return [];
      return [{ station, x: xFor(station.km), y: yFor(elevationM) }];
    });

    return {
      areaPath: `${path} L ${xFor(maxDistance)} ${baseline} L ${AXIS_WIDTH} ${baseline} Z`,
      baseline,
      bounds,
      distanceTicks,
      distanceSpan,
      innerWidth,
      maxDistance,
      minDistance,
      path,
      stationPoints,
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
        selectedStation.waterAvailable ? (locale === 'fr' ? 'Eau' : 'Water') : null,
        selectedStation.solidAvailable ? (locale === 'fr' ? 'Solide' : 'Food') : null,
        selectedStation.assistanceAllowed ? (locale === 'fr' ? 'Assistance autorisée' : 'Crew allowed') : null,
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
                return (
                  <G key={tick}>
                    <Line x1={AXIS_WIDTH} x2={width - RIGHT_PADDING} y1={y} y2={y} stroke={Colors.border} strokeDasharray="4 5" />
                    <SvgText x={AXIS_WIDTH - 7} y={y + 4} fill={Colors.textMuted} fontSize="10" textAnchor="end">
                      {formatNumber(tick, locale)} m
                    </SvgText>
                  </G>
                );
              })}
              <Path d={chart.areaPath} fill="url(#racebook-profile-area)" />
              <Path d={chart.path} fill="none" stroke={accentColor} strokeWidth={expanded ? 4 : 3.5} strokeLinejoin="round" strokeLinecap="round" />
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
                  fontSize="10"
                  textAnchor={index === 0 ? 'start' : index === chart.distanceTicks.length - 1 ? 'end' : 'middle'}
                >
                  {tick >= 100 ? tick.toFixed(0) : tick.toFixed(1)} km
                </SvgText>
              ))}
            </Svg>
            <View
              {...chartResponder.panHandlers}
              style={styles.inspectionGestureLayer}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={locale === 'fr' ? 'Explorer le profil altimétrique' : 'Explore the elevation profile'}
              accessibilityHint={locale === 'fr' ? 'Glissez pour consulter la distance et les dénivelés cumulés' : 'Slide to inspect cumulative distance and elevation'}
              accessibilityValue={inspection ? {
                text: `${inspection.distanceKm.toFixed(1)} km, D+ ${formatNumber(inspection.elevationGainM, locale)} m, D- ${formatNumber(inspection.elevationLossM, locale)} m`,
              } : undefined}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => adjustInspection(event.nativeEvent.actionName === 'decrement' ? -1 : 1)}
            />
            {chart.stationPoints.map(({ station, x, y }) => (
              <Pressable
                key={station.id}
                style={[styles.stationHitArea, { left: x - 22, top: y - 22 }]}
                onPress={() => {
                  setInspectedDistanceKm(station.km);
                  setSelectedStationId((current) => current === station.id ? null : station.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${locale === 'fr' ? 'Ravitaillement' : 'Aid station'} ${station.name}, ${station.km} km`}
                accessibilityHint={locale === 'fr' ? 'Affiche le détail du ravitaillement' : 'Shows aid station details'}
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
        <View style={[styles.stationDetail, expanded && styles.stationDetailExpanded, { borderColor: accentColor }]} accessibilityLiveRegion="polite">
          <View style={styles.stationDetailHeader}>
            <View style={[styles.stationDetailIcon, { backgroundColor: accentColor }]}>
              <Ionicons name="water" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.stationDetailTitleWrap}>
              <Text style={styles.stationDetailEyebrow}>{locale === 'fr' ? 'Ravitaillement' : 'Aid station'}</Text>
              <Text style={styles.stationDetailTitle}>{selectedStation.name}</Text>
            </View>
            <Pressable
              onPress={() => setSelectedStationId(null)}
              style={styles.closeDetail}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={locale === 'fr' ? 'Fermer le détail' : 'Close details'}
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.stationStats}>
            <View style={styles.stationStat}>
              <Text style={styles.stationStatLabel}>{locale === 'fr' ? 'Distance cumulée' : 'Distance'}</Text>
              <DataText style={styles.stationStatValue}>
                {selectedStation.km.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 })} km
              </DataText>
            </View>
            <View style={styles.stationStat}>
              <Text style={styles.stationStatLabel}>{locale === 'fr' ? 'D+ cumulé' : 'Gain so far'}</Text>
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
              selectedStation.organizerDetails.cutoffTime ? `${locale === 'fr' ? 'Barrière' : 'Cutoff'} ${selectedStation.organizerDetails.cutoffTime}` : null,
            ].filter(Boolean);
            return details.length > 0 ? <Text style={styles.stationDetailMeta}>{details.join(' · ')}</Text> : null;
          })()}
          {!expanded && (selectedStation.organizerDetails.organizerNote ?? selectedStation.notes) ? (
            <Text style={styles.stationDetailNote}>{selectedStation.organizerDetails.organizerNote ?? selectedStation.notes}</Text>
          ) : null}
        </View>
      ) : inspection ? (
        <View style={styles.metricsRow} accessibilityLiveRegion="polite">
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{locale === 'fr' ? 'Distance cumulée' : 'Distance'}</Text>
            <DataText style={styles.metricValue}>{inspection.distanceKm.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 })} km</DataText>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{locale === 'fr' ? 'D+ cumulé' : 'Gain so far'}</Text>
            <DataText style={styles.metricValue}>{formatNumber(inspection.elevationGainM, locale)} m</DataText>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{locale === 'fr' ? 'D- cumulé' : 'Loss so far'}</Text>
            <DataText style={styles.metricValue}>{formatNumber(inspection.elevationLossM, locale)} m</DataText>
          </View>
        </View>
      ) : null}

      {isPartialProfile && !expanded ? (
        <View style={styles.coverageNotice} accessibilityRole="text">
          <Ionicons name="information-circle-outline" size={17} color={Colors.warning} />
          <Text style={styles.coverageNoticeText}>
            {locale === 'fr'
              ? `Le GPX fourni couvre ${profileDistanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km sur les ${officialDistanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km annoncés.`
              : `The supplied GPX covers ${profileDistanceKm.toLocaleString('en-US', { maximumFractionDigits: 1 })} km of the advertised ${officialDistanceKm.toLocaleString('en-US', { maximumFractionDigits: 1 })} km.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  chart: { width: '100%', overflow: 'hidden', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.62)' },
  chartExpanded: { backgroundColor: Colors.surface },
  inspectionGestureLayer: { position: 'absolute', zIndex: 2, left: AXIS_WIDTH, right: RIGHT_PADDING, top: 0, bottom: BOTTOM_PADDING },
  stationHitArea: { position: 'absolute', zIndex: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stationMarker: { width: 15, height: 15, borderRadius: 8, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  stationMarkerCore: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, minWidth: 68, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  metricLabel: { color: Colors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700', textTransform: 'uppercase' },
  metricValue: { marginTop: 2, color: Colors.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  coverageNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.warningSurface },
  coverageNoticeText: { flex: 1, color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  stationDetail: { padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: Colors.surface, gap: 5 },
  stationDetailExpanded: { paddingVertical: 8, gap: 2 },
  stationDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stationDetailIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stationDetailTitleWrap: { flex: 1, minWidth: 0 },
  stationDetailEyebrow: { color: Colors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700', textTransform: 'uppercase' },
  stationDetailTitle: { color: Colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  closeDetail: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stationStats: { flexDirection: 'row', gap: 8 },
  stationStat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surfaceSecondary },
  stationStatLabel: { color: Colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: '700', textTransform: 'uppercase' },
  stationStatValue: { marginTop: 1, color: Colors.textPrimary, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  stationDetailMeta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  stationDetailNote: { marginTop: 2, paddingTop: 7, borderTopWidth: 1, borderTopColor: Colors.border, color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
});

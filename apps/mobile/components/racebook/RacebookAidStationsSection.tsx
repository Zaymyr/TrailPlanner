import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { RacebookAidStation } from '../../lib/racebook';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export type RacebookAidStationCopy = {
  sectionTitle: string;
  emptyMessage: string;
  aidProducts: string;
  aidWater: string;
  aidFood: string;
  aidAssistance: string;
  aidDropBag: string;
  aidDistance: string;
  aidElevationGain: string;
  aidElevationLoss: string;
  aidCutoffTime: string;
  aidFromStart: string;
  aidFromPrevious: string;
  startTimeLabel: string;
  startLabel: string;
  finishLabel: string;
};

type RacebookAidStationsSectionProps = {
  stations: RacebookAidStation[];
  startTime: string | null;
  finish: {
    label: string;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number | null;
    cutoffTime: string | null;
  };
  expandedStationId: string | null;
  showOfficialProducts: boolean;
  theme: ResolvedRacebookTheme;
  copy: RacebookAidStationCopy;
  onToggleStation: (station: RacebookAidStation) => void;
};

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function formatStationDistance(km: number) {
  return `${formatDistance(km)} km`;
}

function ProductList({ values, theme }: { values: string[]; theme: ResolvedRacebookTheme }) {
  return (
    <View style={styles.productList}>
      {values.map((value, index) => (
        <View key={`${value}-${index}`} style={styles.productRow}>
          <View style={[styles.productDot, { backgroundColor: theme.primaryColor }]} />
          <Text numberOfLines={2} style={styles.productText}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ServiceIcon({ icon, label, theme }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  theme: ResolvedRacebookTheme;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.serviceIcon,
        {
          backgroundColor: theme.primarySurfaceColor,
          borderColor: theme.primaryBorderColor,
        },
      ]}
    >
      <Ionicons color={theme.primaryColor} name={icon} size={14} />
    </View>
  );
}

function AidStationCard({
  station,
  position,
  isFinish = false,
  finishCutoffTime,
  copy,
  expanded,
  onToggle,
  theme,
}: {
  station: RacebookAidStation;
  position: number;
  isFinish?: boolean;
  finishCutoffTime?: string | null;
  expanded: boolean;
  onToggle: () => void;
  theme: ResolvedRacebookTheme;
  copy: Omit<RacebookAidStationCopy, 'sectionTitle' | 'emptyMessage'>;
}) {
  const cutoffTime = finishCutoffTime ?? station.organizerDetails.cutoffTime;
  const serviceItems = [
    station.waterAvailable ? { icon: 'water-outline' as const, label: copy.aidWater } : null,
    station.solidAvailable ? { icon: 'restaurant-outline' as const, label: copy.aidFood } : null,
    station.assistanceAllowed ? { icon: 'people-outline' as const, label: copy.aidAssistance } : null,
    station.organizerDetails.dropBagAvailable
      ? { icon: 'briefcase-outline' as const, label: copy.aidDropBag }
      : null,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const hasExpandedDetails = station.products.length > 0 || Boolean(
    station.organizerDetails.organizerNote || station.notes,
  );

  return (
    <View style={styles.aidStationCard}>
      <Pressable
        accessibilityRole={hasExpandedDetails ? 'button' : undefined}
        accessibilityLabel={[
          isFinish ? copy.finishLabel : `R${position}`,
          station.name,
          formatStationDistance(station.km),
          ...serviceItems.map((item) => item.label),
          cutoffTime
            ? `${copy.aidCutoffTime} ${cutoffTime}`
            : null,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={hasExpandedDetails ? { expanded } : undefined}
        onPress={hasExpandedDetails ? onToggle : undefined}
        style={({ pressed }) => [
          styles.aidStationSummary,
          pressed ? { backgroundColor: theme.primarySurfaceColor } : null,
        ]}
      >
        <View style={styles.aidStationSummaryMain}>
          <View style={styles.aidStationTitleRow}>
            <Text numberOfLines={1} style={styles.aidStationName}>
              {station.name}
            </Text>
          </View>

          {serviceItems.length > 0 || cutoffTime ? (
            <View style={styles.aidStationSummaryMeta}>
              {serviceItems.length > 0 ? (
                <View style={styles.serviceRow}>
                  {serviceItems.map((item) => (
                    <ServiceIcon
                      key={`${station.id}-${item.label}`}
                      icon={item.icon}
                      label={item.label}
                      theme={theme}
                    />
                  ))}
                </View>
              ) : null}

              {cutoffTime ? (
                <View style={styles.cutoffSummary}>
                  <Ionicons color={Colors.danger} name="time-outline" size={13} />
                  <DataText numberOfLines={1} style={styles.cutoffSummaryText}>
                    {copy.aidCutoffTime} {cutoffTime}
                  </DataText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.aidStationSummaryAction}>
          <DataText style={styles.aidStationSummaryDistance}>
            {formatStationDistance(station.km)}
          </DataText>
          {hasExpandedDetails ? (
            <Ionicons
              color={Colors.textSecondary}
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
            />
          ) : null}
        </View>
      </Pressable>

      {expanded && hasExpandedDetails ? (
        <View style={styles.aidStationExpandedContent}>
          {station.products.length > 0 ? (
            <View style={styles.inlineBlock}>
              <Text style={styles.inlineBlockTitle}>{copy.aidProducts}</Text>
              <ProductList
                theme={theme}
                values={station.products.map((product) => product.label)}
              />
            </View>
          ) : null}

          {station.organizerDetails.organizerNote || station.notes ? (
            <View style={styles.noteRow}>
              <Ionicons
                color={Colors.textSecondary}
                name="information-circle-outline"
                size={18}
              />
              <Text style={styles.noteText}>
                {station.organizerDetails.organizerNote ?? station.notes}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function EndpointCard({
  label,
  distanceKm,
  time,
}: {
  label: string;
  distanceKm: number;
  time?: {
    label: string;
    value: string;
    tone: 'positive' | 'critical';
  } | null;
}) {
  return (
    <View accessible accessibilityLabel={[label, formatStationDistance(distanceKm), time ? `${time.label} ${time.value}` : null].filter(Boolean).join(', ')} style={styles.aidStationCard}>
      <View style={styles.aidStationSummary}>
        <View style={styles.aidStationSummaryMain}>
          <Text numberOfLines={2} style={styles.aidStationName}>{label}</Text>
          {time ? (
            <View style={styles.endpointTimeRow}>
              <Ionicons
                color={time.tone === 'critical' ? Colors.danger : Colors.success}
                name="time-outline"
                size={14}
              />
              <Text numberOfLines={1} style={styles.endpointTimeLabel}>{time.label}</Text>
              <DataText
                numberOfLines={1}
                style={[
                  styles.endpointTimeValue,
                  time.tone === 'critical' ? styles.endpointTimeValueCritical : null,
                ]}
              >
                {time.value}
              </DataText>
            </View>
          ) : null}
        </View>
        <DataText style={styles.aidStationSummaryDistance}>{formatStationDistance(distanceKm)}</DataText>
      </View>
    </View>
  );
}

function getSegmentElevation(
  currentValue: number | null,
  previousValue: number | null | undefined,
  hasPrevious: boolean,
) {
  if (currentValue === null) return null;
  if (hasPrevious && previousValue == null) return null;
  return Math.max(0, Math.round(currentValue - (previousValue ?? 0)));
}

function SegmentConnector({
  targetKm,
  targetElevationGainM,
  targetElevationLossM,
  previousStation,
  segmentLabel,
  elevationGainLabel,
  elevationLossLabel,
  theme,
}: {
  targetKm: number;
  targetElevationGainM: number | null;
  targetElevationLossM: number | null;
  previousStation?: RacebookAidStation;
  segmentLabel: string;
  elevationGainLabel: string;
  elevationLossLabel: string;
  theme: ResolvedRacebookTheme;
}) {
  const segmentDistance = Math.max(0, targetKm - (previousStation?.km ?? 0));
  const segmentGain = getSegmentElevation(
    targetElevationGainM,
    previousStation?.organizerDetails.cumulativeElevationGainM,
    Boolean(previousStation),
  );
  const segmentLoss = getSegmentElevation(
    targetElevationLossM,
    previousStation?.organizerDetails.cumulativeElevationLossM,
    Boolean(previousStation),
  );

  return (
    <View
      accessible
      accessibilityLabel={[
        segmentLabel,
        formatStationDistance(segmentDistance),
        segmentGain !== null ? `${elevationGainLabel} ${segmentGain} m` : null,
        segmentLoss !== null ? `${elevationLossLabel} ${segmentLoss} m` : null,
      ].filter(Boolean).join(', ')}
      style={styles.segmentRow}
    >
      <View style={styles.segmentRail}>
        <View
          style={[
            styles.timelineLine,
            styles.timelineLineFull,
            { backgroundColor: theme.accentBorderColor },
          ]}
        />
        <View
          style={[
            styles.directionMarker,
            {
              backgroundColor: theme.accentSurfaceColor,
              borderColor: theme.accentBorderColor,
            },
          ]}
        >
          <Ionicons color={theme.accentGraphicColor} name="arrow-down" size={13} />
        </View>
      </View>

      <View
        style={[
          styles.segmentSummary,
          {
            backgroundColor: theme.accentSurfaceColor,
            borderColor: theme.accentBorderColor,
          },
        ]}
      >
        <Text numberOfLines={1} style={[styles.segmentLabel, { color: theme.accentForegroundColor }]}>
          {segmentLabel}
        </Text>
        <View style={styles.segmentMetrics}>
          <View style={styles.segmentMetricItem}>
            <Ionicons color={Colors.textSecondary} name="resize-outline" size={13} />
            <DataText style={styles.segmentMetric}>{formatStationDistance(segmentDistance)}</DataText>
          </View>
          {segmentGain !== null ? (
            <View style={styles.segmentMetricItem}>
              <Ionicons color={Colors.textSecondary} name="trending-up-outline" size={13} />
              <DataText style={styles.segmentMetric}>
                {elevationGainLabel} {segmentGain} m
              </DataText>
            </View>
          ) : null}
          {segmentLoss !== null ? (
            <View style={styles.segmentMetricItem}>
              <Ionicons color={Colors.textSecondary} name="trending-down-outline" size={13} />
              <DataText style={styles.segmentMetric}>
                {elevationLossLabel} {segmentLoss} m
              </DataText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function RacebookAidStationsSection({
  stations,
  startTime,
  finish,
  expandedStationId,
  showOfficialProducts,
  theme,
  copy,
  onToggleStation,
}: RacebookAidStationsSectionProps) {
  const lastStation = stations[stations.length - 1];
  const finishStation = lastStation && Math.abs(lastStation.km - finish.distanceKm) <= 0.2
    ? lastStation
    : null;
  const aidStations = finishStation ? stations.slice(0, -1) : stations;
  const previousStation = aidStations[aidStations.length - 1];
  const finishSegmentLabel = previousStation
    ? copy.aidFromPrevious.replace('{name}', previousStation.name)
    : copy.aidFromStart;

  return (
    <View style={styles.aidStationsWrap}>
      <View style={styles.timelineEndpointRow}>
        <View style={styles.timelineEndpointCard}>
          <EndpointCard
            label={copy.startLabel}
            distanceKm={0}
            time={startTime ? { label: copy.startTimeLabel, value: startTime, tone: 'positive' } : null}
          />
        </View>
      </View>
      {aidStations.length === 0 && !finishStation ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
        </View>
      ) : null}
      {aidStations.map((station, index) => {
        const previousStation = index > 0 ? stations[index - 1] : undefined;
        const segmentLabel = previousStation
          ? copy.aidFromPrevious.replace('{name}', previousStation.name)
          : copy.aidFromStart;

        return (
          <View key={station.id}>
            <SegmentConnector
              targetKm={station.km}
              targetElevationGainM={station.organizerDetails.cumulativeElevationGainM}
              targetElevationLossM={station.organizerDetails.cumulativeElevationLossM}
              previousStation={previousStation}
              segmentLabel={segmentLabel}
              elevationGainLabel={copy.aidElevationGain}
              elevationLossLabel={copy.aidElevationLoss}
              theme={theme}
            />
            <View style={styles.timelineStationRow}>
              <View style={styles.stationRail}>
                <View
                  style={[
                    styles.timelineLine,
                    styles.timelineLineFull,
                    { backgroundColor: theme.accentBorderColor },
                  ]}
                />
                <View
                  style={[
                    styles.stationIndex,
                    {
                      backgroundColor: theme.primarySurfaceColor,
                      borderColor: theme.primaryBorderColor,
                    },
                  ]}
                >
                  <DataText style={[styles.stationIndexText, { color: theme.primaryColor }]}>R{index + 1}</DataText>
                </View>
              </View>
              <View style={styles.timelineCard}>
                <AidStationCard
                  station={showOfficialProducts ? station : { ...station, products: [] }}
                  position={index + 1}
                  expanded={expandedStationId === station.id}
                  onToggle={() => onToggleStation(station)}
                  theme={theme}
                  copy={copy}
                />
              </View>
            </View>
          </View>
        );
      })}
      <SegmentConnector
        targetKm={finish.distanceKm}
        targetElevationGainM={finish.elevationGainM}
        targetElevationLossM={finish.elevationLossM}
        previousStation={previousStation}
        segmentLabel={finishSegmentLabel}
        elevationGainLabel={copy.aidElevationGain}
        elevationLossLabel={copy.aidElevationLoss}
        theme={theme}
      />
      <View style={styles.timelineEndpointRow}>
        <View style={styles.timelineEndpointCard}>
          {finishStation ? (
            <AidStationCard
              station={showOfficialProducts ? finishStation : { ...finishStation, products: [] }}
              position={aidStations.length + 1}
              isFinish
              finishCutoffTime={finish.cutoffTime}
              expanded={expandedStationId === finishStation.id}
              onToggle={() => onToggleStation(finishStation)}
              theme={theme}
              copy={copy}
            />
          ) : (
            <EndpointCard
              label={finish.label}
              distanceKm={finish.distanceKm}
              time={finish.cutoffTime ? {
                label: copy.aidCutoffTime,
                value: finish.cutoffTime,
                tone: 'critical',
              } : null}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  aidStationsWrap: { gap: 0 },
  timelineStationRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineCard: { flex: 1 },
  timelineEndpointRow: { width: '100%' },
  timelineEndpointCard: { width: '100%' },
  stationRail: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  segmentRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 62 },
  segmentRail: { width: 42, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { position: 'absolute', left: 20, width: 2 },
  timelineLineFull: { top: 0, bottom: 0 },
  directionMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  aidStationCard: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aidStationSummary: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aidStationSummaryMain: { flex: 1, gap: 7 },
  aidStationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stationIndex: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 2,
  },
  stationIndexText: { fontSize: 11, fontWeight: '800' },
  aidStationName: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  aidStationSummaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
  },
  cutoffSummary: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cutoffSummaryText: { color: Colors.danger, fontSize: 11, fontWeight: '700' },
  endpointTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  endpointTimeLabel: { flexShrink: 1, color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  endpointTimeValue: { color: Colors.success, fontSize: 12, fontWeight: '800' },
  endpointTimeValueCritical: { color: Colors.danger },
  aidStationSummaryAction: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aidStationSummaryDistance: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  aidStationExpandedContent: {
    padding: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  segmentSummary: {
    flex: 1,
    alignSelf: 'center',
    marginLeft: 14,
    marginVertical: 8,
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  segmentLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  segmentMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  segmentMetricItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segmentMetric: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  inlineBlock: { gap: 8 },
  inlineBlockTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  productList: { gap: 7 },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  productDot: { width: 6, height: 6, marginTop: 7, borderRadius: 3 },
  productText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
});

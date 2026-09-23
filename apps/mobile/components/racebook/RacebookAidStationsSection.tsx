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
};

type RacebookAidStationsSectionProps = {
  stations: RacebookAidStation[];
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
  previousStation,
  position,
  copy,
  expanded,
  onToggle,
  theme,
}: {
  station: RacebookAidStation;
  previousStation?: RacebookAidStation;
  position: number;
  expanded: boolean;
  onToggle: () => void;
  theme: ResolvedRacebookTheme;
  copy: Omit<RacebookAidStationCopy, 'sectionTitle' | 'emptyMessage'>;
}) {
  const serviceItems = [
    station.waterAvailable ? { icon: 'water-outline' as const, label: copy.aidWater } : null,
    station.solidAvailable ? { icon: 'restaurant-outline' as const, label: copy.aidFood } : null,
    station.assistanceAllowed ? { icon: 'people-outline' as const, label: copy.aidAssistance } : null,
    station.organizerDetails.dropBagAvailable
      ? { icon: 'briefcase-outline' as const, label: copy.aidDropBag }
      : null,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const segmentGain = (() => {
    if (station.organizerDetails.cumulativeElevationGainM === null) return null;
    if (!previousStation || previousStation.organizerDetails.cumulativeElevationGainM === null) {
      return Math.round(station.organizerDetails.cumulativeElevationGainM);
    }
    return Math.round(
      station.organizerDetails.cumulativeElevationGainM -
        previousStation.organizerDetails.cumulativeElevationGainM,
    );
  })();

  const segmentLoss = (() => {
    if (station.organizerDetails.cumulativeElevationLossM === null) return null;
    if (!previousStation || previousStation.organizerDetails.cumulativeElevationLossM === null) {
      return Math.round(station.organizerDetails.cumulativeElevationLossM);
    }
    return Math.round(
      station.organizerDetails.cumulativeElevationLossM -
        previousStation.organizerDetails.cumulativeElevationLossM,
    );
  })();

  const segmentDistance = Math.max(0, station.km - (previousStation?.km ?? 0));
  const segmentLabel = previousStation
    ? copy.aidFromPrevious.replace('{name}', previousStation.name)
    : copy.aidFromStart;

  return (
    <View style={styles.aidStationCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          `R${position}`,
          station.name,
          formatStationDistance(station.km),
          ...serviceItems.map((item) => item.label),
          station.organizerDetails.cutoffTime
            ? `${copy.aidCutoffTime} ${station.organizerDetails.cutoffTime}`
            : null,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.aidStationSummary,
          pressed ? { backgroundColor: theme.primarySurfaceColor } : null,
        ]}
      >
        <View style={styles.aidStationSummaryMain}>
          <View style={styles.aidStationTitleRow}>
            <View
              style={[
                styles.stationIndex,
                {
                  backgroundColor: theme.primarySurfaceColor,
                  borderColor: theme.primaryBorderColor,
                },
              ]}
            >
              <DataText style={[styles.stationIndexText, { color: theme.primaryColor }]}>R{position}</DataText>
            </View>
            <Text numberOfLines={1} style={styles.aidStationName}>
              {station.name}
            </Text>
          </View>

          {serviceItems.length > 0 || station.organizerDetails.cutoffTime ? (
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

              {station.organizerDetails.cutoffTime ? (
                <View style={styles.cutoffSummary}>
                  <Ionicons color={Colors.danger} name="time-outline" size={13} />
                  <DataText numberOfLines={1} style={styles.cutoffSummaryText}>
                    {copy.aidCutoffTime} {station.organizerDetails.cutoffTime}
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
          <Ionicons
            color={Colors.textSecondary}
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.aidStationExpandedContent}>
          <View style={styles.segmentSummary}>
            <Text numberOfLines={1} style={styles.segmentLabel}>
              {segmentLabel}
            </Text>
            <View style={styles.segmentMetrics}>
              <DataText style={styles.segmentMetric}>{formatStationDistance(segmentDistance)}</DataText>
              {segmentGain !== null ? (
                <DataText style={styles.segmentMetric}>
                  {copy.aidElevationGain} {segmentGain} m
                </DataText>
              ) : null}
              {segmentLoss !== null ? (
                <DataText style={styles.segmentMetric}>
                  {copy.aidElevationLoss} {segmentLoss} m
                </DataText>
              ) : null}
            </View>
          </View>

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

export function RacebookAidStationsSection({
  stations,
  expandedStationId,
  showOfficialProducts,
  theme,
  copy,
  onToggleStation,
}: RacebookAidStationsSectionProps) {
  if (stations.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.aidStationsWrap}>
      {stations.map((station, index) => (
        <AidStationCard
          key={station.id}
          station={showOfficialProducts ? station : { ...station, products: [] }}
          previousStation={index > 0 ? stations[index - 1] : undefined}
          position={index + 1}
          expanded={expandedStationId === station.id}
          onToggle={() => onToggleStation(station)}
          theme={theme}
          copy={copy}
        />
      ))}
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
  aidStationsWrap: { gap: 10 },
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
    minWidth: 32,
    height: 26,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
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
  aidStationSummaryAction: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aidStationSummaryDistance: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  aidStationExpandedContent: {
    padding: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  segmentSummary: {
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  segmentLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  segmentMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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

import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RacebookAidStation } from '../../lib/racebook';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type MetricItem = {
  label: string;
  value: string;
  tone?: 'neutral' | 'gain' | 'loss';
};

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

function ChipRow({ values, theme }: { values: string[]; theme: ResolvedRacebookTheme }) {
  return (
    <View style={styles.chipRow}>
      {values.map((value) => (
        <View key={value} style={[styles.chip, { backgroundColor: theme.primarySurfaceColor, borderColor: theme.primaryBorderColor }]}>
          <Text style={[styles.chipText, { color: theme.primaryColor }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ServiceIconButton({
  icon,
  label,
  active,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ResolvedRacebookTheme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: active }}
      hitSlop={4}
      onPress={onPress}
      style={[
        styles.serviceIconButton,
        { backgroundColor: theme.primarySurfaceColor, borderColor: theme.primaryBorderColor },
        active ? styles.serviceIconButtonActive : null,
        active ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor } : null,
      ]}
    >
      <Ionicons name={icon} size={17} color={active ? theme.onPrimaryColor : theme.primaryColor} />
    </Pressable>
  );
}

function AidStationCard({
  station,
  previousStation,
  copy,
  expanded,
  onToggle,
  theme,
}: {
  station: RacebookAidStation;
  previousStation?: RacebookAidStation;
  expanded: boolean;
  onToggle: () => void;
  theme: ResolvedRacebookTheme;
  copy: Omit<RacebookAidStationCopy, 'sectionTitle' | 'emptyMessage'>;
}) {
  const [activeServiceLabel, setActiveServiceLabel] = useState<string | null>(null);
  const serviceItems = [
    station.waterAvailable ? { icon: 'water-outline' as const, label: copy.aidWater } : null,
    station.solidAvailable ? { icon: 'restaurant-outline' as const, label: copy.aidFood } : null,
    station.assistanceAllowed ? { icon: 'people-outline' as const, label: copy.aidAssistance } : null,
    station.organizerDetails.dropBagAvailable ? { icon: 'briefcase-outline' as const, label: copy.aidDropBag } : null,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const segmentGain = (() => {
    if (station.organizerDetails.cumulativeElevationGainM === null) return null;
    if (!previousStation || previousStation.organizerDetails.cumulativeElevationGainM === null) {
      return Math.round(station.organizerDetails.cumulativeElevationGainM);
    }
    return Math.round(station.organizerDetails.cumulativeElevationGainM - previousStation.organizerDetails.cumulativeElevationGainM);
  })();

  const segmentLoss = (() => {
    if (station.organizerDetails.cumulativeElevationLossM === null) return null;
    if (!previousStation || previousStation.organizerDetails.cumulativeElevationLossM === null) {
      return Math.round(station.organizerDetails.cumulativeElevationLossM);
    }
    return Math.round(station.organizerDetails.cumulativeElevationLossM - previousStation.organizerDetails.cumulativeElevationLossM);
  })();

  const metricItems: MetricItem[] = [
    { label: copy.aidDistance, value: formatStationDistance(station.km) },
    ...(segmentGain !== null ? [{ label: copy.aidElevationGain, value: `${segmentGain} m`, tone: 'gain' as const }] : []),
    ...(segmentLoss !== null ? [{ label: copy.aidElevationLoss, value: `${segmentLoss} m`, tone: 'loss' as const }] : []),
    ...(station.organizerDetails.cutoffTime ? [{ label: copy.aidCutoffTime, value: station.organizerDetails.cutoffTime }] : []),
  ];

  useEffect(() => {
    if (!expanded) setActiveServiceLabel(null);
  }, [expanded]);

  const summaryMetrics = metricItems.slice(1);

  return (
    <View style={styles.aidStationCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          station.name,
          formatStationDistance(station.km),
          ...serviceItems.map((item) => item.label),
          ...summaryMetrics.map((item) => `${item.label} ${item.value}`),
        ].join(', ')}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.aidStationSummary,
          pressed ? styles.aidStationSummaryPressed : null,
          pressed ? { backgroundColor: theme.primarySurfaceColor } : null,
        ]}
      >
        <View style={styles.aidStationSummaryMain}>
          <Text style={styles.aidStationName} numberOfLines={1}>{station.name}</Text>
          {serviceItems.length > 0 || summaryMetrics.length > 0 ? (
            <View style={styles.aidStationSummaryMeta}>
              {serviceItems.length > 0 ? (
                <View style={styles.serviceSummaryRow}>
                  {serviceItems.map((item) => (
                    <View key={`${station.id}-summary-${item.label}`} style={[styles.serviceSummaryIcon, { backgroundColor: theme.primarySurfaceColor, borderColor: theme.primaryBorderColor }]}>
                      <Ionicons name={item.icon} size={13} color={theme.primaryColor} />
                    </View>
                  ))}
                </View>
              ) : null}
              {summaryMetrics.map((item) => (
                <DataText
                  key={`${station.id}-summary-${item.label}`}
                  numberOfLines={1}
                  style={[
                    styles.aidStationSummaryMetric,
                    item.tone === 'gain' ? styles.segmentGainText : null,
                    item.tone === 'loss' ? styles.segmentLossText : null,
                  ]}
                >
                  {item.label} {item.value}
                </DataText>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.aidStationSummaryAction}>
          <DataText style={styles.aidStationSummaryDistance}>{formatStationDistance(station.km)}</DataText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.aidStationExpandedContent}>
          <View style={styles.aidStationLayout}>
            <View style={styles.aidStationMainColumn}>
              {serviceItems.length > 0 ? (
                <View style={styles.serviceInfoGroup}>
                  <View style={styles.serviceIconRow}>
                    {serviceItems.map((item) => (
                      <ServiceIconButton
                        key={`${station.id}-${item.label}`}
                        icon={item.icon}
                        label={item.label}
                        active={activeServiceLabel === item.label}
                        onPress={() => setActiveServiceLabel((current) => (current === item.label ? null : item.label))}
                        theme={theme}
                      />
                    ))}
                  </View>
                  {activeServiceLabel ? (
                    <View style={styles.serviceTooltip} accessibilityLiveRegion="polite">
                      <Text style={styles.serviceTooltipText}>{activeServiceLabel}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {station.products.length > 0 ? (
                <View style={styles.inlineBlock}>
                  <Text style={styles.inlineBlockTitle}>{copy.aidProducts}</Text>
                  <ChipRow values={station.products.map((product) => product.label)} theme={theme} />
                </View>
              ) : null}

              {station.organizerDetails.organizerNote || station.notes ? (
                <Text style={styles.noteText}>{station.organizerDetails.organizerNote ?? station.notes}</Text>
              ) : null}
            </View>

            <View style={styles.aidStationMetricsColumn}>
              {metricItems.map((item) => (
                <View key={`${station.id}-${item.label}`} style={styles.metricRow}>
                  <Text style={styles.metricLabel} numberOfLines={1}>{item.label}</Text>
                  <DataText
                    numberOfLines={1}
                    style={[
                      styles.metricValue,
                      item.tone === 'gain' ? styles.segmentGainText : null,
                      item.tone === 'loss' ? styles.segmentLossText : null,
                    ]}
                  >
                    {item.value}
                  </DataText>
                </View>
              ))}
            </View>
          </View>
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
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{copy.sectionTitle}</Text>
      {stations.length > 0 ? (
        <View style={styles.aidStationsWrap}>
          {stations.map((station, index) => (
            <AidStationCard
              key={station.id}
              station={showOfficialProducts ? station : { ...station, products: [] }}
              previousStation={index > 0 ? stations[index - 1] : undefined}
              expanded={expandedStationId === station.id}
              onToggle={() => onToggleStation(station)}
              theme={theme}
              copy={copy}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionCard: { gap: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  aidStationsWrap: { gap: 12 },
  aidStationCard: { borderRadius: 16, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  aidStationSummary: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aidStationSummaryPressed: { backgroundColor: Colors.brandSurface },
  aidStationSummaryMain: { flex: 1, gap: 7 },
  aidStationSummaryMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  aidStationSummaryAction: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aidStationSummaryDistance: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  aidStationSummaryMetric: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  aidStationExpandedContent: { padding: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  aidStationLayout: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  aidStationMainColumn: { flex: 1, gap: 10 },
  aidStationName: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  aidStationMetricsColumn: { width: 104, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: Colors.border, gap: 8 },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 5 },
  metricLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  metricValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  serviceInfoGroup: { alignItems: 'flex-start', gap: 6 },
  serviceIconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  serviceSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceSummaryIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  serviceIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  serviceIconButtonActive: { backgroundColor: Colors.brandPrimary, borderColor: Colors.brandPrimary },
  serviceTooltip: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderStrong },
  serviceTooltipText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  chipText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '700' },
  inlineBlock: { gap: 8 },
  inlineBlockTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  segmentGainText: { color: Colors.danger },
  segmentLossText: { color: '#2563EB' },
  noteText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
});

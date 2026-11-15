import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { formatCoteUnit, splitCoteLabel } from '../../lib/trailSignature';

export type RaceWorkspaceMetric = { label: string; value: string };

/**
 * Height of the toolbar row that holds the back and trailing actions. The
 * expanded content always starts below it, so no text can sit under a button.
 * Buttons are 44 dp tall and placed 8 dp below the safe area in both the
 * expanded and the compact header.
 */
export const RACE_WORKSPACE_TOOLBAR_HEIGHT = 56;
export const RACE_WORKSPACE_ACTION_TOP_OFFSET = 8;
export const RACE_WORKSPACE_COMPACT_BODY_HEIGHT = 60;

export function RaceWorkspaceCompactIdentity({
  title,
  courseName,
  startLabel,
  startTime,
  color,
}: {
  title: string;
  courseName?: string | null;
  startLabel: string;
  startTime?: string | null;
  color: string;
}) {
  const detail = [courseName && courseName !== title ? courseName : null, startTime ? `${startLabel} ${startTime}` : null]
    .filter(Boolean)
    .join(' · ');
  return <View style={styles.compactCopy}>
    <Text numberOfLines={1} style={[styles.compactTitle, { color }]}>{title}</Text>
    {detail ? <Text numberOfLines={1} style={[styles.compactDetail, { color }]}>{detail}</Text> : null}
  </View>;
}

/**
 * Shared expanded content of the RaceBook and plan workspace headers. Both
 * screens render the same elements in the same order and at the same
 * positions; screen-specific content goes in `footer`, after the metrics.
 */
export function RaceWorkspaceCommonBlock({
  title,
  courseName,
  dateLabel,
  locationLabel,
  startLabel,
  startTime,
  maxTimeLabel,
  maxTime,
  metrics,
  color,
  footer,
}: {
  title: string;
  courseName?: string | null;
  dateLabel?: string | null;
  locationLabel?: string | null;
  startLabel: string;
  startTime?: string | null;
  maxTimeLabel: string;
  maxTime?: string | null;
  metrics: RaceWorkspaceMetric[];
  color: string;
  footer?: ReactNode;
}) {
  const informationLine = [dateLabel, locationLabel].filter(Boolean).join(' · ');
  const startLine = startTime ? `${startLabel} ${startTime}${maxTime ? ` · ${maxTimeLabel} ${maxTime}` : ''}` : null;

  return <View style={styles.block}>
    <View style={styles.identity}>
      {courseName && courseName !== title ? <Text numberOfLines={1} style={[styles.kicker, { color }]}>{courseName}</Text> : null}
      <Text
        accessibilityRole="header"
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={2}
        style={[styles.title, { color }]}
      >
        {title}
      </Text>
    </View>
    {informationLine || startLine ? <View style={styles.information}>
      {informationLine ? <View style={styles.infoItem}>
        <Ionicons color={color} name="calendar-outline" size={15} />
        <Text numberOfLines={1} style={[styles.infoText, { color }]}>{informationLine}</Text>
      </View> : null}
      {startLine ? <View style={styles.infoItem}>
        <Ionicons color={color} name="time-outline" size={15} />
        <Text numberOfLines={1} style={[styles.infoText, styles.startText, { color }]}>{startLine}</Text>
      </View> : null}
    </View> : null}
    <View style={styles.metrics}>
      {metrics.map((metric, index) => <View
        key={metric.label}
        style={[styles.metric, index > 0 && styles.metricDivider]}
      >
        <MetricCote color={color} value={metric.value} />
        <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.metricLabel, { color }]}>{metric.label}</Text>
      </View>)}
    </View>
    {footer ?? null}
  </View>;
}

/** Map-style cote: bold figure with its unit in compact spaced capitals. */
function MetricCote({ value, color }: { value: string; color: string }) {
  const parts = splitCoteLabel(value);
  return (
    <DataText adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={[styles.metricValue, { color }]}>
      {parts.value}
      {parts.unit ? <DataText style={[styles.metricUnit, { color }]}>{` ${formatCoteUnit(parts.unit)}`}</DataText> : null}
    </DataText>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  compactCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  compactTitle: { fontSize: 17, lineHeight: 21, fontWeight: '800' },
  compactDetail: { fontSize: 11, lineHeight: 14, fontWeight: '700', opacity: 0.82 },
  identity: { minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', opacity: 0.8 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800', textAlign: 'left' },
  information: { gap: 4 },
  infoItem: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', opacity: 0.9 },
  startText: { fontWeight: '700', opacity: 1 },
  metrics: { minHeight: 56, flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.18)', overflow: 'hidden' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: 4, paddingVertical: 8 },
  metricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.3)' },
  metricValue: { fontSize: 15, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  metricUnit: { fontSize: 10, fontWeight: '600', letterSpacing: 0.9, opacity: 0.86 },
  metricLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'center', opacity: 0.78 },
});

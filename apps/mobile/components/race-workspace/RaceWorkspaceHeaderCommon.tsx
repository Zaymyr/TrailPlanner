import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export type RaceWorkspaceMetric = { label: string; value: string };

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

export function RaceWorkspaceCommonBlock({
  title,
  courseName,
  dateLabel,
  locationLabel,
  onOpenLocation,
  startLabel,
  startTime,
  maxTimeLabel,
  maxTime,
  metrics,
  color,
}: {
  title: string;
  courseName?: string | null;
  dateLabel?: string | null;
  locationLabel?: string | null;
  onOpenLocation?: () => void;
  startLabel: string;
  startTime?: string | null;
  maxTimeLabel: string;
  maxTime?: string | null;
  metrics: RaceWorkspaceMetric[];
  color: string;
}) {
  const information: Array<{
    icon: 'calendar-outline' | 'location-outline' | 'time-outline';
    value: string;
  }> = [];
  if (dateLabel) information.push({ icon: 'calendar-outline', value: dateLabel });
  if (locationLabel) information.push({ icon: 'location-outline', value: locationLabel });
  if (startTime) information.push({
    icon: 'time-outline',
    value: `${startLabel} ${startTime}${maxTime ? ` · ${maxTimeLabel} ${maxTime}` : ''}`,
  });

  return <View style={styles.block}>
    <View style={styles.identity}>
      {courseName && courseName !== title ? <Text numberOfLines={1} style={[styles.kicker, { color }]}>{courseName}</Text> : null}
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, { color }]}>{title}</Text>
    </View>
    {information.length > 0 ? <View style={styles.information}>
      {information.map((item) => {
        const content = <><Ionicons color={color} name={item.icon} size={14} /><Text numberOfLines={1} style={[styles.infoText, { color }, item.icon === 'location-outline' && onOpenLocation && styles.infoLink]}>{item.value}</Text></>;
        return item.icon === 'location-outline' && onOpenLocation
          ? <Pressable accessibilityRole="link" key={`${item.icon}-${item.value}`} onPress={onOpenLocation} style={styles.infoItem}>{content}</Pressable>
          : <View key={`${item.icon}-${item.value}`} style={styles.infoItem}>{content}</View>;
      })}
    </View> : null}
    <View style={styles.metrics}>
      {metrics.map((metric, index) => <View key={metric.label} style={[styles.metric, index > 0 && { borderLeftColor: color, borderLeftWidth: StyleSheet.hairlineWidth }]}>
        <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.metricLabel, { color }]}>{metric.label}</Text>
        <DataText adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.metricValue, { color }]}>{metric.value}</DataText>
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  compactCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  compactTitle: { fontSize: 17, lineHeight: 21, fontWeight: '800' },
  compactDetail: { fontSize: 10, lineHeight: 13, fontWeight: '700', opacity: 0.82 },
  identity: { minWidth: 0, gap: 1 },
  kicker: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', opacity: 0.84 },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '800', textAlign: 'left' },
  information: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  infoItem: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '700', opacity: 0.88 },
  infoLink: { textDecorationLine: 'underline' },
  metrics: { minHeight: 54, flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.18)', overflow: 'hidden' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 3, paddingVertical: 6, borderLeftColor: 'rgba(255,255,255,0.2)' },
  metricLabel: { fontSize: 8, lineHeight: 10, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', opacity: 0.74 },
  metricValue: { fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
});

import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { emitHelpTutorialRequest } from '../../lib/helpTutorial';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export const PLAN_WORKSPACE_HEADER_BODY_HEIGHT = 184;
export const PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT = 76;

type Metric = { label: string; value: string };
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  scrollY: Animated.Value;
  topInset: number;
  title: string;
  subtitle?: string | null;
  totalTime: string;
  averagePace: string;
  startTime?: string | null;
  metrics: Metric[];
  saveStatus: SaveStatus;
  onBack: () => void;
};

export function PlanWorkspaceHeader({ scrollY, topInset, title, subtitle, totalTime, averagePace, metrics, saveStatus, onBack, startTime }: Props) {
  const { t, locale } = useI18n();
  const startLabel = locale === 'fr' ? 'Départ' : 'Start';
  const [compact, setCompact] = useState(false);
  const expandedHeight = topInset + PLAN_WORKSPACE_HEADER_BODY_HEIGHT;
  const compactHeight = topInset + PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT;
  const collapseDistance = expandedHeight - compactHeight;
  const height = scrollY.interpolate({ inputRange: [0, collapseDistance], outputRange: [expandedHeight, compactHeight], extrapolate: 'clamp' });
  const expandedOpacity = scrollY.interpolate({ inputRange: [0, collapseDistance * 0.6, collapseDistance * 0.9], outputRange: [1, 0.75, 0], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [collapseDistance * 0.68, collapseDistance], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => setCompact(value >= collapseDistance * 0.72));
    return () => scrollY.removeListener(listener);
  }, [collapseDistance, scrollY]);

  const statusLabel = saveStatus === 'saving'
    ? t.common.saving
    : saveStatus === 'saved'
      ? t.planWorkspace.saved
      : saveStatus === 'error'
        ? t.planWorkspace.saveError
        : null;
  const primaryMetrics = [metrics[0], metrics[1], metrics[4]].filter((metric): metric is Metric => Boolean(metric));
  const secondaryMetrics = [metrics[2], metrics[3]].filter((metric): metric is Metric => Boolean(metric));

  return (
    <Animated.View style={[styles.header, { height }]}>
      <StatusBar style="light" />
      <Pressable accessibilityLabel={t.planWorkspace.backToPlans} accessibilityRole="button" onPress={onBack} style={[styles.action, { top: topInset + 8, left: 16 }]}>
        <Ionicons name="chevron-back" size={25} color={Colors.textOnBrand} />
      </Pressable>
      <Pressable accessibilityLabel={t.planWorkspace.openHelp} accessibilityRole="button" onPress={() => emitHelpTutorialRequest('planEdit')} style={[styles.action, { top: topInset + 8, right: 16 }]}>
        <Ionicons name="help-circle-outline" size={23} color={Colors.textOnBrand} />
      </Pressable>

      <Animated.View
        accessibilityElementsHidden={!compact}
        importantForAccessibility={compact ? 'auto' : 'no-hide-descendants'}
        pointerEvents={compact ? 'auto' : 'none'}
        style={[styles.compact, { top: topInset, opacity: compactOpacity }]}
      >
        <View style={styles.compactCopy}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.compactTitle}>{title}</Text>
          <View style={styles.compactMetrics}>
            <View style={styles.compactMetric}>
              <Ionicons name="time-outline" size={13} color={Colors.textOnBrand} />
              <DataText numberOfLines={1} style={styles.compactMeta}>{totalTime}</DataText>
            </View>
            <View style={styles.compactMetricDivider} />
            <View style={styles.compactMetric}>
              <Ionicons name="speedometer-outline" size={13} color={Colors.textOnBrand} />
              <DataText numberOfLines={1} style={styles.compactMeta}>
                {averagePace === '—' ? '—' : `${averagePace}/km`}
              </DataText>
            </View>
          </View>
          {startTime ? <Text style={styles.startTime}>{startLabel} {startTime}</Text> : null}
        </View>
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden={compact}
        importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
        pointerEvents={compact ? 'none' : 'auto'}
        style={[styles.expanded, { paddingTop: topInset + 13, opacity: expandedOpacity }]}
      >
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
          {statusLabel ? (
            <View accessibilityLiveRegion="polite" style={styles.status}>
              <Ionicons name={saveStatus === 'error' ? 'alert-circle' : saveStatus === 'saving' ? 'sync' : 'checkmark-circle'} size={13} color={saveStatus === 'error' ? '#FFD4D4' : Colors.textOnBrand} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          ) : null}
          {startTime ? <View style={styles.startTimeRow}>
            <Ionicons name="flag-outline" size={13} color={Colors.textOnBrand} />
            <Text style={styles.startTime}>{startLabel} {startTime}</Text>
          </View> : null}
        </View>
        <View style={styles.metrics}>
          <View style={styles.primaryMetrics}>
            {primaryMetrics.map((metric, index) => (
              <View key={metric.label} style={[styles.metric, index > 0 && styles.metricBorder]}>
                <Text numberOfLines={1} style={styles.metricLabel}>{metric.label}</Text>
                <DataText numberOfLines={1} style={styles.metricValue}>{metric.value}</DataText>
              </View>
            ))}
          </View>
          <View style={styles.secondaryMetrics}>
            {secondaryMetrics.map((metric) => (
              <View key={metric.label} style={styles.secondaryMetric}>
                <Text numberOfLines={1} style={styles.secondaryMetricLabel}>{metric.label}</Text>
                <DataText numberOfLines={1} style={styles.secondaryMetricValue}>{metric.value}</DataText>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', zIndex: 30, top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: Colors.brandPrimary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#1A1A1A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  action: { position: 'absolute', zIndex: 5, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(0,0,0,0.16)' },
  compact: { position: 'absolute', left: 64, right: 64, height: PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT, justifyContent: 'center' },
  compactCopy: { minWidth: 0, alignItems: 'center', gap: 5 },
  compactTitle: { color: Colors.textOnBrand, fontSize: 17, lineHeight: 21, fontWeight: '800' },
  compactMetrics: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  compactMetric: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactMetricDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.32)' },
  compactMeta: { color: Colors.textOnBrand, fontSize: 12, lineHeight: 16, fontWeight: '800', opacity: 0.92 },
  expanded: { flex: 1, gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  titleBlock: { minHeight: 72, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48, gap: 3 },
  title: { color: Colors.textOnBrand, fontSize: 22, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textOnBrand, fontSize: 13, lineHeight: 17, fontWeight: '600', textAlign: 'center', opacity: 0.86 },
  startTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  startTime: { color: Colors.textOnBrand, fontSize: 12, lineHeight: 16, fontWeight: '700', opacity: 0.92 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { color: Colors.textOnBrand, fontSize: 11, lineHeight: 14, fontWeight: '700', opacity: 0.84 },
  metrics: { minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(0,0,0,0.16)', overflow: 'hidden' },
  primaryMetrics: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 3, paddingVertical: 5 },
  metricBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' },
  metricValue: { color: Colors.textOnBrand, fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  metricLabel: { color: Colors.textOnBrand, fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 0.25, textAlign: 'center', textTransform: 'uppercase', opacity: 0.74 },
  secondaryMetrics: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  secondaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secondaryMetricLabel: { color: Colors.textOnBrand, fontSize: 9, lineHeight: 12, fontWeight: '700', opacity: 0.7 },
  secondaryMetricValue: { color: Colors.textOnBrand, fontSize: 10, lineHeight: 13, fontWeight: '800' },
});

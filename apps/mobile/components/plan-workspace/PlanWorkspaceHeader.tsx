import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { emitHelpTutorialRequest } from '../../lib/helpTutorial';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export const PLAN_WORKSPACE_HEADER_BODY_HEIGHT = 238;
export const PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT = 68;

type Metric = { label: string; value: string };
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  scrollY: Animated.Value;
  topInset: number;
  title: string;
  totalTime: string;
  averagePace: string;
  metrics: Metric[];
  saveStatus: SaveStatus;
  onBack: () => void;
};

export function PlanWorkspaceHeader({ scrollY, topInset, title, totalTime, averagePace, metrics, saveStatus, onBack }: Props) {
  const { t } = useI18n();
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

  return (
    <Animated.View style={[styles.header, { height }]}>
      <Pressable accessibilityLabel={t.planWorkspace.backToPlans} accessibilityRole="button" onPress={onBack} style={[styles.action, styles.backAction, { top: topInset + 8, left: 12 }]}>
        <Ionicons name="chevron-back" size={25} color={Colors.textOnBrand} />
      </Pressable>
      <Pressable accessibilityLabel={t.planWorkspace.openHelp} accessibilityRole="button" onPress={() => emitHelpTutorialRequest('planEdit')} style={[styles.action, { top: topInset + 8, right: 12 }]}>
        <Ionicons name="help-circle-outline" size={23} color={Colors.textOnBrand} />
      </Pressable>

      <Animated.View pointerEvents={compact ? 'auto' : 'none'} style={[styles.compact, { top: topInset, opacity: compactOpacity }]}>
        <View style={styles.compactCopy}>
          <Text numberOfLines={1} style={styles.compactTitle}>{title}</Text>
          <DataText numberOfLines={1} style={styles.compactMeta}>{totalTime} · {averagePace} min/km</DataText>
        </View>
      </Animated.View>

      <Animated.View pointerEvents={compact ? 'none' : 'auto'} style={[styles.expanded, { paddingTop: topInset + 13, opacity: expandedOpacity }]}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          {statusLabel ? (
            <View accessibilityLiveRegion="polite" style={styles.status}>
              <Ionicons name={saveStatus === 'error' ? 'alert-circle' : saveStatus === 'saving' ? 'sync' : 'checkmark-circle'} size={13} color={saveStatus === 'error' ? '#FFD4D4' : Colors.textOnBrand} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metrics}>
          {metrics.map((metric, index) => (
            <View key={metric.label} style={[styles.metric, index > 0 && styles.metricBorder]}>
              <DataText numberOfLines={1} style={styles.metricValue}>{metric.value}</DataText>
              <Text numberOfLines={1} style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', zIndex: 30, top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: Colors.brandPrimary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#1A1A1A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  action: { position: 'absolute', zIndex: 5, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backAction: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(0,0,0,0.16)' },
  compact: { position: 'absolute', left: 64, right: 64, height: PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT, justifyContent: 'center' },
  compactCopy: { minWidth: 0, alignItems: 'center' },
  compactTitle: { color: Colors.textOnBrand, fontSize: 17, lineHeight: 21, fontWeight: '800' },
  compactMeta: { color: Colors.textOnBrand, fontSize: 11, lineHeight: 15, fontWeight: '700', opacity: 0.82 },
  expanded: { flex: 1, gap: 18, paddingHorizontal: 16, paddingBottom: 16 },
  titleBlock: { minHeight: 78, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48, gap: 5 },
  title: { color: Colors.textOnBrand, fontSize: 27, lineHeight: 31, fontWeight: '800', textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { color: Colors.textOnBrand, fontSize: 11, lineHeight: 14, fontWeight: '700', opacity: 0.84 },
  metrics: { minHeight: 82, flexDirection: 'row', alignItems: 'stretch', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(0,0,0,0.16)' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3, paddingVertical: 8 },
  metricBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' },
  metricValue: { color: Colors.textOnBrand, fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  metricLabel: { color: Colors.textOnBrand, fontSize: 8, lineHeight: 11, fontWeight: '700', textAlign: 'center', opacity: 0.74 },
});

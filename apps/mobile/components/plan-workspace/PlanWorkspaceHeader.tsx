import { useCallback, useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { Animated, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';

import { Colors } from '../../constants/colors';
import { emitHelpTutorialRequest } from '../../lib/helpTutorial';
import { useI18n } from '../../lib/i18n';
import {
  RACE_WORKSPACE_ACTION_TOP_OFFSET,
  RACE_WORKSPACE_COMPACT_BODY_HEIGHT,
  RACE_WORKSPACE_TOOLBAR_HEIGHT,
  RaceWorkspaceCommonBlock,
  RaceWorkspaceCompactIdentity,
  type RaceWorkspaceMetric,
} from '../race-workspace/RaceWorkspaceHeaderCommon';
import { Text } from '../themed/Text';

/** Initial expanded height before the content is measured. */
export const PLAN_WORKSPACE_HEADER_BODY_HEIGHT = 236;
export const PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT = RACE_WORKSPACE_COMPACT_BODY_HEIGHT;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type Props = {
  scrollY: Animated.Value;
  topInset: number;
  expandedBodyHeight?: number;
  title: string;
  subtitle?: string | null;
  dateLabel?: string | null;
  locationLabel?: string | null;
  startTime?: string | null;
  maxTime?: string | null;
  metrics: RaceWorkspaceMetric[];
  saveStatus: SaveStatus;
  onBack: () => void;
  onExpandedBodyHeightChange?: (height: number) => void;
};

export function PlanWorkspaceHeader({
  scrollY,
  topInset,
  expandedBodyHeight = PLAN_WORKSPACE_HEADER_BODY_HEIGHT,
  title,
  subtitle,
  dateLabel,
  locationLabel,
  metrics,
  saveStatus,
  onBack,
  onExpandedBodyHeightChange,
  startTime,
  maxTime,
}: Props) {
  const { t } = useI18n();
  const [compact, setCompact] = useState(false);
  const expandedHeight = topInset + expandedBodyHeight;
  const compactHeight = topInset + PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT;
  const collapseDistance = expandedHeight - compactHeight;
  const height = scrollY.interpolate({ inputRange: [0, collapseDistance], outputRange: [expandedHeight, compactHeight], extrapolate: 'clamp' });
  const expandedOpacity = scrollY.interpolate({ inputRange: [0, collapseDistance * 0.6, collapseDistance * 0.9], outputRange: [1, 0.75, 0], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [collapseDistance * 0.68, collapseDistance], outputRange: [0, 1], extrapolate: 'clamp' });
  useEffect(() => { const listener = scrollY.addListener(({ value }) => setCompact(value >= collapseDistance * 0.72)); return () => scrollY.removeListener(listener); }, [collapseDistance, scrollY]);
  const statusLabel = saveStatus === 'saving' ? t.common.saving : saveStatus === 'saved' ? t.planWorkspace.saved : saveStatus === 'error' ? t.planWorkspace.saveError : null;
  const handleExpandedLayout = useCallback((event: LayoutChangeEvent) => {
    onExpandedBodyHeightChange?.(Math.ceil(event.nativeEvent.layout.height - topInset));
  }, [onExpandedBodyHeightChange, topInset]);

  return <Animated.View style={[styles.header, { height }]}>
    <StatusBar style="light" />
    <Pressable accessibilityLabel={t.planWorkspace.backToPlans} accessibilityRole="button" onPress={onBack} style={[styles.action, { top: topInset + RACE_WORKSPACE_ACTION_TOP_OFFSET, left: 16 }]}><Ionicons name="chevron-back" size={25} color={Colors.textOnBrand} /></Pressable>
    <Pressable accessibilityLabel={t.planWorkspace.openHelp} accessibilityRole="button" onPress={() => emitHelpTutorialRequest('planEdit')} style={[styles.action, { top: topInset + RACE_WORKSPACE_ACTION_TOP_OFFSET, right: 16 }]}><Ionicons name="help-circle-outline" size={23} color={Colors.textOnBrand} /></Pressable>
    {statusLabel ? <Animated.View accessibilityLiveRegion="polite" pointerEvents="none" style={[styles.status, { top: topInset + RACE_WORKSPACE_ACTION_TOP_OFFSET, opacity: expandedOpacity }]}>
      <Ionicons name={saveStatus === 'error' ? 'alert-circle' : saveStatus === 'saving' ? 'sync' : 'checkmark-circle'} size={13} color={saveStatus === 'error' ? '#FFD4D4' : Colors.textOnBrand} />
      <Text style={styles.statusText}>{statusLabel}</Text>
    </Animated.View> : null}
    <Animated.View accessibilityElementsHidden={!compact} importantForAccessibility={compact ? 'auto' : 'no-hide-descendants'} pointerEvents={compact ? 'auto' : 'none'} style={[styles.compact, { top: topInset, opacity: compactOpacity }]}>
      <RaceWorkspaceCompactIdentity title={title} courseName={subtitle} startLabel={t.planWorkspace.start} startTime={startTime} color={Colors.textOnBrand} />
    </Animated.View>
    <Animated.View
      accessibilityElementsHidden={compact}
      importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
      onLayout={handleExpandedLayout}
      pointerEvents={compact ? 'none' : 'auto'}
      style={[styles.expanded, { paddingTop: topInset + RACE_WORKSPACE_TOOLBAR_HEIGHT, opacity: expandedOpacity }]}
    >
      <RaceWorkspaceCommonBlock title={title} courseName={subtitle} dateLabel={dateLabel} locationLabel={locationLabel} startLabel={t.planWorkspace.start} startTime={startTime} maxTimeLabel={t.planWorkspace.maximumTime} maxTime={maxTime} metrics={metrics} color={Colors.textOnBrand} />
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', zIndex: 30, top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: Colors.brandPrimary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#1A1A1A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  action: { position: 'absolute', zIndex: 5, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(0,0,0,0.16)' },
  compact: { position: 'absolute', left: 72, right: 72, height: PLAN_WORKSPACE_HEADER_COMPACT_BODY_HEIGHT, justifyContent: 'center' },
  expanded: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 16 },
  status: { position: 'absolute', left: 72, right: 72, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  statusText: { color: Colors.textOnBrand, fontSize: 11, lineHeight: 14, fontWeight: '700', opacity: 0.84 },
});

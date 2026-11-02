import { mobileComponents } from '@pace-yourself/design-system';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { Text } from '../themed/Text';

export const RACE_WORKSPACE_SWITCH_HEIGHT = 54;

type Props = {
  active: 'racebook' | 'plan';
  /** Header background and text colors: the switch reads as part of the header. */
  backgroundColor: string;
  foregroundColor: string;
  compactHeaderHeight: number;
  expandedHeaderHeight: number;
  onOpenPlan: () => void;
  onOpenRacebook: () => void;
  planExists?: boolean;
  planDisabled?: boolean;
  racebookDisabled?: boolean;
  scrollY: Animated.Value;
  topInset: number;
};

/**
 * Livret / plan switch attached under the workspace header. It shares the
 * header color and carries the header's rounded bottom edge, so it reads as
 * the header's own navigation rather than another in-page segmented control.
 */
export function RaceWorkspaceSwitch({
  active,
  backgroundColor,
  foregroundColor,
  compactHeaderHeight,
  expandedHeaderHeight,
  onOpenPlan,
  onOpenRacebook,
  planExists = true,
  planDisabled = false,
  racebookDisabled = false,
  scrollY,
  topInset,
}: Props) {
  const { t } = useI18n();
  const racebookLabel = t.planWorkspace.officialRacebook;
  const planLabel = planExists ? t.catalog.racebookRefinePlan : t.catalog.racebookCreatePlan;
  const collapseDistance = expandedHeaderHeight - compactHeaderHeight;
  const top = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [topInset + expandedHeaderHeight, topInset + compactHeaderHeight],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.shell, { top, backgroundColor }]}>
      <View accessibilityRole="tablist" style={styles.segmentedControl}>
        <Pressable
          accessibilityLabel={racebookLabel}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'racebook', disabled: active === 'racebook' || racebookDisabled }}
          disabled={active === 'racebook' || racebookDisabled}
          onPress={onOpenRacebook}
          style={[styles.segment, active === 'racebook' && styles.activeSegment, racebookDisabled && styles.disabled]}
          testID="race-workspace-racebook"
        >
          <Text numberOfLines={1} style={[styles.label, { color: active === 'racebook' ? backgroundColor : foregroundColor }, active === 'racebook' && styles.activeLabel]}>{racebookLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={planLabel}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'plan', disabled: active === 'plan' || planDisabled }}
          disabled={active === 'plan' || planDisabled}
          onPress={onOpenPlan}
          style={[styles.segment, active === 'plan' && styles.activeSegment, planDisabled && styles.disabled]}
          testID="race-workspace-plan"
        >
          <Text numberOfLines={1} style={[styles.label, { color: active === 'plan' ? backgroundColor : foregroundColor }, active === 'plan' && styles.activeLabel]}>{planLabel}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    zIndex: 29,
    left: 0,
    right: 0,
    height: RACE_WORKSPACE_SWITCH_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: mobileComponents.screenGutter,
    paddingBottom: 4,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  segmentedControl: {
    minHeight: 38,
    flexDirection: 'row',
    padding: mobileComponents.segmentedControl.padding,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  segment: {
    flex: 1,
    minHeight: mobileComponents.segment.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: mobileComponents.segment.paddingHorizontal,
  },
  activeSegment: {
    backgroundColor: '#FFFFFF',
  },
  disabled: { opacity: 0.45 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '700', opacity: 0.88 },
  activeLabel: { fontWeight: '800', opacity: 1 },
});

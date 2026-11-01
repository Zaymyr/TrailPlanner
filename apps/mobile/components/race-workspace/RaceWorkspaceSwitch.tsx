import { mobileComponents } from '@pace-yourself/design-system';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { Text } from '../themed/Text';

export const RACE_WORKSPACE_SWITCH_HEIGHT = 54;

type Props = {
  active: 'racebook' | 'plan';
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

export function RaceWorkspaceSwitch({
  active,
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
    <Animated.View style={[styles.shell, { top }]}>
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
          <Text style={[styles.label, active === 'racebook' && styles.activeLabel]}>{racebookLabel}</Text>
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
          <Text style={[styles.label, active === 'plan' && styles.activeLabel]}>{planLabel}</Text>
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
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  segmentedControl: {
    minHeight: 38,
    flexDirection: 'row',
    padding: mobileComponents.segmentedControl.padding,
    borderRadius: mobileComponents.segmentedControl.borderRadius,
    backgroundColor: Colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    minHeight: mobileComponents.segment.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mobileComponents.segment.borderRadius,
    paddingHorizontal: mobileComponents.segment.paddingHorizontal,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeSegment: {
    backgroundColor: Colors.surface,
    borderColor: Colors.brandBorder,
  },
  disabled: { opacity: 0.45 },
  label: { color: Colors.textSecondary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  activeLabel: { color: Colors.brandPrimary, fontWeight: '800' },
});

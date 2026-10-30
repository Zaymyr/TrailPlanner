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
  planDisabled = false,
  racebookDisabled = false,
  scrollY,
  topInset,
}: Props) {
  const { t, locale } = useI18n();
  const racebookLabel = locale === 'fr' ? 'Livret coureur' : 'Race Book';
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
          accessibilityState={{ selected: active === 'racebook', disabled: racebookDisabled }}
          disabled={active === 'racebook' || racebookDisabled}
          onPress={onOpenRacebook}
          style={[styles.segment, active === 'racebook' && styles.activeSegment, racebookDisabled && styles.disabled]}
          testID="race-workspace-racebook"
        >
          <Text style={[styles.label, active === 'racebook' && styles.activeLabel]}>{racebookLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t.planWorkspace.myPlan}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'plan', disabled: planDisabled }}
          disabled={active === 'plan' || planDisabled}
          onPress={onOpenPlan}
          style={[styles.segment, active === 'plan' && styles.activeSegment, planDisabled && styles.disabled]}
          testID="race-workspace-plan"
        >
          <Text style={[styles.label, active === 'plan' && styles.activeLabel]}>{t.planWorkspace.myPlan}</Text>
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
    paddingHorizontal: 18,
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
    padding: 3,
    borderRadius: 13,
    backgroundColor: Colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  activeSegment: {
    backgroundColor: Colors.surface,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  disabled: { opacity: 0.45 },
  label: { color: Colors.textSecondary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  activeLabel: { color: Colors.brandPrimary, fontWeight: '800' },
});

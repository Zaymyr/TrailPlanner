import { mobileComponents } from '@pace-yourself/design-system';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useTrailRandom } from '../themed/TrailSeedProvider';
import { FlippedBib, PinnedBib } from '../themed/trail/BibParts';

export const RACE_WORKSPACE_SWITCH_HEIGHT = 70;

/** Decorative bib numbers: the guide is always bib 01, the plan bib 02. */
const BIB_NUMBERS = { racebook: '01', plan: '02' } as const;
/** How far the flipped bib slides under the pinned one. */
const BIB_OVERLAP = 8;

type Props = {
  active: 'racebook' | 'plan';
  /** Header background color: the switch reads as part of the header. */
  backgroundColor: string;
  /** Kept for API compatibility: bibs carry their own paper and ink colors. */
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
 * Livret / plan switch attached under the workspace header, drawn as two race
 * bibs: the active view is the bib pinned on the front (four safety pins,
 * "PACE YOURSELF" band, number, tear-off foot), the other one is flipped and
 * tucked behind. Bib leans come from the session trail seed (never colors or
 * sizes); disabled bibs stay upright. Each bib is a 44 pt+ tab with its
 * selected state exposed to assistive technologies.
 */
export function RaceWorkspaceSwitch({
  active,
  backgroundColor,
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
  const planLabel = planExists ? t.catalog.racebookMyPlan : t.catalog.racebookCreatePlan;
  const racebookRandom = useTrailRandom('bib|racebook', { neutral: racebookDisabled });
  const planRandom = useTrailRandom('bib|plan', { neutral: planDisabled });
  const collapseDistance = expandedHeaderHeight - compactHeaderHeight;
  const top = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [topInset + expandedHeaderHeight, topInset + compactHeaderHeight],
    extrapolate: 'clamp',
  });

  const { bib } = mobileComponents.trailVariation;
  const renderBib = (key: 'racebook' | 'plan', label: string, random: typeof planRandom) => (
    active === key
      ? <PinnedBib label={label} lean={random.between('lean', bib.active)} number={BIB_NUMBERS[key]} />
      : <FlippedBib label={label} lean={random.between('lean', bib.flipped)} />
  );

  return (
    <Animated.View style={[styles.shell, { top, backgroundColor }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        <Pressable
          accessibilityLabel={racebookLabel}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'racebook', disabled: active === 'racebook' || racebookDisabled }}
          disabled={active === 'racebook' || racebookDisabled}
          onPress={onOpenRacebook}
          style={({ pressed }) => [
            styles.slot,
            active === 'racebook' ? styles.front : styles.behindLeft,
            pressed && styles.pressed,
            racebookDisabled && styles.disabled,
          ]}
          testID="race-workspace-racebook"
        >
          {renderBib('racebook', racebookLabel, racebookRandom)}
        </Pressable>
        <Pressable
          accessibilityLabel={planLabel}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'plan', disabled: active === 'plan' || planDisabled }}
          disabled={active === 'plan' || planDisabled}
          onPress={onOpenPlan}
          style={({ pressed }) => [
            styles.slot,
            active === 'plan' ? styles.front : styles.behindRight,
            pressed && styles.pressed,
            planDisabled && styles.disabled,
          ]}
          testID="race-workspace-plan"
        >
          {renderBib('plan', planLabel, planRandom)}
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
    paddingBottom: 6,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  slot: {
    flex: 1,
    minHeight: mobileComponents.segment.minHeight,
    justifyContent: 'center',
  },
  front: { zIndex: 2, elevation: 4 },
  // The flipped bib slides under the pinned one, toward it.
  behindLeft: { zIndex: 1, marginRight: -BIB_OVERLAP },
  behindRight: { zIndex: 1, marginLeft: -BIB_OVERLAP },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.45 },
});

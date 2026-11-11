import { mobileComponents, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DataText } from './DataText';
import { useTrailRandom } from './TrailSeedProvider';
import { BRACELET_HEIGHT, BRACELET_PALETTES, BraceletTab, type BraceletTone } from './trail/BraceletTab';

type StatusTone = BraceletTone;

type Props = {
  label: string;
  tone?: StatusTone;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Status shown as a Tyvek race-control wristband: colored notched tab, a
 * dotted tear line, then the status in mono capitals. It only displays a
 * state and is never pressable. Each wristband leans by a session-stable
 * random angle (±trailVariation.bracelet.tilt); colors never vary.
 */
export function StatusPill({ label, tone = 'neutral', icon, accessibilityLabel, style }: Props) {
  const palette = BRACELET_PALETTES[tone];
  const random = useTrailRandom(`bracelet|${label}`);
  const tilt = random.jitter('tilt', mobileComponents.trailVariation.bracelet.tilt);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="text"
      style={[styles.base, { backgroundColor: palette.band }, tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null, style]}
    >
      <BraceletTab palette={palette} />
      <View style={styles.body}>
        {icon}
        <DataText numberOfLines={1} weight="bold" style={[styles.label, { color: palette.ink }]}>
          {label.toLocaleUpperCase('fr-FR')}
        </DataText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    height: BRACELET_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: 9,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
  },
});

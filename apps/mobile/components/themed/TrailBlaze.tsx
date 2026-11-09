import { colors, mobileComponents } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type TrailBlazeTone = 'brand' | 'info' | 'warning' | 'danger' | 'muted' | 'inverse';
export type TrailBlazeSize = 'sm' | 'md' | 'lg';

type Props = {
  tone?: TrailBlazeTone;
  size?: TrailBlazeSize;
  /** Organizer-themed surfaces pass their own [top, bottom] band colors. */
  bandColors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
};

/** Light band over strong band, like paint on a trailside rock. */
const bandsByTone: Record<TrailBlazeTone, readonly [string, string]> = {
  brand: [colors.accent.olive, colors.brand.forest],
  info: [colors.semantic.infoBorder, colors.semantic.info],
  warning: [colors.accent.amber, colors.semantic.warning],
  danger: [colors.accent.terracotta, colors.semantic.danger],
  muted: [colors.border.subtle, colors.border.strong],
  inverse: [colors.accent.olive, colors.text.inverse],
};

/**
 * The Pace Yourself waymark. Purely decorative: it marks where the eye should
 * go (active tab, section start, card identity) but never carries meaning on
 * its own, so it is hidden from assistive technologies.
 */
export function TrailBlaze({ tone = 'brand', size = 'md', bandColors, style }: Props) {
  const geometry = mobileComponents.blaze[size];
  const [top, bottom] = bandColors ?? bandsByTone[tone];
  const band = {
    width: geometry.width,
    height: geometry.bandHeight,
    borderRadius: mobileComponents.blaze.radius,
  };

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.container, { gap: geometry.gap }, style]}
    >
      <View style={[band, { backgroundColor: top }]} />
      <View style={[band, { backgroundColor: bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
});

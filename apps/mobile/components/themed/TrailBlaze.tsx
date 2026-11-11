import { colors, mobileComponents } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type TrailBlazeTone = 'brand' | 'info' | 'warning' | 'danger' | 'muted' | 'inverse';
export type TrailBlazeSize = 'sm' | 'md' | 'lg';
export type TrailBlazeOrientation = 'horizontal' | 'vertical';

type Props = {
  tone?: TrailBlazeTone;
  size?: TrailBlazeSize;
  /**
   * Horizontal: bands stacked like paint on a rock (section starts, cards).
   * Vertical: bands side by side, set beside an icon or label (tabs).
   */
  orientation?: TrailBlazeOrientation;
  /** Organizer-themed surfaces pass their own [light, strong] band colors. */
  bandColors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
};

type Bands = { light: string; accent: string | null; strong: string };

/**
 * Light band, a thin warm amber stripe, then the strong band. The amber
 * stripe is the brand's warm touch; semantic tones keep two bands only.
 */
const bandsByTone: Record<TrailBlazeTone, Bands> = {
  brand: { light: colors.accent.olive, accent: colors.accent.amber, strong: colors.brand.forest },
  info: { light: colors.semantic.infoBorder, accent: null, strong: colors.semantic.info },
  warning: { light: colors.accent.amber, accent: null, strong: colors.semantic.warning },
  danger: { light: colors.accent.terracotta, accent: null, strong: colors.semantic.danger },
  muted: { light: colors.border.subtle, accent: null, strong: colors.border.strong },
  inverse: { light: colors.accent.olive, accent: colors.accent.amber, strong: colors.text.inverse },
};

/** The amber stripe stays light: thinner than the bands and slightly transparent. */
const ACCENT_RATIO = 0.5;
const ACCENT_OPACITY = 0.72;

/**
 * The Pace Yourself waymark. Purely decorative: it marks where the eye should
 * go (active tab, section start, card identity) but never carries meaning on
 * its own, so it is hidden from assistive technologies.
 */
export function TrailBlaze({ tone = 'brand', size = 'md', orientation = 'horizontal', bandColors, style }: Props) {
  const geometry = mobileComponents.blaze[size];
  const bands: Bands = bandColors
    ? { light: bandColors[0], accent: null, strong: bandColors[1] }
    : bandsByTone[tone];
  const vertical = orientation === 'vertical';
  const accentThickness = Math.max(1, Math.round(geometry.bandHeight * ACCENT_RATIO));
  const band = (thickness: number) => ({
    width: vertical ? thickness : geometry.width,
    height: vertical ? geometry.width : thickness,
    borderRadius: mobileComponents.blaze.radius,
  });

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.container, vertical && styles.vertical, { gap: geometry.gap }, style]}
    >
      <View style={[band(geometry.bandHeight), { backgroundColor: bands.light }]} />
      {bands.accent ? (
        <View style={[band(accentThickness), { backgroundColor: bands.accent, opacity: ACCENT_OPACITY }]} />
      ) : null}
      <View style={[band(geometry.bandHeight), { backgroundColor: bands.strong }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  vertical: {
    flexDirection: 'row',
  },
});

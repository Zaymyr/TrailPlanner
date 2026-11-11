import { colors, mobileComponents } from '@pace-yourself/design-system';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

export type TrailBlazeTone = 'brand' | 'info' | 'warning' | 'danger' | 'muted' | 'inverse';
export type TrailBlazeSize = 'sm' | 'md' | 'lg';

type Bands = { light: string; accent: string | null; strong: string };

const { ratio } = mobileComponents.blaze;

/**
 * Light band, a thin amber stripe, then the strong band. Semantic tones keep
 * two bands only; the amber stripe is the brand's light warm touch.
 */
const bandsByTone: Record<TrailBlazeTone, Bands> = {
  brand: { light: colors.accent.olive, accent: colors.accent.amber, strong: colors.brand.forest },
  info: { light: colors.semantic.infoBorder, accent: null, strong: colors.semantic.info },
  warning: { light: colors.accent.amber, accent: null, strong: colors.semantic.warning },
  danger: { light: colors.accent.terracotta, accent: null, strong: colors.semantic.danger },
  muted: { light: colors.border.subtle, accent: null, strong: colors.border.strong },
  inverse: { light: colors.accent.olive, accent: colors.accent.amber, strong: colors.text.inverse },
};

type BlazeProps = {
  tone?: TrailBlazeTone;
  size?: TrailBlazeSize;
  /** Organizer-themed surfaces pass their own [light, strong] band colors. */
  bandColors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
};

/**
 * The Pace Yourself waymark: stacked painted bands in 2:1:4 proportions.
 * Purely decorative: it marks where the eye should go (section start, card
 * identity) but never carries meaning on its own, so it is hidden from
 * assistive technologies.
 */
export function TrailBlaze({ tone = 'brand', size = 'md', bandColors, style }: BlazeProps) {
  const geometry = mobileComponents.blaze[size];
  const bands: Bands = bandColors
    ? { light: bandColors[0], accent: null, strong: bandColors[1] }
    : bandsByTone[tone];
  const band = (share: number, backgroundColor: string) => (
    <View
      style={{
        width: geometry.width,
        height: share * geometry.unit,
        borderRadius: mobileComponents.blaze.radius,
        backgroundColor,
      }}
    />
  );

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.blaze, { gap: geometry.gap }, style]}
    >
      {band(ratio.light, bands.light)}
      {bands.accent ? band(ratio.accent, bands.accent) : null}
      {band(ratio.strong, bands.strong)}
    </View>
  );
}

type LineProps = {
  tone?: Extract<TrailBlazeTone, 'brand' | 'inverse'>;
  /** Fixed width, or omit to fill the parent. */
  width?: DimensionValue;
  thickness?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The blaze laid flat: one horizontal line of light green, amber and dark
 * green whose segment lengths follow the blaze's 2:1:4 band proportions. It
 * underlines the active tab or navigation item. Decorative: selection must
 * also be exposed through accessibility state and label weight/color.
 */
export function BlazeLine({
  tone = 'brand',
  width,
  thickness = mobileComponents.blaze.line.thickness,
  style,
}: LineProps) {
  const bands = bandsByTone[tone];
  const segment = (share: number, backgroundColor: string) => (
    <View style={{ flex: share, height: thickness, borderRadius: thickness, backgroundColor }} />
  );

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.line, { gap: mobileComponents.blaze.line.gap }, width != null ? { width } : styles.lineFill, style]}
    >
      {segment(ratio.light, bands.light)}
      {bands.accent ? segment(ratio.accent, bands.accent) : null}
      {segment(ratio.strong, bands.strong)}
    </View>
  );
}

const styles = StyleSheet.create({
  blaze: { flexDirection: 'column', alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center' },
  lineFill: { alignSelf: 'stretch' },
});

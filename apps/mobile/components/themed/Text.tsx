import { colors, typography } from '@pace-yourself/design-system';
import {
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle
} from 'react-native';

type TextTone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'brand';
type TextSize = keyof typeof typography.size;
type TextWeight = keyof typeof typography.weight;

type Props = RNTextProps & {
  tone?: TextTone;
  size?: TextSize;
  weight?: TextWeight;
  lineHeight?: keyof typeof typography.lineHeight;
  letterSpacing?: keyof typeof typography.letterSpacing;
  style?: StyleProp<TextStyle>;
};

const fontFamilyByWeight: Record<TextWeight, string> = {
  light: 'BricolageGrotesque_300Light',
  regular: 'Bricolage Grotesque',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
};

const colorByTone: Record<TextTone, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  tertiary: colors.text.tertiary,
  inverse: colors.text.inverse,
  brand: colors.brand.forest,
};

export function Text({
  tone = 'primary',
  size = 'base',
  weight = 'regular',
  lineHeight,
  letterSpacing = 'normal',
  style,
  ...props
}: Props) {
  const flattenedStyle = StyleSheet.flatten(style);
  const fontSize = typography.size[size];
  const styleWeight = getTextWeight(flattenedStyle?.fontWeight);
  const resolvedWeight = styleWeight ?? weight;
  const hasCustomFontFamily = typeof flattenedStyle?.fontFamily === 'string';
  const shouldApplyLineHeight = lineHeight != null || flattenedStyle?.fontSize == null;

  return (
    <RNText
      {...props}
      style={[
        styles.base,
        {
          color: colorByTone[tone],
          fontSize,
          letterSpacing: typography.letterSpacing[letterSpacing] * fontSize,
          ...(shouldApplyLineHeight
            ? {
                lineHeight: Math.round(
                  fontSize * typography.lineHeight[lineHeight ?? 'normal'],
                ),
              }
            : null),
        },
        style,
        !hasCustomFontFamily
          ? {
              fontFamily: fontFamilyByWeight[resolvedWeight],
              fontWeight: undefined,
            }
          : null,
      ]}
    />
  );
}

function getTextWeight(fontWeight: TextStyle['fontWeight'] | undefined): TextWeight | null {
  if (fontWeight == null) return null;

  const value = String(fontWeight);

  if (value === '300') return 'light';
  if (value === '400' || value === 'normal') return 'regular';
  if (value === '500') return 'medium';
  if (value === '600') return 'semibold';
  if (value === '700' || value === '800' || value === '900' || value === 'bold') return 'bold';

  return null;
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});

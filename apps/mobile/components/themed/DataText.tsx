import { colors, typography } from '@pace-yourself/design-system';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle
} from 'react-native';

type DataTone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'danger' | 'warning';
type DataWeight = 'regular' | 'medium' | 'semibold' | 'bold';

type Props = TextProps & {
  tone?: DataTone;
  size?: keyof typeof typography.size;
  weight?: DataWeight;
  style?: StyleProp<TextStyle>;
};

const fontFamilyByWeight: Record<DataWeight, string> = {
  regular: 'JetBrains Mono',
  medium: 'JetBrainsMono_500Medium',
  semibold: 'JetBrainsMono_600SemiBold',
  bold: 'JetBrainsMono_700Bold',
};

const colorByTone: Record<DataTone, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  tertiary: colors.text.tertiary,
  brand: colors.brand.forest,
  danger: colors.accent.terracotta,
  warning: colors.accent.amber,
};

export function DataText({
  tone = 'primary',
  size = 'sm',
  weight = 'regular',
  style,
  ...props
}: Props) {
  const flattenedStyle = StyleSheet.flatten(style);
  const fontSize = typography.size[size];
  const styleWeight = getDataWeight(flattenedStyle?.fontWeight);
  const resolvedWeight = styleWeight ?? weight;
  const hasCustomFontFamily = typeof flattenedStyle?.fontFamily === 'string';
  const shouldApplyLineHeight = flattenedStyle?.fontSize == null;

  return (
    <Text
      {...props}
      style={[
        styles.base,
        {
          color: colorByTone[tone],
          fontSize,
          ...(shouldApplyLineHeight
            ? {
                lineHeight: Math.round(fontSize * typography.lineHeight.snug),
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

function getDataWeight(fontWeight: TextStyle['fontWeight'] | undefined): DataWeight | null {
  if (fontWeight == null) return null;

  const value = String(fontWeight);

  if (value === '400' || value === 'normal') return 'regular';
  if (value === '500') return 'medium';
  if (value === '600') return 'semibold';
  if (value === '700' || value === '800' || value === '900' || value === 'bold') return 'bold';

  return null;
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
});

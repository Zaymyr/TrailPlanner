import { colors, typography } from '@pace-yourself/design-system';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
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
  const fontSize = typography.size[size];

  return (
    <Text
      {...props}
      style={[
        styles.base,
        {
          color: colorByTone[tone],
          fontFamily: fontFamilyByWeight[weight],
          fontSize,
          lineHeight: Math.round(fontSize * typography.lineHeight.snug),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
});

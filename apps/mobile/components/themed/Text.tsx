import { colors, typography } from '@pace-yourself/design-system';
import {
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
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
  lineHeight = 'normal',
  letterSpacing = 'normal',
  style,
  ...props
}: Props) {
  const fontSize = typography.size[size];

  return (
    <RNText
      {...props}
      style={[
        styles.base,
        {
          color: colorByTone[tone],
          fontFamily: fontFamilyByWeight[weight],
          fontSize,
          letterSpacing: typography.letterSpacing[letterSpacing] * fontSize,
          lineHeight: Math.round(fontSize * typography.lineHeight[lineHeight]),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});

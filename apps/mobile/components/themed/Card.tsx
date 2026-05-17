import { colors, radius, shadows, spacing } from '@pace-yourself/design-system';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type CardSurface = 'white' | 'cream' | 'sandLight';

type Props = ViewProps & {
  surface?: CardSurface;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

const surfaceByVariant: Record<CardSurface, string> = {
  white: colors.surface.white,
  cream: colors.surface.cream,
  sandLight: colors.surface.sandLight,
};

export function Card({ surface = 'white', padded = true, style, ...props }: Props) {
  return (
    <View
      {...props}
      style={[
        styles.base,
        { backgroundColor: surfaceByVariant[surface] },
        padded && styles.padded,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    boxShadow: shadows.sm,
  } as ViewStyle,
  padded: {
    padding: spacing[4],
  },
});

import { colors, spacing } from '@pace-yourself/design-system';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type Props = ViewProps & {
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ padded = false, style, ...props }: Props) {
  return (
    <View
      {...props}
      style={[styles.base, padded && styles.padded, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.surface.sand,
  },
  padded: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing[5],
  },
});

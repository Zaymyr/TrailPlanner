import { colors, spacing } from '@pace-yourself/design-system';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';

type Props = {
  label?: string;
  accessibilityLabel?: string;
  size?: 'small' | 'large';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function LoadingState({
  label,
  accessibilityLabel = label ?? 'Loading',
  size = 'large',
  style,
  testID,
}: Props) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[styles.container, style]}
      testID={testID}
    >
      <ActivityIndicator color={colors.brand.forest} size={size} />
      {label ? <Text size="sm" tone="secondary" style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    padding: spacing[4],
  },
  label: {
    marginTop: spacing[3],
    textAlign: 'center',
  },
});

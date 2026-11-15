import { spacing } from '@pace-yourself/design-system';
import {
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { RidgeLoader } from './Ridge';
import { Text } from './Text';
import { TopoCard } from './TopoCard';

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
    <TopoCard
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      surface="cream"
      variant="signature"
      style={[styles.container, style]}
      testID={testID}
    >
      <RidgeLoader height={size === 'small' ? 28 : 40} width={size === 'small' ? 84 : 120} />
      {label ? <Text size="sm" tone="secondary" style={styles.label}>{label}</Text> : null}
    </TopoCard>
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

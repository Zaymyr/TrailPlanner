import { colors, spacing } from '@pace-yourself/design-system';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from './Button';
import { Heading } from './Heading';
import { Text } from './Text';

type Props = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  isRetrying = false,
  style,
  testID,
}: Props) {
  return (
    <View accessibilityRole="alert" style={[styles.container, style]} testID={testID}>
      <View style={styles.icon} />
      <Heading style={styles.centered} variant="h3">{title}</Heading>
      {description ? <Text tone="secondary" style={styles.description}>{description}</Text> : null}
      {onRetry && retryLabel ? (
        <Button isLoading={isRetrying} onPress={onRetry} style={styles.action} variant="secondary">
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    padding: spacing[5],
  },
  icon: {
    backgroundColor: colors.accent.terracotta,
    borderRadius: 4,
    height: 8,
    marginBottom: spacing[3],
    width: 8,
  },
  centered: {
    textAlign: 'center',
  },
  description: {
    marginTop: spacing[2],
    maxWidth: 320,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[4],
  },
});

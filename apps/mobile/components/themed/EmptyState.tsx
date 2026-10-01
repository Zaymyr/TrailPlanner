import { spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
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
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onActionPress,
  icon,
  style,
  testID,
}: Props) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Heading style={styles.centered} variant="h3">{title}</Heading>
      {description ? <Text tone="secondary" style={styles.description}>{description}</Text> : null}
      {onActionPress && actionLabel ? (
        <Button onPress={onActionPress} style={styles.action}>{actionLabel}</Button>
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
    marginBottom: spacing[3],
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

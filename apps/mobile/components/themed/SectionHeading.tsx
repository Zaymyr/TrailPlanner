import { spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Heading } from './Heading';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeading({
  title,
  subtitle,
  eyebrow,
  icon,
  actionLabel,
  onActionPress,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.copy}>
        {eyebrow ? <Text tone="brand" size="xs" weight="bold" letterSpacing="caps">{eyebrow.toUpperCase()}</Text> : null}
        <View style={styles.titleRow}>
          {icon}
          <Heading accessibilityRole="header" variant="h3">{title}</Heading>
        </View>
        {subtitle ? <Text tone="secondary" size="sm">{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onActionPress} style={styles.action}>
          <Text tone="brand" size="sm" weight="semibold">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  copy: { flex: 1, gap: spacing[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[1] },
});

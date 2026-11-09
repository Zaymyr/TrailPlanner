import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';

type StatusTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

type Props = {
  label: string;
  tone?: StatusTone;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatusPill({ label, tone = 'neutral', icon, accessibilityLabel, style }: Props) {
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.base, toneStyles[tone], style]}
    >
      {icon ?? <View accessible={false} style={[styles.statusMark, toneMarkStyles[tone]]} />}
      <Text size="xs" weight="semibold" style={toneTextStyles[tone]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    minHeight: 26,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: mobileComponents.pillRadius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  statusMark: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const toneMarkStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.text.tertiary },
  brand: { backgroundColor: colors.brand.forest },
  info: { backgroundColor: colors.semantic.info },
  success: { backgroundColor: colors.semantic.success },
  warning: { backgroundColor: colors.semantic.warning },
  danger: { backgroundColor: colors.semantic.danger },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surface.muted, borderColor: colors.border.subtle },
  brand: { backgroundColor: colors.brand.surface, borderColor: colors.brand.border },
  info: { backgroundColor: colors.semantic.infoSurface, borderColor: colors.semantic.infoBorder },
  success: { backgroundColor: colors.brand.surface, borderColor: colors.brand.border },
  warning: { backgroundColor: colors.semantic.warningSurface, borderColor: colors.accent.amber },
  danger: { backgroundColor: colors.semantic.dangerSurface, borderColor: colors.accent.terracotta },
});

const toneTextStyles = StyleSheet.create({
  neutral: { color: colors.text.secondary },
  brand: { color: colors.brand.forest },
  info: { color: colors.semantic.info },
  success: { color: colors.semantic.success },
  warning: { color: colors.semantic.warning },
  danger: { color: colors.semantic.danger },
});

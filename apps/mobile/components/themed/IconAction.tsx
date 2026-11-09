import { colors, mobileComponents } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  accessibilityLabel: string;
  icon: ReactNode;
  tone?: 'neutral' | 'brand' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function IconAction({ accessibilityLabel, icon, tone = 'neutral', disabled, style, ...props }: Props) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        toneStyles[tone],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: mobileComponents.closeButtonSize,
    height: mobileComponents.closeButtonSize,
    borderRadius: mobileComponents.actionRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surface.cream, borderColor: colors.border.subtle },
  brand: { backgroundColor: colors.brand.surface, borderColor: colors.brand.border },
  danger: { backgroundColor: colors.semantic.dangerSurface, borderColor: colors.accent.terracotta },
});

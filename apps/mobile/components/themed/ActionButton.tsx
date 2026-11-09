import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

export type ActionButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: string;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  fullWidth = false,
  isLoading = false,
  disabled,
  accessibilityLabel,
  accessibilityState,
  style,
  textStyle,
  ...props
}: ActionButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);
  const spinnerColor = variant === 'primary' || variant === 'destructive'
    ? colors.text.inverse
    : variant === 'ghost'
      ? colors.brand.forest
      : colors.text.primary;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {leading}
          <Text
            size={size === 'sm' ? 'sm' : 'base'}
            tone={variant === 'primary' || variant === 'destructive' ? 'inverse' : variant === 'ghost' ? 'brand' : 'primary'}
            weight="semibold"
            style={textStyle}
          >
            {children}
          </Text>
          {trailing}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    borderRadius: mobileComponents.buttonRadius,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: mobileComponents.motion.pressScale }],
  },
  disabled: {
    opacity: 0.52,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {
    minHeight: mobileComponents.action.minHeight.sm,
    paddingHorizontal: mobileComponents.action.paddingHorizontal.sm,
    paddingVertical: spacing[2],
  },
  md: {
    minHeight: mobileComponents.action.minHeight.md,
    paddingHorizontal: mobileComponents.action.paddingHorizontal.md,
    paddingVertical: spacing[3],
  },
  lg: {
    minHeight: mobileComponents.action.minHeight.lg,
    paddingHorizontal: mobileComponents.action.paddingHorizontal.lg,
    paddingVertical: spacing[3],
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand.forest,
    borderColor: colors.brand.forest,
    borderWidth: 1,
  },
  secondary: {
    backgroundColor: colors.surface.cream,
    borderColor: colors.border.brand,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border.subtle,
    borderWidth: 1,
  },
  destructive: {
    backgroundColor: colors.semantic.danger,
    borderColor: colors.semantic.danger,
    borderWidth: 1,
  },
});

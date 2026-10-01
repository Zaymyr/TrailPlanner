import { colors, radius, spacing } from '@pace-yourself/design-system';
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

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type Props = Omit<PressableProps, 'style'> & {
  children: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  isLoading = false,
  disabled,
  style,
  textStyle,
  ...props
}: Props) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || isLoading), busy: isLoading }}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !disabled && !isLoading && styles.pressed,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={isPrimary ? colors.text.inverse : colors.brand.forest} />
      ) : (
        <Text
          tone={isPrimary ? 'inverse' : 'brand'}
          size="sm"
          weight="bold"
          letterSpacing={isPrimary ? 'wide' : 'normal'}
          style={[isPrimary && styles.primaryLabel, textStyle]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
  primaryLabel: {
    textTransform: 'uppercase',
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand.forest,
  },
  secondary: {
    backgroundColor: colors.surface.cream,
    borderWidth: 1,
    borderColor: colors.border.brand,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
  },
});

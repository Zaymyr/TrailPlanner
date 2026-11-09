import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Field = forwardRef<TextInput, Props>(function Field(
  {
    label,
    helper,
    error,
    leading,
    trailing,
    containerStyle,
    editable = true,
    placeholderTextColor = colors.text.tertiary,
    style,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text size="sm" weight="semibold">{label}</Text> : null}
      <View style={[styles.shell, focused && styles.shellFocused, error && styles.shellError, !editable && styles.disabled]}>
        <View
          accessible={false}
          style={[styles.focusMarker, focused && styles.focusMarkerActive, error && styles.focusMarkerError]}
        />
        {leading}
        <TextInput
          {...props}
          ref={ref}
          editable={editable}
          placeholderTextColor={placeholderTextColor}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" size="xs" style={styles.error}>
          {error}
        </Text>
      ) : helper ? (
        <Text tone="secondary" size="xs">{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing[1.5] },
  shell: {
    minHeight: mobileComponents.input.minHeight,
    borderRadius: mobileComponents.input.borderRadius,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: mobileComponents.input.paddingHorizontal,
  },
  shellFocused: { borderColor: colors.brand.forest, borderWidth: 1.5 },
  shellError: { borderColor: colors.semantic.danger },
  focusMarker: {
    position: 'absolute',
    left: -1,
    top: 11,
    bottom: 11,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.border.strong,
  },
  focusMarkerActive: { backgroundColor: colors.brand.forest, width: 4 },
  focusMarkerError: { backgroundColor: colors.accent.terracotta, width: 4 },
  disabled: { opacity: 0.55 },
  input: {
    flex: 1,
    minHeight: mobileComponents.input.minHeight,
    paddingVertical: spacing[2],
    color: colors.text.primary,
    fontFamily: 'Bricolage Grotesque',
    fontSize: 16,
  },
  error: { color: colors.semantic.danger },
});

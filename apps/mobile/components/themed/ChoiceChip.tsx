import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ChoiceChip({ label, selected, icon, trailing, disabled, accessibilityState, style, ...props }: Props) {
  return (
    <Pressable
      {...props}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityState={{ ...accessibilityState, selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {selected && !icon ? <View accessible={false} style={styles.selectionMark} /> : null}
      {icon}
      <Text tone={selected ? 'inverse' : 'secondary'} size="sm" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: mobileComponents.filterChip.minHeight,
    paddingHorizontal: mobileComponents.filterChip.paddingHorizontal,
    borderRadius: mobileComponents.filterChip.borderRadius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
  },
  selected: {
    backgroundColor: colors.brand.forest,
    borderColor: colors.brand.forest,
  },
  selectionMark: {
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: colors.text.inverse,
    transform: [{ rotate: '45deg' }],
  },
  unselected: {
    backgroundColor: colors.surface.cream,
    borderColor: colors.border.subtle,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
});

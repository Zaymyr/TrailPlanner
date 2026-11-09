import { colors, mobileComponents, shadows } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { TopoContourPattern } from './TopoContourPattern';

export type TopoCardVariant = 'standard' | 'interactive' | 'signature' | 'featured';
export type TopoCardSurface = 'white' | 'cream' | 'sandLight' | 'brand' | 'info' | 'danger';

type Props = Omit<ViewProps, 'children' | 'style'> & {
  children: ReactNode;
  variant?: TopoCardVariant;
  surface?: TopoCardSurface;
  padded?: boolean;
  accentColor?: string;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
};

const surfaceByVariant: Record<TopoCardSurface, string> = {
  white: colors.surface.white,
  cream: colors.surface.cream,
  sandLight: colors.surface.sandLight,
  brand: colors.brand.surface,
  info: colors.semantic.infoSurface,
  danger: colors.semantic.dangerSurface,
};

export function TopoCard({
  children,
  variant = 'standard',
  surface = 'white',
  padded = true,
  accentColor = colors.brand.forest,
  onPress,
  style,
  ...props
}: Props) {
  const cardStyle = [
    styles.base,
    { backgroundColor: surfaceByVariant[surface] },
    padded && styles.padded,
    (variant === 'signature' || variant === 'featured') && styles.signature,
    style,
  ];
  const content = (
    <>
      {variant === 'featured' ? <TopoContourPattern /> : null}
      {children}
      {variant === 'signature' || variant === 'featured' ? (
        <View accessible={false} style={[styles.elevationMark, { backgroundColor: accentColor }]} />
      ) : null}
    </>
  );

  if (onPress || variant === 'interactive') {
    return (
      <Pressable
        {...props}
        accessibilityRole={onPress ? 'button' : props.accessibilityRole}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && onPress && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View {...props} style={cardStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: mobileComponents.topoCard.borderRadius,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    boxShadow: shadows.sm,
  } as ViewStyle,
  padded: {
    padding: mobileComponents.topoCard.padding,
  },
  signature: {
    borderColor: colors.brand.border,
    borderBottomRightRadius: mobileComponents.topoCard.featuredBottomRightRadius,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: mobileComponents.motion.pressScale }],
  },
  elevationMark: {
    position: 'absolute',
    right: 10,
    bottom: 7,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.forest,
    opacity: 0.28,
  },
});

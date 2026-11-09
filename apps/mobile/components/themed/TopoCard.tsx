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

type TopoCardVariant = 'standard' | 'interactive' | 'featured';
type TopoCardSurface = 'white' | 'cream' | 'brand' | 'info';

type Props = Omit<ViewProps, 'children' | 'style'> & {
  children: ReactNode;
  variant?: TopoCardVariant;
  surface?: TopoCardSurface;
  padded?: boolean;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
};

const surfaceByVariant: Record<TopoCardSurface, string> = {
  white: colors.surface.white,
  cream: colors.surface.cream,
  brand: colors.brand.surface,
  info: colors.semantic.infoSurface,
};

export function TopoCard({
  children,
  variant = 'standard',
  surface = 'white',
  padded = true,
  onPress,
  style,
  ...props
}: Props) {
  const cardStyle = [
    styles.base,
    { backgroundColor: surfaceByVariant[surface] },
    padded && styles.padded,
    variant === 'featured' && styles.featured,
    style,
  ];
  const content = (
    <>
      {variant === 'featured' ? <TopoContourPattern /> : null}
      {children}
      {variant === 'featured' ? <View accessible={false} style={styles.elevationMark} /> : null}
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
  featured: {
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

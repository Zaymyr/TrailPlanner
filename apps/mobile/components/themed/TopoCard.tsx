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
  accentColor,
  onPress,
  style,
  ...props
}: Props) {
  const resolvedAccentColor = accentColor
    ?? (surface === 'danger'
      ? colors.accent.terracotta
      : surface === 'info'
        ? colors.semantic.info
        : colors.brand.forest);
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
        <View accessible={false} style={[styles.trailMarker, { backgroundColor: resolvedAccentColor }]} />
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
    borderBottomRightRadius: mobileComponents.topoCard.signatureBottomRightRadius,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: mobileComponents.motion.pressScale }],
  },
  trailMarker: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: mobileComponents.topoCard.markerWidth,
    height: mobileComponents.topoCard.markerHeight,
    borderTopRightRadius: mobileComponents.signature.markerRadius,
    borderBottomRightRadius: mobileComponents.signature.markerRadius,
    opacity: 0.9,
  },
});

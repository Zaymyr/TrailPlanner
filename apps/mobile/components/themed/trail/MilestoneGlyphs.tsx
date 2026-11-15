import { colors } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { DataText } from '../DataText';

const HEART_PATH = 'M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z';

/** Heart painted on the Favoris milestone: filled when active, outlined otherwise. */
export function MilestoneHeart({ color, filled, size = 18 }: { color: string; filled: boolean; size?: number }) {
  return (
    <Svg accessible={false} height={size} pointerEvents="none" viewBox="0 0 24 24" width={size}>
      <Path
        d={HEART_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={filled ? 0 : 2}
      />
    </Svg>
  );
}

/**
 * Orienteering compass needle: red north, forest south. Decorative only; the
 * north half is a plain triangle, never the red/white GR waymark.
 */
export function CompassNeedle({ size = 26, rotate = 0 }: { size?: number; rotate?: number }) {
  return (
    <Svg
      accessible={false}
      height={size}
      pointerEvents="none"
      style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
      viewBox="0 0 24 24"
      width={size}
    >
      <Path d="M12 3l3 9h-6z" fill={colors.trail.pinRed} />
      <Path d="M12 21l-3-9h6z" fill={colors.brand.forest} />
      <Circle cx={12} cy={12} r={1.4} fill={colors.surface.cream} />
    </Svg>
  );
}

const COMPASS_SIZE = 56;

type CompassProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Spoken name, e.g. "Filtres (2)". */
  accessibilityLabel: string;
  /** Number of active advanced filters, shown as a small mono badge. */
  activeCount?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Round compass button that opens every filter, set at the start of the
 * milestone row. 56 pt, brand surface with a double ring like a baseplate.
 */
export function MilestoneCompassButton({ accessibilityLabel, activeCount = 0, disabled, style, ...props }: CompassProps) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.compass, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
    >
      <View accessible={false} pointerEvents="none" style={styles.innerRing} />
      <CompassNeedle />
      {activeCount > 0 ? (
        <View accessible={false} pointerEvents="none" style={styles.badge}>
          <DataText size="xs" weight="bold" style={styles.badgeText}>{activeCount}</DataText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compass: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.brand.border,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: COMPASS_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.brand.forest,
    borderWidth: 1.5,
    borderColor: colors.surface.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text.inverse, fontSize: 11, lineHeight: 14 },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.5 },
});

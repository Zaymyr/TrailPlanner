import { colors } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import {
  WATCH_BLADE_HEIGHT,
  WATCH_BLADE_TIP,
  WATCH_BLADE_WIDTH,
  WATCH_SIZE,
  WatchBackBlade,
  WatchFace,
  type WatchTone,
} from './trail/WatchButton';

type BaseProps = Omit<PressableProps, 'children' | 'style'> & {
  accessibilityLabel: string;
  tone?: WatchTone;
  style?: StyleProp<ViewStyle>;
};

type Props = BaseProps & (
  /** Round watch button: case ring with hour ticks around a centred push button. */
  | { variant?: 'watch'; icon: ReactNode }
  /**
   * "Back": small wooden sign blade pointing left, without a glyph (the
   * pointed plank is the arrow). Forest blade by default; on a forest header
   * use `tone="onBrand"` (cream blade); any other tone is ignored.
   * `bladeColor` overrides the fill (organizer themes: on-primary color).
   */
  | { variant: 'back'; icon?: ReactNode; bladeColor?: string }
);

/**
 * Short unlabelled action, always with an accessibility label. Drawn as a
 * GPS-watch button (48pt). Tones: neutral (white dome), brand (sage dome),
 * danger (red dome: pass a light icon, e.g. `colors.text.inverse`), onBrand
 * (dark watch with cream bezel for forest headers: pass a light icon).
 */
export function IconAction(allProps: Props) {
  const { accessibilityLabel, icon, tone = 'neutral', variant = 'watch', disabled, style, ...rest } = allProps;
  const { bladeColor: bladeColorProp, ...props } = rest as typeof rest & { bladeColor?: string };
  const isBack = variant === 'back';
  const onBrandBack = isBack && tone === 'onBrand';
  const bladeColor = bladeColorProp ?? (onBrandBack ? colors.surface.cream : undefined);
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        isBack ? styles.blade : styles.watch,
        pressed && !disabled && (isBack ? styles.bladePressed : null),
        disabled && styles.disabled,
        style,
      ]}
    >
      {({ pressed }) => {
        const isPressed = pressed && !disabled;
        return isBack ? (
          <>
            {/* The pointed plank alone says "back"; an explicit icon is still honoured. */}
            <WatchBackBlade color={bladeColor} />
            {icon ? <View style={styles.bladeIcon}>{icon}</View> : null}
          </>
        ) : (
          // Fixed 48pt box: the face and the icon share one centre even when a
          // caller stretches or pads the pressable.
          <View style={[styles.watchBox, isPressed && styles.watchBoxPressed]}>
            <WatchFace pressed={isPressed} tone={tone} />
            <View style={styles.watchIcon}>{icon}</View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  watch: {
    width: WATCH_SIZE,
    height: WATCH_SIZE,
    borderRadius: WATCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchBox: {
    width: WATCH_SIZE,
    height: WATCH_SIZE,
  },
  watchBoxPressed: { transform: [{ scale: 0.96 }] },
  watchIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blade: {
    width: WATCH_BLADE_WIDTH,
    height: WATCH_BLADE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: WATCH_BLADE_TIP / 1.6,
    paddingBottom: 3,
  },
  bladeIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bladePressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});

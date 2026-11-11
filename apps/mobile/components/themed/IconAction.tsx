import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import {
  WATCH_BLADE_HEIGHT,
  WATCH_BLADE_TIP,
  WATCH_BLADE_WIDTH,
  WATCH_SIZE,
  WatchBackBlade,
  WatchBackChevron,
  WatchFace,
  type WatchTone,
} from './trail/WatchButton';

type BaseProps = Omit<PressableProps, 'children' | 'style'> & {
  accessibilityLabel: string;
  tone?: WatchTone;
  style?: StyleProp<ViewStyle>;
};

type Props = BaseProps & (
  /** GPS-watch button: notched bezel around a domed push button. */
  | { variant?: 'watch'; icon: ReactNode }
  /** "Back" in green headers: small forest sign blade pointing left. `tone` is ignored. */
  | { variant: 'back'; icon?: ReactNode }
);

/**
 * Short unlabelled action, always with an accessibility label. Drawn as a
 * GPS-watch button (48pt). Tones: neutral (white dome), brand (sage dome),
 * danger (red dome: pass a light icon, e.g. `colors.text.inverse`).
 */
export function IconAction({ accessibilityLabel, icon, tone = 'neutral', variant = 'watch', disabled, style, ...props }: Props) {
  const isBack = variant === 'back';
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
            <WatchBackBlade />
            <View style={styles.bladeIcon}>{icon ?? <WatchBackChevron />}</View>
          </>
        ) : (
          <>
            <WatchFace pressed={isPressed} tone={tone} />
            <View style={[styles.watchIcon, isPressed && styles.watchIconPressed]}>{icon}</View>
          </>
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
  watchIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The dome sinks flush with the bezel when pressed.
  watchIconPressed: {
    transform: [{ translateY: 1 }],
  },
  blade: {
    width: WATCH_BLADE_WIDTH,
    height: WATCH_BLADE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: WATCH_BLADE_TIP / 1.6,
  },
  bladeIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bladePressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});

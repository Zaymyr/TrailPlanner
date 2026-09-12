import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './themed/Text';
import { Colors } from '../constants/colors';

const APP_MARK = require('../assets/adaptive-icon.png');

type LaunchAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

type AppLaunchScreenProps = {
  title: string;
  subtitle: string;
  progress?: number;
  detail?: string | null;
  showSpinner?: boolean;
  isCompleting?: boolean;
  isFinishing?: boolean;
  primaryAction?: LaunchAction;
  secondaryAction?: LaunchAction;
};

export function AppLaunchScreen({
  title,
  subtitle,
  progress = 0.18,
  detail,
  isCompleting = false,
  isFinishing = false,
  primaryAction,
  secondaryAction,
}: AppLaunchScreenProps) {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const screenOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const logoOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(isFinishing ? 1 : 0.86)).current;
  const logoTranslateY = useRef(new Animated.Value(isFinishing ? 0 : 10)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const showRecovery = Boolean(primaryAction || secondaryAction);
  const accessibilityProgress = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionEnabled(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 280 : 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 180 : 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: isCompleting ? 1.06 : 1,
        damping: 14,
        stiffness: 130,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: isFinishing ? -8 : 0,
        duration: isFinishing ? 280 : 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isCompleting, isFinishing, logoOpacity, logoScale, logoTranslateY, screenOpacity]);

  useEffect(() => {
    pulse.stopAnimation();

    if (reduceMotionEnabled || isCompleting || isFinishing) {
      pulse.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isCompleting, isFinishing, pulse, reduceMotionEnabled]);

  const breathingScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.22],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0.18, 0],
  });

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]} testID="app-launch-splash">
      <Animated.View
        accessible
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: accessibilityProgress }}
        style={[
          styles.brand,
          {
            opacity: logoOpacity,
            transform: [
              { translateY: logoTranslateY },
              { scale: Animated.multiply(logoScale, breathingScale) },
            ],
          },
        ]}
      >
        <View style={styles.markFrame}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                opacity: haloOpacity,
                transform: [{ scale: haloScale }],
              },
            ]}
          />
          <Animated.Image source={APP_MARK} resizeMode="contain" style={styles.mark} />
        </View>
        <Text style={styles.wordmark}>Pace Yourself</Text>
      </Animated.View>

      {showRecovery ? (
        <View style={styles.recoveryCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
          <View style={styles.actions}>
            {primaryAction ? <LaunchButton {...primaryAction} /> : null}
            {secondaryAction ? <LaunchButton {...secondaryAction} /> : null}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

function LaunchButton({ label, onPress, variant = 'primary' }: LaunchAction) {
  const secondary = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.buttonSecondary : styles.buttonPrimary,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : styles.buttonTextPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7EFE8',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
  },
  markFrame: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.brandPrimary,
  },
  mark: {
    width: 210,
    height: 210,
  },
  wordmark: {
    color: Colors.brandPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -1.1,
    marginTop: -8,
  },
  recoveryCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 36,
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    padding: 18,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  detail: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: Colors.brandPrimary,
  },
  buttonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: Colors.textOnBrand,
  },
  buttonTextSecondary: {
    color: Colors.textPrimary,
  },
});

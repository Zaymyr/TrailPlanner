import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

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
  showSpinner = true,
  isCompleting = false,
  isFinishing = false,
  primaryAction,
  secondaryAction,
}: AppLaunchScreenProps) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(new Animated.Value(isFinishing ? safeProgress : 0)).current;
  const screenOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const cardOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const cardTranslateY = useRef(new Animated.Value(isFinishing ? 0 : 16)).current;
  const cardScale = useRef(new Animated.Value(isFinishing ? 1 : 0.985)).current;
  const highestProgressRef = useRef(isFinishing ? safeProgress : 0);

  useEffect(() => {
    const nextProgress = Math.max(highestProgressRef.current, safeProgress);
    highestProgressRef.current = nextProgress;

    Animated.timing(animatedProgress, {
      toValue: nextProgress,
      duration: isFinishing || isCompleting ? 220 : 520,
      easing: isFinishing || isCompleting ? Easing.out(Easing.cubic) : Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, isCompleting, isFinishing, safeProgress]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 280 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 220 : 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: isFinishing ? -10 : 0,
        duration: isFinishing ? 280 : 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: isFinishing ? 0.992 : 1,
        duration: isFinishing ? 280 : 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardScale, cardTranslateY, isFinishing, screenOpacity]);

  const animatedProgressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
          },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Pace Yourself</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: animatedProgressWidth }]} />
        </View>

        {showSpinner ? <ActivityIndicator size="small" color={Colors.brandPrimary} style={styles.spinner} /> : null}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}

        {primaryAction || secondaryAction ? (
          <View style={styles.actions}>
            {primaryAction ? <LaunchButton {...primaryAction} /> : null}
            {secondaryAction ? <LaunchButton {...secondaryAction} /> : null}
          </View>
        ) : null}
      </Animated.View>
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
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'stretch',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 16,
  },
  badgeText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  progressTrack: {
    height: 10,
    marginTop: 20,
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  spinner: {
    marginTop: 18,
  },
  detail: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 20,
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 8,
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

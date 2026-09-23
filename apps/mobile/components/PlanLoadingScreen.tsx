import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { TrailIcon } from '@pace-yourself/design-system';

import { Colors } from '../constants/colors';
import { useI18n } from '../lib/i18n';
import { Text } from './themed/Text';

export type PlanLoadingVariant = 'list' | 'create' | 'edit' | 'summary' | 'live';

type Props = {
  planName?: string | null;
  progress: number;
  variant: PlanLoadingVariant;
  isFinishing?: boolean;
};

export function PlanLoadingScreen({
  planName,
  progress,
  variant,
  isFinishing = false,
}: Props) {
  const { t } = useI18n();
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const screenOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const contentOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const contentTranslateY = useRef(new Animated.Value(isFinishing ? 0 : 12)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const safeProgress = Math.max(0, Math.min(1, progress));

  const title =
    variant === 'list'
      ? t.planLoading.listTitle
      : variant === 'create'
      ? t.planLoading.createTitle
      : variant === 'summary'
        ? t.planLoading.summaryTitle
        : variant === 'live'
          ? t.planLoading.liveTitle
          : t.planLoading.editTitle;
  const stage =
    safeProgress < 0.35
      ? t.planLoading.starting
      : safeProgress < 0.75
        ? t.planLoading.preparing
        : t.planLoading.finalizing;

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
    const timer = setTimeout(() => setShowSlowHint(true), 6_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    screenOpacity.stopAnimation();
    contentOpacity.stopAnimation();
    contentTranslateY.stopAnimation();

    if (reduceMotionEnabled) {
      screenOpacity.setValue(isFinishing ? 0 : 1);
      contentOpacity.setValue(isFinishing ? 0 : 1);
      contentTranslateY.setValue(isFinishing ? -6 : 0);
      return;
    }

    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 240 : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 180 : 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: isFinishing ? -6 : 0,
        duration: isFinishing ? 240 : 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslateY, isFinishing, reduceMotionEnabled, screenOpacity]);

  useEffect(() => {
    pulse.stopAnimation();
    if (reduceMotionEnabled || isFinishing) {
      pulse.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1_050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1_050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isFinishing, pulse, reduceMotionEnabled]);

  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.16],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.08, 0.2, 0.08],
  });

  return (
    <Animated.View
      style={[styles.screen, { opacity: screenOpacity }]}
      testID="plan-loading-screen"
    >
      <Animated.View
        accessible
        accessibilityLabel={`${title}. ${planName ? `${planName}. ` : ''}${stage}`}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        <View style={styles.iconFrame}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.iconHalo,
              { opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />
          <Animated.View style={[styles.iconDisc, { transform: [{ scale: iconScale }] }]}>
            <TrailIcon color={Colors.brandPrimary} size={42} strokeWidth={1.9} />
          </Animated.View>
        </View>

        <Text style={styles.eyebrow}>PACE YOURSELF</Text>
        <Text style={styles.title}>{title}</Text>
        {planName ? <Text numberOfLines={2} style={styles.planName}>{planName}</Text> : null}

        <View style={styles.statusCard}>
          <ActivityIndicator color={Colors.brandPrimary} size="small" />
          <Text style={styles.stage}>{stage}</Text>
        </View>
        {showSlowHint ? <Text style={styles.slowHint}>{t.planLoading.slowHint}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 28,
  },
  content: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconFrame: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.brandPrimary,
  },
  iconDisc: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  eyebrow: {
    marginTop: 18,
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 8,
    color: Colors.textPrimary,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
  },
  planName: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusCard: {
    width: '100%',
    minHeight: 56,
    marginTop: 28,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  stage: {
    flexShrink: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  slowHint: {
    marginTop: 14,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

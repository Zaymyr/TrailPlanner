import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Colors } from '../constants/colors';

type Props = {
  planName?: string | null;
  progress: number;
  title: string;
  stage: string;
  isFinishing?: boolean;
};

export function PlanLoadingScreen({
  planName,
  progress,
  title,
  stage,
  isFinishing = false,
}: Props) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(new Animated.Value(isFinishing ? safeProgress : 0)).current;
  const containerOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const cardOpacity = useRef(new Animated.Value(isFinishing ? 1 : 0)).current;
  const cardTranslateY = useRef(new Animated.Value(isFinishing ? 0 : 18)).current;
  const highestProgressRef = useRef(isFinishing ? safeProgress : 0);

  useEffect(() => {
    const nextProgress = Math.max(highestProgressRef.current, safeProgress);
    highestProgressRef.current = nextProgress;

    Animated.timing(animatedProgress, {
      toValue: nextProgress,
      duration: isFinishing ? 220 : 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, isFinishing, safeProgress]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 260 : 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: isFinishing ? 0 : 1,
        duration: isFinishing ? 220 : 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: isFinishing ? -8 : 0,
        duration: isFinishing ? 260 : 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardTranslateY, containerOpacity, isFinishing]);

  const animatedProgressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.loadingScreen, { opacity: containerOpacity }]}>
      <Animated.View
        style={[
          styles.loadingCard,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
        <Text style={styles.loadingTitle}>{title}</Text>
        {planName ? <Text style={styles.loadingPlanName}>{planName}</Text> : null}
        <View style={styles.loadingProgressTrack}>
          <Animated.View style={[styles.loadingProgressFill, { width: animatedProgressWidth }]} />
        </View>
        <Text style={styles.loadingStage}>{stage}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 24,
    alignItems: 'center',
  },
  loadingTitle: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
  loadingPlanName: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
    marginTop: 22,
  },
  loadingProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  loadingStage: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});

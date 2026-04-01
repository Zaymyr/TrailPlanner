import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { styles } from './styles';

export type GaugeMetric = {
  key: 'carbs' | 'sodium' | 'water';
  label: string;
  unit: string;
  color: string;
  current: number;
  target: number;
  ratio: number;
  statusRatio?: number;
};

type Props = {
  metric: GaugeMetric;
  formatGaugeValue: (metric: GaugeMetric, value: number) => string;
  getGaugeColor: (key: GaugeMetric['key'], ratio: number) => string;
  compact?: boolean;
  animateSignal?: number;
};

const PRIMARY_SEGMENTS = 28;
const OVERFLOW_SEGMENTS = 14;
const MAX_VISUAL_RATIO = 2;
const BASE_SEGMENT_COLOR = '#D7D4CC';
const BASE_SEGMENT_OPACITY = 0.35;

function darkenHex(hex: string, factor = 0.55): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#1f2937';
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
  return `#${Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0')}${Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0')}${Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0')}`;
}

function RingSegment({
  angle,
  radius,
  width,
  height,
  color,
  opacity,
  scale,
}: {
  angle: number;
  radius: number;
  width: number;
  height: number;
  color: string;
  opacity: number | Animated.AnimatedInterpolation<number>;
  scale?: number | Animated.AnimatedInterpolation<number>;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      <Animated.View
        style={{
          width,
          height,
          borderRadius: width / 2,
          backgroundColor: color,
          opacity,
          transform: [{ translateY: -radius }, { scale: scale ?? 1 }],
        }}
      />
    </View>
  );
}

export function GaugeArc({ metric, formatGaugeValue, getGaugeColor, compact = false, animateSignal = 0 }: Props) {
  const size = compact ? 32 : 66;
  const center = size / 2;
  const innerRadius = compact ? 11 : 24;
  const overflowRadius = compact ? 15 : 31;
  const safeRatio = Number.isFinite(metric.ratio) ? Math.max(0, metric.ratio) : 0;
  const safeStatusRatio = Number.isFinite(metric.statusRatio) ? Math.max(0, metric.statusRatio ?? 0) : safeRatio;
  const visualRatio = Math.min(safeRatio, MAX_VISUAL_RATIO);
  const displayPct = metric.target > 0 ? Math.round((metric.current / metric.target) * 100) : 0;
  const animatedRatio = useRef(new Animated.Value(visualRatio)).current;
  const hasMounted = useRef(false);
  const lastAnimateSignal = useRef(animateSignal);
  const [isAnimating, setIsAnimating] = useState(false);

  const fillColor = getGaugeColor(metric.key, safeStatusRatio);
  const overflowColor = darkenHex(fillColor);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      lastAnimateSignal.current = animateSignal;
      animatedRatio.setValue(visualRatio);
      return;
    }

    const shouldAnimate = animateSignal > 0 && animateSignal !== lastAnimateSignal.current;
    lastAnimateSignal.current = animateSignal;

    if (!shouldAnimate) {
      animatedRatio.stopAnimation();
      animatedRatio.setValue(visualRatio);
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    Animated.timing(animatedRatio, {
      toValue: visualRatio,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setIsAnimating(false);
    });
  }, [animateSignal, animatedRatio, visualRatio]);

  return (
    <View style={styles.gaugeCard}>
      {!compact && <Text style={styles.gaugeLabel}>{metric.label}</Text>}
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: PRIMARY_SEGMENTS }, (_, index) => {
          const angle = -90 + (360 / PRIMARY_SEGMENTS) * index;
          const start = index / PRIMARY_SEGMENTS;
          const end = (index + 1) / PRIMARY_SEGMENTS;
          const staticOpacity = visualRatio >= end ? 1 : visualRatio <= start ? 0 : (visualRatio - start) / Math.max(end - start, 0.0001);
          const opacity = isAnimating
            ? animatedRatio.interpolate({
                inputRange: [0, start, end, MAX_VISUAL_RATIO],
                outputRange: [0, 0, 1, 1],
                extrapolate: 'clamp',
              })
            : staticOpacity;
          const scale = isAnimating
            ? animatedRatio.interpolate({
                inputRange: [0, start, end, MAX_VISUAL_RATIO],
                outputRange: [0.75, 0.75, 1, 1],
                extrapolate: 'clamp',
              })
            : 0.75 + staticOpacity * 0.25;

          return (
            <React.Fragment key={`primary-${index}`}>
              <RingSegment
                angle={angle}
                radius={innerRadius}
                width={compact ? 3 : 4}
                height={compact ? 7 : 12}
                color={BASE_SEGMENT_COLOR}
                opacity={BASE_SEGMENT_OPACITY}
              />
              <RingSegment
                angle={angle}
                radius={innerRadius}
                width={compact ? 3 : 4}
                height={compact ? 7 : 12}
                color={fillColor}
                opacity={opacity}
                scale={scale}
              />
            </React.Fragment>
          );
        })}

        {Array.from({ length: OVERFLOW_SEGMENTS }, (_, index) => {
          const angle = -90 + (360 / OVERFLOW_SEGMENTS) * index;
          const start = 1 + index / OVERFLOW_SEGMENTS;
          const end = 1 + (index + 1) / OVERFLOW_SEGMENTS;
          const overflowProgress =
            visualRatio >= end ? 1 : visualRatio <= start ? 0 : (visualRatio - start) / Math.max(end - start, 0.0001);
          const opacity = isAnimating
            ? animatedRatio.interpolate({
                inputRange: [0, 1, start, end, MAX_VISUAL_RATIO],
                outputRange: [0, 0, 0, 1, 1],
                extrapolate: 'clamp',
              })
            : overflowProgress;
          const scale = isAnimating
            ? animatedRatio.interpolate({
                inputRange: [0, 1, start, end, MAX_VISUAL_RATIO],
                outputRange: [0.7, 0.7, 0.7, 1, 1],
                extrapolate: 'clamp',
              })
            : 0.7 + overflowProgress * 0.3;

          return (
            <RingSegment
              key={`overflow-${index}`}
              angle={angle}
              radius={overflowRadius}
              width={compact ? 2 : 3}
              height={compact ? 5 : 8}
              color={overflowColor}
              opacity={opacity}
              scale={scale}
            />
          );
        })}

        <View
          style={{
            position: 'absolute',
            width: center,
            height: center,
            borderRadius: center / 2,
            backgroundColor: '#F7F6F2',
            borderWidth: 1,
            borderColor: '#E7E2D8',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          {!compact && (
            <Text style={{ fontSize: 12, fontWeight: '800', color: fillColor }}>{displayPct}%</Text>
          )}
        </View>
      </View>

      {!compact && (
        <Text style={styles.gaugeValueCaption}>Emporte / Besoin</Text>
      )}

      {!compact && (
        <Text style={styles.gaugeValue}>
          {formatGaugeValue(metric, metric.current)} / {formatGaugeValue(metric, metric.target)}
        </Text>
      )}
    </View>
  );
}

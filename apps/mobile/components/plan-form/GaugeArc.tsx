import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
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

const MAX_VISUAL_RATIO = 1;
const RING_TRACK_COLOR = '#DCD8CF';
const RING_TRACK_OVERFLOW_COLOR = '#C9C2B4';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function darkenHex(hex: string, factor = 0.55): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#1f2937';
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
  return `#${Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0')}${Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0')}${Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0')}`;
}

export const GaugeArc = React.memo(function GaugeArc({
  metric,
  formatGaugeValue,
  getGaugeColor,
  compact = false,
  animateSignal = 0,
}: Props) {
  const size = compact ? 32 : 68;
  const center = size / 2;
  const strokeWidth = compact ? 4 : 5;
  const radius = compact ? 13 : 28;
  const overflowRadius = radius + 4;
  const circumference = 2 * Math.PI * radius;
  const overflowCircumference = 2 * Math.PI * overflowRadius;
  const safeRatio = Number.isFinite(metric.ratio) ? Math.max(0, metric.ratio) : 0;
  const safeStatusRatio = Number.isFinite(metric.statusRatio) ? Math.max(0, metric.statusRatio ?? 0) : safeRatio;
  const visualRatio = Math.min(safeRatio, MAX_VISUAL_RATIO);
  const overflowVisualRatio = Math.min(Math.max(safeRatio - 1, 0), 1);
  const displayPct = metric.target > 0 ? Math.round((metric.current / metric.target) * 100) : 0;
  const animatedRatio = useRef(new Animated.Value(visualRatio)).current;
  const hasMounted = useRef(false);
  const lastAnimateSignal = useRef(animateSignal);

  const fillColor = getGaugeColor(metric.key, safeStatusRatio);
  const overflowColor = darkenHex(fillColor);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      lastAnimateSignal.current = animateSignal;
      animatedRatio.setValue(visualRatio);
      return;
    }

    const shouldAnimate = !compact && animateSignal > 0 && animateSignal !== lastAnimateSignal.current;
    lastAnimateSignal.current = animateSignal;

    if (!shouldAnimate) {
      animatedRatio.stopAnimation();
      animatedRatio.setValue(visualRatio);
      return;
    }

    Animated.timing(animatedRatio, {
      toValue: visualRatio,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animateSignal, animatedRatio, compact, visualRatio]);

  const dashOffset = compact
    ? circumference * (1 - visualRatio)
    : animatedRatio.interpolate({
        inputRange: [0, MAX_VISUAL_RATIO],
        outputRange: [circumference, 0],
        extrapolate: 'clamp',
      });
  const centerSize = compact ? 18 : 44;
  const percentFontSize = displayPct >= 1000 ? 10 : displayPct >= 100 ? 11 : 12;

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
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {!compact && overflowVisualRatio > 0 ? (
            <>
              <Circle
                cx={center}
                cy={center}
                r={overflowRadius}
                stroke={RING_TRACK_OVERFLOW_COLOR}
                strokeWidth={2}
                fill="none"
                opacity={0.28}
              />
              <Circle
                cx={center}
                cy={center}
                r={overflowRadius}
                stroke={overflowColor}
                strokeWidth={2}
                fill="none"
                strokeDasharray={`${overflowCircumference} ${overflowCircumference}`}
                strokeDashoffset={overflowCircumference * (1 - overflowVisualRatio)}
                strokeLinecap="round"
                opacity={0.5}
                transform={`rotate(-90 ${center} ${center})`}
              />
            </>
          ) : null}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={RING_TRACK_COLOR}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.9}
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={fillColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset as unknown as number}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>

        <View
          style={{
            position: 'absolute',
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!compact && (
            <DataText
              weight="bold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              style={{
                maxWidth: centerSize - 7,
                color: fillColor,
                fontSize: percentFontSize,
                textAlign: 'center',
              }}
            >
              {displayPct}%
            </DataText>
          )}
        </View>
      </View>

      {!compact && (
        <Text style={styles.gaugeValueCaption}>Emporte / Besoin</Text>
      )}

      {!compact && (
        <DataText weight="bold" style={styles.gaugeValue}>
          {formatGaugeValue(metric, metric.current)} / {formatGaugeValue(metric, metric.target)}
        </DataText>
      )}
    </View>
  );
}, (prev, next) => {
  return (
    prev.compact === next.compact &&
    prev.animateSignal === next.animateSignal &&
    prev.metric.current === next.metric.current &&
    prev.metric.target === next.metric.target &&
    prev.metric.ratio === next.metric.ratio &&
    prev.metric.statusRatio === next.metric.statusRatio &&
    prev.metric.label === next.metric.label &&
    prev.metric.unit === next.metric.unit &&
    prev.metric.key === next.metric.key &&
    prev.formatGaugeValue === next.formatGaugeValue &&
    prev.getGaugeColor === next.getGaugeColor
  );
});

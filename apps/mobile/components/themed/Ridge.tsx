import { colors, mobileComponents } from '@pace-yourself/design-system';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/useReduceMotion';
import {
  SIGNATURE_RIDGE,
  buildRidgeAreaPath,
  buildRidgePath,
  resampleProfile,
  ridgeLength,
  ridgeSummit,
  type TrailProfilePoint,
} from '../../lib/trailSignature';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const STROKE = mobileComponents.ridge.strokeWidth;

/** Resolves a course profile into ridge samples, falling back to the brand ridge. */
export function useRidgeValues(
  profile?: readonly TrailProfilePoint[] | null,
  samples: number = mobileComponents.ridge.samples,
): readonly number[] {
  return useMemo(() => resampleProfile(profile, samples) ?? SIGNATURE_RIDGE, [profile, samples]);
}

function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  };
  return { width, onLayout };
}

type MeasuredProps = {
  height: number;
  style?: StyleProp<ViewStyle>;
  children: (width: number) => ReactNode;
};

/** Lays out at full width, then draws once the width is known. */
function Measured({ height, style, children }: MeasuredProps) {
  const { width, onLayout } = useMeasuredWidth();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      pointerEvents="none"
      style={[{ height, alignSelf: 'stretch' }, style]}
    >
      {width > 0 ? children(width) : null}
    </View>
  );
}

type DividerProps = {
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/** A thin ridge line that replaces flat separators between major blocks. */
export function RidgeDivider({ color = colors.border.strong, opacity = 0.9, style }: DividerProps) {
  const height = mobileComponents.ridge.dividerHeight;
  return (
    <Measured height={height} style={style}>
      {(width) => (
        <Svg height={height} width={width}>
          <Path
            d={buildRidgePath(SIGNATURE_RIDGE, { width, height, inset: STROKE })}
            fill="none"
            opacity={opacity}
            stroke={color}
            strokeLinecap="round"
            strokeWidth={1.5}
          />
        </Svg>
      )}
    </Measured>
  );
}

type LoaderProps = {
  color?: string;
  trackColor?: string;
  height?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The signature busy indicator: the brand ridge drawing itself, looping.
 * Falls back to a static ridge when the user prefers reduced motion.
 */
export function RidgeLoader({
  color = colors.brand.forest,
  trackColor = colors.border.subtle,
  height = mobileComponents.ridge.loaderHeight,
  width = 120,
  style,
}: LoaderProps) {
  const reduceMotion = useReduceMotion();
  const frame = { width, height, inset: STROKE + 1 };
  const line = buildRidgePath(SIGNATURE_RIDGE, frame);
  const length = ridgeLength(SIGNATURE_RIDGE, frame);
  const draw = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      draw.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(draw, {
          toValue: 1,
          duration: mobileComponents.ridge.loaderDurationMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(draw, {
          toValue: 2,
          duration: mobileComponents.ridge.loaderDurationMs * 0.6,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    );
    draw.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [draw, reduceMotion]);

  // 0 -> 1 draws the ridge in; 1 -> 2 erases it from the start.
  const dashOffset = draw.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [length, 0, -length],
  });

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width, height }, style]}
    >
      <Svg height={height} width={width}>
        <Path d={line} fill="none" stroke={trackColor} strokeLinecap="round" strokeWidth={STROKE} />
        <AnimatedPath
          d={line}
          fill="none"
          stroke={color}
          strokeDasharray={[length, length]}
          strokeDashoffset={reduceMotion ? 0 : dashOffset}
          strokeLinecap="round"
          strokeWidth={STROKE + 0.5}
        />
      </Svg>
    </View>
  );
}

type SilhouetteProps = {
  /** Real course profile; the brand ridge is used when absent or unusable. */
  profile?: readonly TrailProfilePoint[] | null;
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  height?: number;
  showSummit?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The course's own skyline: a compact filled silhouette of its elevation
 * profile. Identity only — exact figures stay in the profile chart.
 */
export function CourseRidge({
  profile,
  color = colors.brand.forest,
  fillColor = colors.brand.surface,
  fillOpacity = 1,
  height = mobileComponents.ridge.silhouetteHeight,
  showSummit = true,
  style,
}: SilhouetteProps) {
  const values = useRidgeValues(profile);
  return (
    <Measured height={height} style={style}>
      {(width) => {
        const frame = { width, height, inset: STROKE + 3 };
        const summit = ridgeSummit(values, frame);
        return (
          <Svg height={height} width={width}>
            <Path d={buildRidgeAreaPath(values, frame)} fill={fillColor} opacity={fillOpacity} />
            <Path
              d={buildRidgePath(values, frame)}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
            {showSummit && summit.index >= 0 ? (
              <Circle cx={summit.x} cy={summit.y} fill={color} r={2.5} />
            ) : null}
          </Svg>
        );
      }}
    </Measured>
  );
}

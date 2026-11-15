import { colors, mobileComponents, shadows, spacing } from '@pace-yourself/design-system';
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/useReduceMotion';
import { successHaptic } from '../../lib/haptics';
import {
  SIGNATURE_RIDGE,
  buildRidgeAreaPath,
  buildRidgePath,
  resampleProfile,
  ridgeLength,
  ridgeSummit,
  type TrailProfilePoint,
} from '../../lib/trailSignature';
import { Heading } from './Heading';
import { Text } from './Text';
import { TrailBlaze } from './TrailBlaze';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const RIDGE_WIDTH = 248;
const RIDGE_HEIGHT = 72;
const FLAG_HEIGHT = 22;
const VISIBLE_MS = 2600;

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  dismissLabel: string;
  profile?: readonly TrailProfilePoint[] | null;
  onDone: () => void;
};

/**
 * One-off reward when a plan is ready: the course ridge draws itself and a
 * flag is planted on its summit. Tap anywhere to dismiss; it also leaves on
 * its own. Reduced motion shows the finished drawing without animation.
 */
export function SummitCelebration({ visible, title, subtitle, dismissLabel, profile, onDone }: Props) {
  const reduceMotion = useReduceMotion();
  const values = useMemo(() => resampleProfile(profile, mobileComponents.ridge.samples) ?? SIGNATURE_RIDGE, [profile]);
  const frame = { width: RIDGE_WIDTH, height: RIDGE_HEIGHT, inset: 4 };
  const line = buildRidgePath(values, frame);
  const area = buildRidgeAreaPath(values, frame);
  const length = ridgeLength(values, frame);
  const summit = ridgeSummit(values, frame);

  const backdrop = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(0)).current;
  const flag = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!visible) return undefined;
    void successHaptic();
    AccessibilityInfo.announceForAccessibility(subtitle ? `${title}. ${subtitle}` : title);

    if (reduceMotion) {
      backdrop.setValue(1);
      draw.setValue(1);
      flag.setValue(1);
    } else {
      backdrop.setValue(0);
      draw.setValue(0);
      flag.setValue(0);
      Animated.sequence([
        Animated.timing(backdrop, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(draw, {
          toValue: 1,
          duration: mobileComponents.ridge.celebrationDurationMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(flag, { toValue: 1, damping: 9, stiffness: 180, mass: 0.7, useNativeDriver: false }),
      ]).start();
    }

    const timer = setTimeout(() => onDoneRef.current(), VISIBLE_MS + (reduceMotion ? 0 : mobileComponents.ridge.celebrationDurationMs));
    return () => clearTimeout(timer);
  }, [backdrop, draw, flag, reduceMotion, subtitle, title, visible]);

  if (!visible) return null;

  const dashOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });
  const fillOpacity = draw.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] });
  const flagScale = flag.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={[styles.overlay, { opacity: backdrop }]}>
      <Pressable
        accessibilityLabel={dismissLabel}
        accessibilityRole="button"
        onPress={() => onDoneRef.current()}
        style={styles.pressArea}
        testID="summit-celebration"
      >
        <View style={styles.card}>
          <View style={styles.ridgeFrame}>
            <Svg height={RIDGE_HEIGHT} width={RIDGE_WIDTH}>
              <AnimatedPath d={area} fill={colors.brand.surface} opacity={fillOpacity} />
              <AnimatedPath
                d={line}
                fill="none"
                stroke={colors.brand.forest}
                strokeDasharray={[length, length]}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
              />
            </Svg>
            <Animated.View
              style={[
                styles.flag,
                {
                  left: summit.x - 1,
                  top: summit.y - FLAG_HEIGHT,
                  transform: [{ translateY: FLAG_HEIGHT / 2 }, { scale: flagScale }, { translateY: -FLAG_HEIGHT / 2 }],
                },
              ]}
            >
              <View style={styles.flagPole} />
              <TrailBlaze size="md" style={styles.flagCloth} />
            </Animated.View>
          </View>
          <Heading accessibilityRole="header" style={styles.centered} variant="h2">{title}</Heading>
          {subtitle ? <Text tone="secondary" style={styles.centered}>{subtitle}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    backgroundColor: 'rgba(31, 36, 16, 0.38)',
  },
  pressArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
    borderRadius: mobileComponents.cardRadius,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.surface.cream,
    boxShadow: shadows.lg,
  },
  ridgeFrame: {
    width: RIDGE_WIDTH,
    height: RIDGE_HEIGHT,
    marginBottom: spacing[2],
  },
  flag: {
    position: 'absolute',
    height: FLAG_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  flagPole: {
    width: 2,
    height: FLAG_HEIGHT,
    borderRadius: 1,
    backgroundColor: colors.text.primary,
  },
  flagCloth: { marginTop: 1 },
  centered: { textAlign: 'center' },
});

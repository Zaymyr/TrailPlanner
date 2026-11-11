import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/useReduceMotion';
import { Text } from './Text';
import { createTrailRandom } from '../../lib/trailSignature';
import { BlazeLine } from './TrailBlaze';
import { SignPlate } from './TrailSignButton';
import { useTrailSeed } from './TrailSeedProvider';

export type TrailTab<T extends string> = {
  key: T;
  label: string;
  accessibilityLabel?: string;
  /** Small trailing adornment such as an unread dot. */
  trailing?: ReactNode;
  testID?: string;
};

type Props<T extends string> = {
  tabs: TrailTab<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  /** Lets the row scroll horizontally when labels overflow. */
  scrollable?: boolean;
  /** Spreads tabs evenly across the width (fixed short tab sets). */
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Leg = { x: number; width: number; height: number };

const { minHeight, trackHeight, paddingHorizontal } = mobileComponents.trailTabs;
const { dash, gap } = mobileComponents.timeline;
const PLANK_INSET = 4;

/**
 * In-page tabs drawn as a trail, centered across the width: labels sit on a
 * dotted path, the active label is painted on a small wooden plank and the
 * active leg of the path becomes the tri-color signature line (light green,
 * amber, dark green in the blaze proportions). Selection is carried by label
 * weight, color, plank and line together, never by color alone.
 */
export function TrailTabs<T extends string>({
  tabs,
  activeKey,
  onChange,
  scrollable = false,
  stretch = false,
  style,
}: Props<T>) {
  const reduceMotion = useReduceMotion();
  // Planks lean less than signs (they carry the label being read).
  const trailSeed = useTrailSeed();
  const [legs, setLegs] = useState<Partial<Record<T, Leg>>>({});
  const [rowWidth, setRowWidth] = useState(0);
  const legX = useRef(new Animated.Value(0)).current;
  const legWidth = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const activeLeg = legs[activeKey];

  useEffect(() => {
    if (!activeLeg) return;
    if (!placed.current || reduceMotion) {
      legX.setValue(activeLeg.x);
      legWidth.setValue(activeLeg.width);
      placed.current = true;
      return;
    }
    const config = {
      duration: mobileComponents.motion.standardDurationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    };
    Animated.parallel([
      Animated.timing(legX, { ...config, toValue: activeLeg.x }),
      Animated.timing(legWidth, { ...config, toValue: activeLeg.width }),
    ]).start();
  }, [activeLeg, legWidth, legX, reduceMotion]);

  const handleTabLayout = (key: T) => (event: LayoutChangeEvent) => {
    const { x, width, height } = event.nativeEvent.layout;
    setLegs((current) => {
      const previous = current[key];
      if (previous && previous.x === x && previous.width === width && previous.height === height) return current;
      return { ...current, [key]: { x, width, height } };
    });
  };

  const row = (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setRowWidth(Math.round(event.nativeEvent.layout.width))}
      style={[styles.row, stretch ? styles.rowStretch : styles.rowCentered]}
    >
      {rowWidth > 0 ? (
        <Svg accessible={false} height={trackHeight} style={styles.track} width={rowWidth}>
          <Line
            stroke={colors.border.strong}
            strokeDasharray={[dash, gap]}
            strokeLinecap="round"
            strokeWidth={2}
            x1={1}
            x2={rowWidth - 1}
            y1={trackHeight / 2}
            y2={trackHeight / 2}
          />
        </Svg>
      ) : null}
      {activeLeg ? (
        <Animated.View
          accessible={false}
          pointerEvents="none"
          style={[styles.leg, { left: legX, width: legWidth }]}
        >
          <BlazeLine thickness={trackHeight} />
        </Animated.View>
      ) : null}
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const leg = legs[tab.key];
        return (
          <Pressable
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.key}
            onLayout={handleTabLayout(tab.key)}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              stretch && styles.tabStretch,
              // The active label sits on a slightly hand-set wooden plank.
              active && { transform: [{ rotate: `${createTrailRandom(trailSeed.seed, `tab|${tab.label}`, trailSeed.amount).lean('tilt', mobileComponents.trailVariation.tabPlank.tilt)}deg` }] },
              pressed && styles.pressed,
            ]}
            testID={tab.testID}
          >
            {active && leg ? (
              <SignPlate
                height={Math.max(0, leg.height - PLANK_INSET * 2)}
                shape="plank"
                style={styles.plank}
                variant="soft"
                width={Math.max(0, leg.width - PLANK_INSET * 2)}
              />
            ) : null}
            <Text
              numberOfLines={1}
              size="sm"
              weight={active ? 'bold' : 'semibold'}
              style={{ color: active ? colors.brand.forest : colors.text.secondary }}
            >
              {tab.label}
            </Text>
            {tab.trailing}
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return <View style={style}>{row}</View>;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
    >
      {row}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  row: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingBottom: trackHeight,
  },
  rowCentered: { justifyContent: 'center' },
  rowStretch: { justifyContent: 'space-between' },
  track: { position: 'absolute', left: 0, bottom: 0 },
  leg: {
    position: 'absolute',
    bottom: 0,
    height: trackHeight,
    paddingHorizontal: 4,
  },
  tab: {
    minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingHorizontal,
  },
  tabStretch: { flex: 1 },
  plank: { top: PLANK_INSET, left: PLANK_INSET },
  pressed: { opacity: 0.7 },
});

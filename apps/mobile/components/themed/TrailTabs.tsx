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
import { TrailBlaze } from './TrailBlaze';

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
  /** Active label and leg color; organizer-themed surfaces pass their primary. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

type Leg = { x: number; width: number };

const { minHeight, trackHeight, paddingHorizontal } = mobileComponents.trailTabs;
const { dash, gap } = mobileComponents.timeline;

/**
 * In-page tabs drawn as a trail: labels sit on a dotted path, the active leg
 * of the path is solid and its label starts with a vertical trail blaze.
 * Selection is carried by weight, color, blaze and leg together, never by
 * color alone.
 */
export function TrailTabs<T extends string>({
  tabs,
  activeKey,
  onChange,
  scrollable = false,
  stretch = false,
  color = colors.brand.forest,
  style,
}: Props<T>) {
  const reduceMotion = useReduceMotion();
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
    const { x, width } = event.nativeEvent.layout;
    setLegs((current) => {
      const previous = current[key];
      if (previous && previous.x === x && previous.width === width) return current;
      return { ...current, [key]: { x, width } };
    });
  };

  const row = (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setRowWidth(Math.round(event.nativeEvent.layout.width))}
      style={[styles.row, stretch && styles.rowStretch]}
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
          style={[styles.leg, { backgroundColor: color, left: legX, width: legWidth }]}
        />
      ) : null}
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.key}
            onLayout={handleTabLayout(tab.key)}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, stretch && styles.tabStretch, pressed && styles.pressed]}
            testID={tab.testID}
          >
            {/* Always laid out so labels never shift when the selection moves. */}
            <TrailBlaze orientation="vertical" size="sm" style={!active && styles.blazeHidden} />
            <Text
              numberOfLines={1}
              size="sm"
              weight={active ? 'bold' : 'semibold'}
              style={{ color: active ? color : colors.text.secondary }}
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
  rowStretch: { justifyContent: 'space-between' },
  track: { position: 'absolute', left: 0, bottom: 0 },
  leg: {
    position: 'absolute',
    bottom: 0,
    height: trackHeight,
    borderRadius: trackHeight,
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
  blazeHidden: { opacity: 0 },
  pressed: { opacity: 0.7 },
});

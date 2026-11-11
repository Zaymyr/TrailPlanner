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
  /**
   * Tabs share the full width in equal parts. With `scrollable`, each tab is
   * at least 1/n of the visible width and the row scrolls only when a label
   * does not fit its share.
   */
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Leg = { x: number; width: number; height: number };

const { minHeight, trackHeight, paddingHorizontal } = mobileComponents.trailTabs;
const { dash, gap } = mobileComponents.timeline;
const PLANK_INSET = 3;
/** Unselected planks sit a little lower and smaller than the active one. */
const FLAT_PLANK_INSET = 6;
const PLANK_DEPTH = mobileComponents.trailSign.depth;

/**
 * In-page tabs drawn as a trail: every label sits on a wooden plank along a
 * dotted path. The active one is a raised, painted plank (the `solid` trail
 * sign wood: grain, knot, routed groove, bevel, thickness, cast shadow, light
 * hand-set lean) with a bold light label, and the active leg of the path
 * becomes the tri-color signature line. Unselected tabs are flat bare-wood
 * planks (`muted` wood, no shadow) with a semibold secondary label. Selection
 * is carried by label weight, plank finish and relief and the line together,
 * never by color alone. Centered by default; `stretch` fills the width.
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
  const [viewportWidth, setViewportWidth] = useState(0);
  // Scrollable stretch: equal shares of the visible width, growing if needed.
  const minTabWidth = stretch && scrollable && viewportWidth > 0 ? Math.floor(viewportWidth / Math.max(1, tabs.length)) : 0;
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
              stretch && (scrollable ? { flexGrow: 1, minWidth: minTabWidth } : styles.tabStretch),
              // The active label sits on a slightly hand-set wooden plank.
              active && { transform: [{ rotate: `${createTrailRandom(trailSeed.seed, `tab|${tab.label}`, trailSeed.amount).lean('tilt', mobileComponents.trailVariation.tabPlank.tilt)}deg` }] },
              pressed && styles.pressed,
            ]}
            testID={tab.testID}
          >
            {leg ? (
              <SignPlate
                height={Math.max(0, leg.height - (active ? PLANK_INSET * 2 : FLAT_PLANK_INSET * 2) - PLANK_DEPTH)}
                raised={active}
                shape="plank"
                style={active ? styles.plank : styles.flatPlank}
                variant={active ? 'solid' : 'muted'}
                variationKey={`tab|${tab.key}|${active ? 'on' : 'off'}`}
                width={Math.max(0, leg.width - (active ? PLANK_INSET : FLAT_PLANK_INSET) * 2)}
              />
            ) : null}
            <Text
              numberOfLines={1}
              size="sm"
              weight={active ? 'bold' : 'semibold'}
              style={[styles.label, { color: active ? colors.text.inverse : colors.text.secondary }]}
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
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setViewportWidth((current) => (current === next ? current : next));
      }}
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
    // Keeps at least 10 points between the label and the plank edge.
    paddingHorizontal: Math.max(paddingHorizontal, FLAT_PLANK_INSET + 10),
  },
  tabStretch: { flex: 1 },
  plank: { top: PLANK_INSET, left: PLANK_INSET },
  flatPlank: { top: FLAT_PLANK_INSET, left: FLAT_PLANK_INSET },
  // Keeps the label centered on the plank face, above its thickness.
  label: { marginBottom: PLANK_DEPTH },
  pressed: { opacity: 0.7 },
});

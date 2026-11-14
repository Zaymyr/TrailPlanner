import { colors } from '@pace-yourself/design-system';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { DataText } from '../DataText';
import { CompassNeedle } from './MilestoneGlyphs';

/** Svg ids must stay plain: React ids contain colons. */
function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** IGN-style kilometre grid ink (normal / focused). Token candidates. */
export const NOTEBOOK_GRID_INK = 'rgba(63, 111, 143, 0.08)';
export const NOTEBOOK_GRID_INK_FOCUSED = 'rgba(45, 80, 22, 0.1)';
export const NOTEBOOK_GRID_STEP = 14;

/** Faint map grid filling its parent, behind a notebook field. Decorative. */
export function NotebookGrid({ focused = false }: { focused?: boolean }) {
  const id = useSvgId('nb-grid');
  const ink = focused ? NOTEBOOK_GRID_INK_FOCUSED : NOTEBOOK_GRID_INK;
  return (
    <Svg accessible={false} height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <Pattern height={NOTEBOOK_GRID_STEP} id={id} patternUnits="userSpaceOnUse" width={NOTEBOOK_GRID_STEP}>
          <Line stroke={ink} strokeWidth={1} x1={0} x2={NOTEBOOK_GRID_STEP} y1={0.5} y2={0.5} />
          <Line stroke={ink} strokeWidth={1} x1={0.5} x2={0.5} y1={0} y2={NOTEBOOK_GRID_STEP} />
        </Pattern>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" x={0} y={0} />
    </Svg>
  );
}

type StripesProps = {
  width: number;
  height: number;
  /** Background and stripe colors. */
  base: string;
  stripe: string;
  /** Horizontal width of one stripe. */
  stripeWidth: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Diagonal stripes (closed-trail tape / rubalise). Always diagonal so it can
 * never be read as the horizontal red/white GR waymark. Decorative.
 */
export function TapeStripes({ width, height, base, stripe, stripeWidth, style }: StripesProps) {
  const period = stripeWidth * 2;
  const bands: string[] = [];
  for (let x = -height; x < width + period; x += period) {
    bands.push(`M${x} 0 L${x + stripeWidth} 0 L${x + stripeWidth + height} ${height} L${x + height} ${height} Z`);
  }
  return (
    <Svg accessible={false} height={height} pointerEvents="none" style={style} viewBox={`0 0 ${width} ${height}`} width={width}>
      <Rect fill={base} height={height} width={width} />
      <Path d={bands.join(' ')} fill={stripe} />
    </Svg>
  );
}

export const NOTEBOOK_TAPE_WIDTH = 8;

/** Red/white tape strip down the left edge of a field in error. */
export function NotebookTape() {
  return (
    <View accessible={false} pointerEvents="none" style={styles.tape}>
      <TapeStripes
        base={colors.trail.tapeWhite}
        height={240}
        stripe={colors.trail.tapeRed}
        stripeWidth={7}
        width={NOTEBOOK_TAPE_WIDTH}
      />
    </View>
  );
}

/** Dashed compass ring leading the search notebook field. Decorative. */
export function NotebookCompassBadge() {
  return (
    <View accessible={false} pointerEvents="none" style={styles.compass}>
      <CompassNeedle rotate={35} size={22} />
      <DataText weight="bold" style={styles.north}>N</DataText>
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: NOTEBOOK_TAPE_WIDTH,
    overflow: 'hidden',
  },
  compass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.trail.stone,
    alignItems: 'center',
    justifyContent: 'center',
  },
  north: {
    position: 'absolute',
    top: -3,
    paddingHorizontal: 2,
    fontSize: 8,
    lineHeight: 10,
    color: colors.trail.pinRed,
    backgroundColor: colors.surface.white,
  },
});

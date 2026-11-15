import { colors } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { Text } from '../Text';
import { TapeStripes } from './NotebookParts';

/** Bib paper colors (mockup values; token candidates for `colors.trail`). */
export const BIB_COLORS = {
  paper: colors.surface.white,
  edge: colors.trail.braceletMuted,
  back: colors.trail.bibBack,
  hatch: 'rgba(138, 145, 126, 0.08)',
  perforation: colors.border.strong,
  pinWire: colors.text.tertiary,
  pinClasp: colors.trail.stone,
} as const;

const PIN_WIDTH = 22;
const PIN_HEIGHT = 9;

type PinCorner = 'topLeft' | 'topRight';

const PIN_PLACEMENT: Record<PinCorner, ViewStyle> = {
  topLeft: { left: -5, top: -4, transform: [{ rotate: '-30deg' }] },
  topRight: { right: -5, top: -4, transform: [{ rotate: '30deg' }, { scaleX: -1 }] },
};

/** One safety pin holding a top corner of the bib. Decorative. */
export function BibPin({ corner }: { corner: PinCorner }) {
  return (
    <Svg
      accessible={false}
      height={PIN_HEIGHT}
      pointerEvents="none"
      style={[styles.pin, PIN_PLACEMENT[corner]]}
      viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
      width={PIN_WIDTH}
    >
      <Path d="M5 4.5 L18 1.5 A3 3 0 0 1 18 7.5 L5 4.5" fill="none" stroke={BIB_COLORS.pinWire} strokeWidth={1.3} />
      <Rect fill={BIB_COLORS.pinClasp} height={3.4} rx={1} width={5} x={1} y={2.8} />
    </Svg>
  );
}

const CORNERS: PinCorner[] = ['topLeft', 'topRight'];

type PinnedProps = {
  label: string;
  lean: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The active bib, pinned on the front: white paper held by two safety pins,
 * one bold label and a single accent, the perforated tear-off line near the
 * foot. No header band nor number: the label is the only thing to read.
 */
export function PinnedBib({ label, lean, style }: PinnedProps) {
  return (
    <View style={[styles.pinned, lean ? { transform: [{ rotate: `${lean}deg` }] } : null, style]}>
      <Text numberOfLines={1} weight="bold" style={styles.label}>{label}</Text>
      <Svg accessible={false} height={2} pointerEvents="none" style={styles.perforation} width="100%">
        <Line stroke={BIB_COLORS.perforation} strokeDasharray={[3, 2]} strokeWidth={1.5} x1={0} x2="100%" y1={1} y2={1} />
      </Svg>
      {CORNERS.map((corner) => <BibPin corner={corner} key={corner} />)}
    </View>
  );
}

type FlippedProps = {
  label: string;
  lean: number;
  style?: StyleProp<ViewStyle>;
};

/** The other bib, flipped and tucked behind: hatched back, plain label. */
export function FlippedBib({ label, lean, style }: FlippedProps) {
  return (
    <View style={[styles.flipped, lean ? { transform: [{ rotate: `${lean}deg` }] } : null, style]}>
      <View accessible={false} pointerEvents="none" style={styles.hatch}>
        <TapeStripes base={BIB_COLORS.back} height={60} stripe={BIB_COLORS.hatch} stripeWidth={3} width={360} />
      </View>
      <Text numberOfLines={1} size="sm" weight="semibold" style={styles.flippedLabel}>{label}</Text>
    </View>
  );
}

const BIB_HEIGHT = 40;

const styles = StyleSheet.create({
  pin: { position: 'absolute' },
  pinned: {
    alignSelf: 'stretch',
    minHeight: BIB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    // Room for the tear-off line under the label.
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: BIB_COLORS.edge,
    borderRadius: 4,
    backgroundColor: BIB_COLORS.paper,
    shadowColor: colors.text.primary,
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: { flexShrink: 1, color: colors.brand.forest, fontSize: 15, lineHeight: 20 },
  perforation: { position: 'absolute', left: 6, right: 6, bottom: 6 },
  flipped: {
    alignSelf: 'stretch',
    minHeight: BIB_HEIGHT - 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BIB_COLORS.edge,
    borderRadius: 4,
    overflow: 'hidden',
  },
  hatch: { ...StyleSheet.absoluteFillObject },
  flippedLabel: { color: colors.text.secondary },
});

import { colors } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { DataText } from '../DataText';
import { Text } from '../Text';
import { BlazeLine } from '../TrailBlaze';
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

type PinCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const PIN_PLACEMENT: Record<PinCorner, ViewStyle> = {
  topLeft: { left: -6, top: -5, transform: [{ rotate: '-30deg' }] },
  topRight: { right: -6, top: -5, transform: [{ rotate: '30deg' }, { scaleX: -1 }] },
  bottomLeft: { left: -6, bottom: 6, transform: [{ rotate: '25deg' }] },
  bottomRight: { right: -6, bottom: 6, transform: [{ rotate: '-25deg' }, { scaleX: -1 }] },
};

/** One safety pin holding a corner of the bib. Decorative. */
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

const CORNERS: PinCorner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

type PinnedProps = {
  label: string;
  /** Decorative bib number printed above the label. */
  number: string;
  lean: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The active bib, pinned on the front: "PACE YOURSELF" header band, number
 * and label, signature line and a pre-cut tear-off foot, held by four pins.
 */
export function PinnedBib({ label, number, lean, style }: PinnedProps) {
  return (
    <View style={[styles.pinned, lean ? { transform: [{ rotate: `${lean}deg` }] } : null, style]}>
      <View accessible={false} style={styles.header}>
        <DataText weight="bold" style={styles.headerText}>PACE YOURSELF</DataText>
      </View>
      <View style={styles.body}>
        <DataText accessible={false} weight="bold" style={styles.number}>{number}</DataText>
        <Text numberOfLines={1} weight="bold" style={styles.label}>
          {label.toLocaleUpperCase('fr-FR')}
        </Text>
      </View>
      <BlazeLine style={styles.blaze} thickness={2} />
      <View accessible={false} pointerEvents="none" style={styles.foot}>
        <Svg height={2} style={styles.footLine} width="100%">
          <Line stroke={BIB_COLORS.perforation} strokeDasharray={[3, 2]} strokeWidth={1.5} x1={0} x2="100%" y1={1} y2={1} />
        </Svg>
        <View style={styles.footTab} />
      </View>
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
        <TapeStripes base={BIB_COLORS.back} height={80} stripe={BIB_COLORS.hatch} stripeWidth={3} width={360} />
      </View>
      <Text numberOfLines={1} size="sm" weight="bold" style={styles.flippedLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { position: 'absolute' },
  pinned: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: BIB_COLORS.edge,
    borderRadius: 4,
    backgroundColor: BIB_COLORS.paper,
    shadowColor: colors.text.primary,
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  header: {
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.brand.forest,
  },
  headerText: { color: colors.text.inverse, fontSize: 6.5, lineHeight: 8, letterSpacing: 1.3 },
  body: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 10,
  },
  number: { color: colors.text.primary, fontSize: 15, lineHeight: 18 },
  label: { flexShrink: 1, color: colors.brand.forest, fontSize: 13, lineHeight: 17, letterSpacing: 0.5 },
  blaze: { marginHorizontal: 10 },
  foot: {
    height: 8,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  footLine: { position: 'absolute', top: 0, left: 0, right: 0 },
  footTab: { width: 14, height: 4, borderRadius: 1, backgroundColor: BIB_COLORS.pinClasp },
  flipped: {
    alignSelf: 'stretch',
    minHeight: 44,
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

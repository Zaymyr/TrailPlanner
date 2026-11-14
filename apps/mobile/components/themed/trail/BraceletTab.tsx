import { colors } from '@pace-yourself/design-system';
import { StyleSheet, View } from 'react-native';

import { TapeStripes } from './NotebookParts';

export type BraceletTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

export type BraceletPalette = {
  band: string;
  tab: string;
  ink: string;
  /** Dots of the tear line between the tab and the band. */
  perforation: string;
  /** Diagonal tape tab (danger) instead of a flat one. */
  striped?: boolean;
};

/**
 * Tyvek control wristband colors per status tone. Info band/ink are the
 * mockup values (token candidates); every ink passes 4.5:1 on its band.
 */
export const BRACELET_PALETTES: Record<BraceletTone, BraceletPalette> = {
  neutral: { band: colors.surface.muted, tab: colors.trail.braceletMuted, ink: colors.text.secondary, perforation: colors.surface.cream },
  brand: { band: colors.brand.forest, tab: colors.accent.olive, ink: colors.text.inverse, perforation: colors.brand.forest },
  success: { band: colors.brand.forest, tab: colors.accent.olive, ink: colors.text.inverse, perforation: colors.brand.forest },
  info: { band: colors.trail.braceletInfo, tab: colors.semantic.infoBorder, ink: colors.trail.braceletInfoInk, perforation: colors.surface.white },
  warning: { band: colors.accent.amber, tab: colors.semantic.warningSurface, ink: colors.text.primary, perforation: colors.accent.amber },
  danger: { band: colors.semantic.danger, tab: colors.trail.tapeWhite, ink: colors.trail.tapeWhite, perforation: colors.trail.tapeWhite, striped: true },
};

export const BRACELET_HEIGHT = 24;
export const BRACELET_TAB_WIDTH = 12;
const DOT = 2;
const DOT_GAP = 2;

/** Notched tab of the wristband with its dotted tear line. Decorative. */
export function BraceletTab({ palette }: { palette: BraceletPalette }) {
  const dots = Math.floor((BRACELET_HEIGHT - DOT_GAP) / (DOT + DOT_GAP));
  return (
    <View accessible={false} pointerEvents="none" style={[styles.tab, { backgroundColor: palette.tab }]}>
      {palette.striped ? (
        <TapeStripes
          base={palette.tab}
          height={BRACELET_HEIGHT}
          stripe={palette.band}
          stripeWidth={4}
          width={BRACELET_TAB_WIDTH - DOT}
        />
      ) : null}
      <View style={styles.perforation}>
        {Array.from({ length: dots }, (_, index) => (
          <View key={index} style={[styles.dot, { backgroundColor: palette.perforation }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    width: BRACELET_TAB_WIDTH,
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  perforation: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DOT,
    justifyContent: 'space-evenly',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});

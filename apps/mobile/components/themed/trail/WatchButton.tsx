import { colors } from '@pace-yourself/design-system';
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

/**
 * Decorative faces behind `IconAction`: the GPS-watch button (notched bezel
 * drawn as a dashed ring around a domed push button) and the small sign
 * blade pointing left used for "back". Never focusable or hit-testable.
 */

export const WATCH_SIZE = 48;
const WATCH_BEZEL_WIDTH = 2;
const WATCH_BEZEL_GAP = 3;
const WATCH_DOME_EDGE = 2;

export const WATCH_BLADE_WIDTH = 62;
export const WATCH_BLADE_HEIGHT = 46;
export const WATCH_BLADE_TIP = 16;

/** `onBrand` = dark watch for forest headers: pass a light icon (`colors.text.inverse`). */
export type WatchTone = 'neutral' | 'brand' | 'danger' | 'onBrand';

/** Case plate behind the bezel, bezel notches, dome face and the darker lower rim of the dome. */
export const watchPalette: Record<WatchTone, { plate: string; bezel: string; dome: string; rim: string }> = {
  neutral: { plate: colors.surface.cream, bezel: colors.trail.stone, dome: colors.surface.white, rim: colors.border.subtle },
  brand: { plate: colors.surface.cream, bezel: colors.trail.watchBezelBrand, dome: colors.brand.surface, rim: colors.brand.border },
  danger: { plate: colors.surface.cream, bezel: colors.accent.terracotta, dome: colors.semantic.danger, rim: colors.trail.dangerEdge },
  // Cream bezel 8.7:1 on forest; cream icon 5.9:1 on the forestLight dome.
  onBrand: { plate: colors.brand.forestDark, bezel: colors.text.inverse, dome: colors.brand.forestLight, rim: colors.brand.forestDark },
};

export function WatchFace({ tone, pressed }: { tone: WatchTone; pressed: boolean }) {
  const clipId = `watch-dome-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { plate, bezel, dome, rim } = watchPalette[tone];
  const c = WATCH_SIZE / 2;
  const ring = c - WATCH_BEZEL_WIDTH / 2;
  const domeRadius = c - WATCH_BEZEL_WIDTH - WATCH_BEZEL_GAP;

  return (
    <Svg accessible={false} height={WATCH_SIZE} pointerEvents="none" style={styles.face} width={WATCH_SIZE}>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={c} cy={c} r={domeRadius} />
        </ClipPath>
      </Defs>
      <Circle cx={c} cy={c} fill={plate} r={c - 0.5} />
      <Circle cx={c} cy={c} fill="none" r={ring} stroke={bezel} strokeDasharray="4 3" strokeWidth={WATCH_BEZEL_WIDTH} />
      {pressed ? null : <Circle cx={c} cy={c + 1} fill={colors.text.primary} opacity={0.15} r={domeRadius} />}
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={c} cy={c} fill={pressed ? dome : rim} r={domeRadius} />
        <Circle cx={c} cy={c - (pressed ? 0 : WATCH_DOME_EDGE)} fill={dome} r={domeRadius} />
      </G>
    </Svg>
  );
}

/**
 * Sign blade pointing left, for "back". Forest by default; on a forest (or
 * organizer-colored) header pass a light fill, e.g. `colors.surface.cream`.
 */
export function WatchBackBlade({ color = colors.brand.forest }: { color?: string } = {}) {
  const w = WATCH_BLADE_WIDTH;
  const h = WATCH_BLADE_HEIGHT;
  return (
    <Svg accessible={false} height={h} pointerEvents="none" style={styles.face} width={w}>
      <Path d={`M${WATCH_BLADE_TIP} 0 H${w} V${h} H${WATCH_BLADE_TIP} L0 ${h / 2} Z`} fill={color} />
    </Svg>
  );
}

/** Default chevron for the back blade. */
export function WatchBackChevron({ color = colors.text.inverse }: { color?: string }) {
  return (
    <Svg accessible={false} fill="none" height={18} pointerEvents="none" viewBox="0 0 24 24" width={18}>
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', left: 0, top: 0 },
});

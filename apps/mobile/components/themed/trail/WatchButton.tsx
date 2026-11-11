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
  // A small painted plank: rounded post end, pointed tip, thickness and shadow
  // drawn as dark overlays so any organizer colour keeps its own hue.
  const top = 3;
  const face = h - 9;
  const tip = WATCH_BLADE_TIP;
  const r = 6;
  const right = w - 3;
  const plank = (dy: number) => {
    const y0 = top + dy;
    const y1 = y0 + face;
    return `M${tip} ${y0} H${right - r} Q${right} ${y0} ${right} ${y0 + r} V${y1 - r} Q${right} ${y1} ${right - r} ${y1} H${tip} L2 ${y0 + face / 2} Z`;
  };
  const inset = 3.5;
  const y0 = top + inset;
  const y1 = top + face - inset;
  const groove = `M${tip + 1} ${y0} H${right - r - 1} Q${right - inset} ${y0} ${right - inset} ${y0 + r - 2} V${y1 - r + 2} Q${right - inset} ${y1} ${right - r - 1} ${y1} H${tip + 1} L${2 + inset * 1.6} ${top + face / 2} Z`;
  return (
    <Svg accessible={false} height={h} pointerEvents="none" style={styles.face} width={w}>
      <Path d={plank(5)} fill="#000000" opacity={0.12} transform="translate(1.5 0)" />
      <Path d={plank(2.5)} fill={color} />
      <Path d={plank(2.5)} fill="#000000" opacity={0.28} />
      <Path d={plank(0)} fill={color} />
      <Path d={`M${tip + 2} ${top + 1.2} H${right - r}`} stroke="#FFFFFF" strokeLinecap="round" strokeOpacity={0.35} strokeWidth={1} />
      <Path d={groove} fill="none" stroke="#000000" strokeLinejoin="round" strokeOpacity={0.18} strokeWidth={1} />
      <Circle cx={right - 8} cy={top + face / 2 - 7} fill="#000000" fillOpacity={0.3} r={1.4} />
      <Circle cx={right - 8} cy={top + face / 2 + 7} fill="#000000" fillOpacity={0.3} r={1.4} />
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

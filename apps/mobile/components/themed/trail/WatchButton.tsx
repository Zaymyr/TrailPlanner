import { colors } from '@pace-yourself/design-system';
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * Decorative faces behind `IconAction`: the round "watch" button (solid case
 * ring with twelve hour ticks around a concentric push button) and the small
 * sign blade pointing left used for "back". Every circle shares the same
 * centre as the icon, so the icon is always centred. Never focusable or
 * hit-testable.
 */

export const WATCH_SIZE = 48;
const WATCH_RING = 1.5;
const WATCH_TICK_OUTER = 3.5;
const WATCH_TICK_LENGTH = 3;
const WATCH_BUTTON_INSET = 9;

export const WATCH_BLADE_WIDTH = 62;
export const WATCH_BLADE_HEIGHT = 46;
export const WATCH_BLADE_TIP = 16;

/** `onBrand` = dark watch for forest headers: pass a light icon (`colors.text.inverse`). */
export type WatchTone = 'neutral' | 'brand' | 'danger' | 'onBrand';

/** Case, case ring and hour ticks, push-button face and its lower lip. */
export const watchPalette: Record<WatchTone, { plate: string; bezel: string; dome: string; rim: string }> = {
  neutral: { plate: colors.surface.cream, bezel: colors.trail.stone, dome: colors.surface.white, rim: colors.border.strong },
  brand: { plate: colors.surface.cream, bezel: colors.trail.watchBezelBrand, dome: colors.brand.surface, rim: colors.brand.border },
  danger: { plate: colors.surface.cream, bezel: colors.accent.terracotta, dome: colors.semantic.danger, rim: colors.trail.dangerEdge },
  // Cream ring 8.7:1 on forest; cream icon 5.9:1 on the forestLight button.
  onBrand: { plate: colors.brand.forestDark, bezel: colors.text.inverse, dome: colors.brand.forestLight, rim: colors.brand.forestDark },
};

const TICKS = Array.from({ length: 12 }, (_, index) => (index * Math.PI) / 6);

export function WatchFace({ tone, pressed }: { tone: WatchTone; pressed: boolean }) {
  const gradientId = `watch-face-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { plate, bezel, dome, rim } = watchPalette[tone];
  const c = WATCH_SIZE / 2;
  const caseRadius = c - 1;
  const buttonRadius = c - WATCH_BUTTON_INSET;
  const tickOuter = caseRadius - WATCH_TICK_OUTER;
  const tickInner = tickOuter - WATCH_TICK_LENGTH;

  return (
    <Svg accessible={false} height={WATCH_SIZE} pointerEvents="none" style={styles.face} width={WATCH_SIZE}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={pressed ? 0 : 0.35} />
          <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {/* Case with a solid ring and twelve hour ticks, all on the icon's centre. */}
      <Circle cx={c} cy={c} fill={plate} r={caseRadius} stroke={bezel} strokeWidth={WATCH_RING} />
      {TICKS.map((angle, index) => {
        const major = index % 3 === 0;
        const inner = major ? tickInner - 0.5 : tickInner + 0.5;
        return (
          <Line
            key={index}
            stroke={bezel}
            strokeLinecap="round"
            strokeOpacity={major ? 1 : 0.6}
            strokeWidth={major ? 1.6 : 1}
            x1={c + Math.sin(angle) * inner}
            x2={c + Math.sin(angle) * tickOuter}
            y1={c - Math.cos(angle) * inner}
            y2={c - Math.cos(angle) * tickOuter}
          />
        );
      })}
      {/* Push button: concentric, its lip is a ring (not an offset) so the icon stays centred. */}
      <Circle cx={c} cy={c} fill={rim} r={buttonRadius + (pressed ? 0.5 : 1.5)} />
      <Circle cx={c} cy={c} fill={dome} r={buttonRadius} />
      <Circle cx={c} cy={c} fill={`url(#${gradientId})`} r={buttonRadius} />
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

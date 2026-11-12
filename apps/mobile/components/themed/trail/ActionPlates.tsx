import { colors } from '@pace-yourself/design-system';
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

/**
 * Decorative backdrops behind `ActionButton`: the enamelled riveted plate
 * (primary), the aid-station ticket (secondary), the painted ground arrow
 * (ghost) and the closed-trail tape (disabled). Pure drawings: never
 * focusable, never hit-testable, sized by the button's measured layout.
 */

/** Visible thickness under raised plates (enamel, wrong-way cross). */
export const ACTION_PLATE_DEPTH = 3;
/** How far a raised plate sinks into its thickness when pressed. */
export const ACTION_PLATE_PRESS = 2;
export const ENAMEL_RADIUS = 10;
/** Rivet centre distance from the plate corner. */
export const ENAMEL_RIVET_INSET = 11.5;
const ENAMEL_LINER_INSET = 4;
const ENAMEL_LINER_WIDTH = 1.5;
const RIVET_RADIUS = 2.5;

export const TICKET_RADIUS = 6;
export const TICKET_SHADOW = 2;
export const TICKET_NOTCH = 6;
/** Punched hole on a stub that has no glyph. */
const TICKET_PUNCH_RADIUS = 2.5;
/** Darkened stub ink (mockup #8A6A2E is 4.24:1 on the ticket, too low). */
export const TICKET_INK = colors.trail.ticketInk;

export const CLOSED_TRAIL_TAPE_HEIGHT = 12;
const CLOSED_TRAIL_TAPE_STRIPE = 9;
const CLOSED_TRAIL_TAPE_ANGLE = -4;
const CLOSED_TRAIL_TAPE_OVERHANG = 10;

type Size = { width: number; height: number };

function svgId(prefix: string, raw: string) {
  return `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Primary: enamelled plate lit from above, cream liner set 4pt inside the
 * edge, four corner rivets, 3pt dark-forest thickness below. Pressing sinks
 * the face into its thickness.
 */
export function ActionEnamelPlate({ width, height, pressed }: Size & { pressed: boolean }) {
  const gradientId = svgId('enamel', useId());
  if (width <= 0 || height <= 0) return null;
  const faceHeight = height - ACTION_PLATE_DEPTH;
  const faceY = pressed ? ACTION_PLATE_PRESS : 0;
  const liner = ENAMEL_LINER_INSET + ENAMEL_LINER_WIDTH / 2;
  const rivets: Array<[number, number]> = [
    [ENAMEL_RIVET_INSET, faceY + ENAMEL_RIVET_INSET],
    [width - ENAMEL_RIVET_INSET, faceY + ENAMEL_RIVET_INSET],
    [ENAMEL_RIVET_INSET, faceY + faceHeight - ENAMEL_RIVET_INSET],
    [width - ENAMEL_RIVET_INSET, faceY + faceHeight - ENAMEL_RIVET_INSET],
  ];

  return (
    <Svg accessible={false} height={height + 2} pointerEvents="none" style={styles.backdrop} width={width}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={colors.trail.enamelTop} />
          <Stop offset="0.55" stopColor={colors.brand.forest} />
          <Stop offset="1" stopColor={colors.brand.forest} />
        </LinearGradient>
      </Defs>
      {pressed ? null : (
        <Rect fill={colors.text.primary} height={faceHeight} opacity={0.12} rx={ENAMEL_RADIUS} width={width - 2} x={1} y={ACTION_PLATE_DEPTH + 2} />
      )}
      <Rect fill={colors.brand.forestDark} height={faceHeight} rx={ENAMEL_RADIUS} width={width} y={ACTION_PLATE_DEPTH} />
      <Rect fill={`url(#${gradientId})`} height={faceHeight} rx={ENAMEL_RADIUS} width={width} y={faceY} />
      <Rect
        fill="none"
        height={Math.max(0, faceHeight - liner * 2)}
        rx={ENAMEL_RADIUS - ENAMEL_LINER_INSET}
        stroke={colors.trail.enamelLiner}
        strokeWidth={ENAMEL_LINER_WIDTH}
        width={Math.max(0, width - liner * 2)}
        x={liner}
        y={faceY + liner}
      />
      {rivets.map(([cx, cy]) => (
        <G key={`${cx}-${cy}`}>
          {/* Shaded lower-right rim, then the rivet head nudged up-left. */}
          <Circle cx={cx} cy={cy} fill={colors.text.tertiary} r={RIVET_RADIUS} />
          <Circle cx={cx - 0.5} cy={cy - 0.5} fill={colors.trail.rivet} r={RIVET_RADIUS - 0.5} />
        </G>
      ))}
    </Svg>
  );
}

/** Ticket outline with two half-round notches biting into the perforation. */
function ticketPath(width: number, height: number, stub: number, x0 = 0.5, y0 = 0.5) {
  const r = TICKET_RADIUS;
  const n = TICKET_NOTCH;
  const right = width - x0;
  const bottom = height - y0;
  return [
    `M${x0 + r} ${y0}`,
    `H${stub - n} A${n} ${n} 0 0 0 ${stub + n} ${y0}`,
    `H${right - r} Q${right} ${y0} ${right} ${y0 + r}`,
    `V${bottom - r} Q${right} ${bottom} ${right - r} ${bottom}`,
    `H${stub + n} A${n} ${n} 0 0 0 ${stub - n} ${bottom}`,
    `H${x0 + r} Q${x0} ${bottom} ${x0} ${bottom - r}`,
    `V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} Z`,
  ].join(' ');
}

/**
 * Secondary: aid-station ticket on cream card stock, a stub on the left
 * behind a dotted perforation, a round notch top and bottom on the
 * perforation, and a 2pt card-edge shadow. A stub without a glyph carries a
 * single punched hole: never a number or any other text.
 */
export function ActionTicket({ width, height, stub, punched = false }: Size & { stub: number; punched?: boolean }) {
  if (width <= 0 || height <= 0) return null;
  const bodyHeight = height - TICKET_SHADOW;
  const outline = ticketPath(width, bodyHeight, stub);
  return (
    <Svg accessible={false} height={height} pointerEvents="none" style={styles.backdrop} width={width}>
      <Path d={outline} fill={colors.trail.ticketBorder} transform={`translate(0 ${TICKET_SHADOW})`} />
      <Path d={outline} fill={colors.trail.ticket} stroke={colors.trail.ticketBorder} strokeWidth={1} />
      <Line
        stroke={colors.trail.ticketPerforation}
        strokeDasharray="3 3"
        strokeWidth={2}
        x1={stub}
        x2={stub}
        y1={TICKET_NOTCH + 3}
        y2={bodyHeight - TICKET_NOTCH - 3}
      />
      {punched ? (
        <Circle
          cx={stub / 2}
          cy={bodyHeight / 2}
          fill={colors.trail.ticketBorder}
          r={TICKET_PUNCH_RADIUS}
          stroke={colors.trail.ticketPerforation}
          strokeWidth={1}
        />
      ) : null}
    </Svg>
  );
}

/**
 * Ghost: amber arrow painted on the ground under the label, a slightly
 * wobbly stroke ending in an open arrowhead. `wobble` (-1..1) only bends
 * the brush stroke, never its length or colour.
 */
export function ActionGroundArrow({ width, wobble, direction = 'forward' }: { width: number; wobble: number; direction?: 'forward' | 'back' }) {
  if (width <= 0) return null;
  const w = Math.max(40, width);
  const end = w - 10;
  const lift = wobble * 1.2;
  const stroke = `M2 ${7 + lift * 0.5} C${w * 0.2} ${4 - lift} ${w * 0.4} ${9 + lift} ${w * 0.62} 6 S${end - 4} 5 ${end} 6`;
  const head = `M${end - 6} 2 L${end + 4} 6 L${end - 5} 10`;
  return (
    // « back » mirrors the painted arrow so it points left (Précédent, Retour).
    <Svg accessible={false} height={12} pointerEvents="none" style={direction === 'back' ? { transform: [{ scaleX: -1 }] } : undefined} width={w}>
      <Path d={stroke} fill="none" stroke={colors.trail.tapeOrange} strokeLinecap="round" strokeWidth={3} />
      <Path d={head} fill="none" stroke={colors.trail.tapeOrange} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
    </Svg>
  );
}

/**
 * Disabled: closed trail. A red and white diagonal-striped tape ribbon
 * stretched across the button at -4°, overhanging both sides. Never the
 * two-bar GR waymark: the stripes are diagonal and continuous.
 */
export function ActionClosedTrailTape({ width, height }: Size) {
  const patternId = svgId('tape', useId());
  if (width <= 0 || height <= 0) return null;
  const svgWidth = width + CLOSED_TRAIL_TAPE_OVERHANG * 2;
  const cx = svgWidth / 2;
  const cy = height / 2;
  const tapeY = cy - CLOSED_TRAIL_TAPE_HEIGHT / 2;
  const stripe = CLOSED_TRAIL_TAPE_STRIPE;
  return (
    <Svg
      accessible={false}
      height={height}
      pointerEvents="none"
      style={[styles.backdrop, { left: -CLOSED_TRAIL_TAPE_OVERHANG }]}
      width={svgWidth}
    >
      <Defs>
        <Pattern
          height={stripe * 2}
          id={patternId}
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
          width={stripe * 2}
        >
          <Rect fill={colors.trail.tapeRed} height={stripe * 2} width={stripe} x={0} y={0} />
          <Rect fill={colors.trail.tapeWhite} height={stripe * 2} width={stripe} x={stripe} y={0} />
        </Pattern>
      </Defs>
      <G transform={`rotate(${CLOSED_TRAIL_TAPE_ANGLE} ${cx} ${cy})`}>
        <Rect fill={colors.text.primary} height={CLOSED_TRAIL_TAPE_HEIGHT} opacity={0.2} width={svgWidth} y={tapeY + 1} />
        <Rect fill={`url(#${patternId})`} height={CLOSED_TRAIL_TAPE_HEIGHT} width={svgWidth} y={tapeY} />
      </G>
    </Svg>
  );
}

/** "Wrong way" cross drawn before destructive labels: inverse on the filled
 * plate, danger red on the outline variant. */
export function ActionCrossMark({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg accessible={false} height={size} pointerEvents="none" viewBox="0 0 14 14" width={size}>
      <Path d="M2 2l10 10M12 2L2 12" stroke={color} strokeWidth={3} />
    </Svg>
  );
}

/** Padlock on the closed-trail plate. */
export function ActionLockMark({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg accessible={false} fill="none" height={size} pointerEvents="none" viewBox="0 0 24 24" width={size}>
      <Rect height={9} rx={2} stroke={color} strokeWidth={2.4} width={14} x={5} y={11} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeLinecap="round" strokeWidth={2.4} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, top: 0 },
});

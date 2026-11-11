import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { useId, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { signTilt } from '../../lib/trailSignature';
import { Text } from './Text';

export type TrailSignVariant = 'solid' | 'soft' | 'muted';
export type SignPlateShape = 'arrow' | 'plank';

const { height: HEIGHT, tipWidth: TIP, depth: DEPTH, radius: RADIUS, inset: INSET, shadow: SHADOW } = mobileComponents.trailSign;
const BOLT_X = 11;
const BOLT_OFFSET = 9;

/** Face lit from above (top → bottom), darker plank edge, ink for engraving. */
const palette: Record<TrailSignVariant, { top: string; bottom: string; edge: string; ink: string }> = {
  solid: { top: colors.brand.forestLight, bottom: colors.brand.forest, edge: colors.brand.forestDark, ink: colors.text.inverse },
  soft: { top: colors.surface.cream, bottom: colors.brand.surface, edge: colors.brand.border, ink: colors.brand.forest },
  muted: { top: colors.surface.sandLight, bottom: colors.surface.muted, edge: colors.border.strong, ink: colors.text.tertiary },
};

/** Plate outline. Arrow: rounded post side, pointed end. Plank: rounded both ends. */
function platePath(shape: SignPlateShape, width: number, height: number, dy: number) {
  const bottom = dy + height;
  const r = Math.min(RADIUS, height / 2);
  const start = `M${r} ${dy}`;
  const left = `H${r} Q0 ${bottom} 0 ${bottom - r} V${dy + r} Q0 ${dy} ${r} ${dy} Z`;
  if (shape === 'arrow') {
    return `${start} H${width - TIP} L${width} ${dy + height / 2} L${width - TIP} ${bottom} ${left}`;
  }
  return `${start} H${width - r} Q${width} ${dy} ${width} ${dy + r} V${bottom - r} Q${width} ${bottom} ${width - r} ${bottom} ${left}`;
}

/** Routed border running parallel to the plate edge, like an engraved sign. */
function borderPath(shape: SignPlateShape, width: number, height: number) {
  const inset = Math.min(INSET, height / 6);
  const r = Math.max(1, Math.min(RADIUS, height / 2) - 2);
  const top = inset;
  const bottom = height - inset;
  const left = `H${inset + r} Q${inset} ${bottom} ${inset} ${bottom - r} V${top + r} Q${inset} ${top} ${inset + r} ${top} Z`;
  if (shape === 'arrow') {
    const half = height / 2;
    // Horizontal shift that keeps the inner tip parallel to the outer one.
    const apexX = width - (inset * Math.hypot(TIP, half)) / half;
    const shoulderX = apexX - (TIP * (half - inset)) / half;
    return `M${inset + r} ${top} H${shoulderX} L${apexX} ${half} L${shoulderX} ${bottom} ${left}`;
  }
  const right = width - inset;
  return `M${inset + r} ${top} H${right - r} Q${right} ${top} ${right} ${top + r} V${bottom - r} Q${right} ${bottom} ${right - r} ${bottom} ${left}`;
}

type PlateProps = {
  width: number;
  height?: number;
  shape?: SignPlateShape;
  variant?: TrailSignVariant;
  /** Fixing bolts on the post side (signs); planks behind tab labels omit them. */
  bolts?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The painted plank behind a trail sign or an active tab: soft cast shadow,
 * visible thickness, face lit from above, faint grain and a routed border.
 * Decorative only.
 */
export function SignPlate({ width, height = HEIGHT, shape = 'arrow', variant = 'soft', bolts = shape === 'arrow', style }: PlateProps) {
  const gradientId = `sign-face-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { top, bottom, edge, ink } = palette[variant];
  if (width <= 0) return null;

  return (
    <Svg
      accessible={false}
      height={height + DEPTH + SHADOW}
      pointerEvents="none"
      style={[styles.plate, style]}
      width={width + SHADOW}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      {/* Soft cast shadow (two faint offset layers), plank thickness, then the face. */}
      <Path d={platePath(shape, width, height, DEPTH + SHADOW)} fill={colors.text.primary} opacity={0.07} transform={`translate(${SHADOW / 2} 0)`} />
      <Path d={platePath(shape, width, height, DEPTH + SHADOW / 2)} fill={colors.text.primary} opacity={0.06} />
      <Path d={platePath(shape, width, height, DEPTH)} fill={edge} />
      <Path d={platePath(shape, width, height, 0)} fill={`url(#${gradientId})`} />
      <Line stroke={ink} strokeLinecap="round" strokeOpacity={0.07} x1={width * 0.12} x2={width * 0.62} y1={height * 0.3} y2={height * 0.3} />
      <Line stroke={ink} strokeLinecap="round" strokeOpacity={0.07} x1={width * 0.3} x2={width * 0.82} y1={height * 0.72} y2={height * 0.72} />
      <Path d={borderPath(shape, width, height)} fill="none" stroke={ink} strokeLinejoin="round" strokeOpacity={0.3} strokeWidth={1} />
      {bolts ? (
        <>
          <Circle cx={BOLT_X} cy={height / 2 - BOLT_OFFSET} fill={ink} fillOpacity={0.55} r={1.75} />
          <Circle cx={BOLT_X} cy={height / 2 + BOLT_OFFSET} fill={ink} fillOpacity={0.55} r={1.75} />
        </>
      ) : null}
    </Svg>
  );
}

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Usually an Ionicons glyph sized 15–18, colored by the caller. */
  icon?: ReactNode;
  variant?: TrailSignVariant;
  fullWidth?: boolean;
  /** Degrees; defaults to a stable label-derived lean. Pass 0 for an upright sign. */
  tilt?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Action drawn as a trail direction sign: a plank with visible thickness, a
 * routed border, two fixing bolts on the post side and a pointed end towards
 * the destination, set with a slight hand-fixed lean. Reserved for "go
 * somewhere" actions (open a map, a RaceBook or a plan), never for form
 * submission or destructive actions.
 */
export function TrailSignButton({
  label,
  icon,
  variant = 'soft',
  fullWidth = false,
  tilt,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  style,
  ...props
}: Props) {
  const [width, setWidth] = useState(0);
  const lean = tilt ?? signTilt(label, mobileComponents.trailSign.maxTilt);

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
      style={({ pressed }) => [
        styles.root,
        fullWidth && styles.fullWidth,
        // Pressing straightens the sign a little and pushes it into its post.
        { transform: [{ rotate: `${pressed && !disabled ? lean * 0.4 : lean}deg` }, { translateY: pressed && !disabled ? 1 : 0 }] },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <SignPlate shape="arrow" variant={variant} width={width} />
      <View style={styles.content}>
        {icon}
        <Text numberOfLines={1} size="sm" weight="bold" style={[styles.label, { color: palette[variant].ink }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
    height: HEIGHT + DEPTH,
  },
  fullWidth: { alignSelf: 'stretch' },
  plate: { position: 'absolute', left: 0, top: 0 },
  content: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingLeft: BOLT_X + spacing[3],
    paddingRight: TIP + spacing[2],
  },
  label: { flexShrink: 1 },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.5 },
});

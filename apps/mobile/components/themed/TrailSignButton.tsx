import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from './Text';
import { useTrailRandom } from './TrailSeedProvider';
import { shadeHex } from './trail/PosterGeometry';
import { buildWoodSign } from './trail/WoodGeometry';

export type TrailSignVariant = 'solid' | 'soft' | 'muted';
export type SignPlateShape = 'arrow' | 'plank';

const { height: HEIGHT, tipWidth: TIP, depth: DEPTH, radius: RADIUS, inset: INSET, shadow: SHADOW } = mobileComponents.trailSign;
const BOLT_X = 11;
const BOLT_OFFSET = 9;

/**
 * Wood finish retained from the sign mockup (maxTilt 2.9, variation 0.8,
 * shadow 1.6, grain 0.13, wear 0.15, routed 0.8, bolts on).
 */
const WOOD = {
  variation: 0.8,
  grain: 0.13,
  wear: 0.15,
  routed: 0.8,
  /** Routed groove of the calm tab plank. */
  plankRouted: 0.3,
  bolts: 0.6,
} as const;
/** Canvas room right of / below the plate for the cast shadow. */
const SHADOW_ROOM = SHADOW + 3;
/** Blurred cast shadow (offset ~2.5/4, blur ~2) approximated by stacked layers. */
const SHADOW_LAYERS = [
  { dx: 1.5, dy: 1.5, opacity: 0.08 },
  { dx: 2.5, dy: 2.5, opacity: 0.07 },
  { dx: 3.5, dy: 3.5, opacity: 0.05 },
] as const;

type WoodPalette = {
  top: string;
  bottom: string;
  edge: string;
  ink: string;
  grainInk: string;
  wearInk: string;
  boltRing: string;
  bevel: number;
};

/** Face lit from above (top -> bottom), darker plank edge, ink for engraving. */
const palette: Record<TrailSignVariant, WoodPalette> = {
  solid: {
    top: colors.brand.forestLight,
    bottom: colors.brand.forest,
    edge: colors.brand.forestDark,
    ink: colors.text.inverse,
    grainInk: shadeHex(colors.brand.forestDark, -0.35),
    wearInk: shadeHex(colors.brand.border, 0.15),
    boltRing: colors.brand.forestDark,
    bevel: 0.18,
  },
  soft: {
    top: colors.surface.cream,
    bottom: colors.brand.surface,
    edge: colors.brand.border,
    ink: colors.brand.forest,
    grainInk: shadeHex(colors.brand.forestLight, 0.3),
    wearInk: colors.surface.white,
    boltRing: colors.brand.border,
    bevel: 0.7,
  },
  muted: {
    top: colors.surface.sandLight,
    bottom: colors.surface.muted,
    edge: colors.border.strong,
    ink: colors.text.tertiary,
    grainInk: colors.text.tertiary,
    wearInk: colors.surface.white,
    boltRing: colors.trail.rivet,
    bevel: 0.6,
  },
};

type PlateProps = {
  width: number;
  height?: number;
  shape?: SignPlateShape;
  variant?: TrailSignVariant;
  /** Fixing bolts on the post side (signs); planks behind tab labels omit them. */
  bolts?: boolean;
  /** Stable key for the wood's grain, knot, wear, tip and tone. */
  variationKey?: string;
  /** Disabled signs: regular outline, no tone shift (grain stays). */
  neutral?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The painted plank behind a trail sign or an active tab: blurred cast
 * shadow, visible thickness, a face lit from above with wood grain, a knot,
 * worn paint and chipped shoulders, a top bevel, a routed border and bolts.
 * Tab planks (`shape="plank"`) keep only grain and bevel. Decorative only.
 */
export function SignPlate({
  width,
  height = HEIGHT,
  shape = 'arrow',
  variant = 'soft',
  bolts = shape === 'arrow',
  variationKey,
  neutral = false,
  style,
}: PlateProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `sign-face-${id}`;
  const clipId = `sign-clip-${id}`;
  const random = useTrailRandom(variationKey ?? `plate|${shape}|${variant}`, { neutral });
  const calm = shape === 'plank';
  const finish = palette[variant];
  // Session-stable tone: each sign's paint is a touch lighter or darker.
  const tone = random.jitter('wood:tone', mobileComponents.trailVariation.sign.tone * WOOD.variation);
  const wood = useMemo(() => buildWoodSign({
    shape,
    width,
    height,
    radius: RADIUS,
    inset: INSET,
    tipWidth: TIP,
    random,
    tipJitter: mobileComponents.trailVariation.sign.tip,
    variation: WOOD.variation,
    wear: WOOD.wear,
  }), [shape, width, height, random]);
  if (width <= 0) return null;

  const { edge, ink, grainInk, wearInk, boltRing, bevel } = finish;
  const face = wood.outline(0);
  const thickness = wood.outline(DEPTH);
  const shadowScale = calm ? 0.6 : 1;

  return (
    <Svg
      accessible={false}
      height={height + DEPTH + SHADOW_ROOM}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.plate, style]}
      width={width + SHADOW_ROOM}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={shadeHex(finish.top, tone)} />
          <Stop offset="1" stopColor={shadeHex(finish.bottom, tone)} />
        </LinearGradient>
        <ClipPath id={clipId}>
          <Path d={face} />
        </ClipPath>
      </Defs>
      {SHADOW_LAYERS.map((layer) => (
        <Path
          d={thickness}
          fill={colors.text.primary}
          key={`${layer.dx}-${layer.dy}`}
          opacity={layer.opacity * shadowScale}
          transform={`translate(${layer.dx} ${layer.dy})`}
        />
      ))}
      <Path d={thickness} fill={edge} />
      <Path d={face} fill={`url(#${gradientId})`} />
      <G clipPath={`url(#${clipId})`}>
        {wood.grainDark ? (
          <Path d={wood.grainDark} fill="none" stroke={grainInk} strokeOpacity={calm ? WOOD.grain * 0.7 : WOOD.grain} strokeWidth={1} />
        ) : null}
        {wood.grainLight ? (
          <Path d={wood.grainLight} fill="none" stroke={colors.surface.white} strokeOpacity={WOOD.grain * 0.8} strokeWidth={0.8} />
        ) : null}
        {wood.knot ? <Path d={wood.knot} fill="none" stroke={grainInk} strokeOpacity={WOOD.grain * 1.1} strokeWidth={0.8} /> : null}
        {wood.wear ? (
          <Path d={wood.wear} fill={wearInk} fillOpacity={WOOD.wear * (variant === 'solid' ? 0.22 : 0.5)} />
        ) : null}
        <Path d={wood.topLight} fill="none" stroke={colors.surface.white} strokeOpacity={bevel} strokeWidth={1.5} />
      </G>
      <Path
        d={wood.border}
        fill="none"
        stroke={ink}
        strokeLinejoin="round"
        strokeOpacity={calm ? WOOD.plankRouted : WOOD.routed}
        strokeWidth={1}
      />
      {bolts ? [height / 2 - BOLT_OFFSET, height / 2 + BOLT_OFFSET].map((cy) => (
        <G key={cy}>
          <Circle cx={BOLT_X} cy={cy} fill={boltRing} fillOpacity={WOOD.bolts} r={2} />
          <Circle cx={BOLT_X} cy={cy} fill={ink} fillOpacity={WOOD.bolts} r={1.2} />
        </G>
      )) : null}
    </Svg>
  );
}

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Usually an Ionicons glyph sized 15–18, colored by the caller. */
  icon?: ReactNode;
  variant?: TrailSignVariant;
  fullWidth?: boolean;
  /** Degrees; defaults to a session-stable random lean. Pass 0 for an upright sign. */
  tilt?: number;
  /**
   * Stable id that makes two signs with the same label lean differently
   * (e.g. the race id). The label alone is used when omitted.
   */
  variationKey?: string;
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
  variationKey,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  style,
  ...props
}: Props) {
  const [width, setWidth] = useState(0);
  // Disabled signs stay upright: only live decoration varies.
  const signKey = `sign|${variationKey ?? ''}|${label}`;
  const random = useTrailRandom(signKey, { neutral: Boolean(disabled) });
  const variation = mobileComponents.trailVariation.sign;
  const lean = tilt ?? random.lean('tilt', variation.tilt);
  const drop = random.jitter('dy', variation.dy);

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
        { transform: [{ rotate: `${pressed && !disabled ? lean * 0.4 : lean}deg` }, { translateY: drop + (pressed && !disabled ? 1 : 0) }] },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <SignPlate neutral={Boolean(disabled)} shape="arrow" variant={variant} variationKey={signKey} width={width} />
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
    // Tight enough for two full labels side by side on a phone card.
    paddingLeft: BOLT_X + spacing[2],
    paddingRight: TIP + spacing[1],
  },
  label: { flexShrink: 1 },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.5 },
});

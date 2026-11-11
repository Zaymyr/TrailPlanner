import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from './Text';

export type TrailSignVariant = 'solid' | 'soft' | 'muted';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Usually an Ionicons glyph sized 15–18, colored by the caller. */
  icon?: ReactNode;
  variant?: TrailSignVariant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const { height: HEIGHT, tipWidth: TIP, depth: DEPTH, radius: RADIUS, inset: INSET } = mobileComponents.trailSign;
const BOLT_X = 11;
const BOLT_OFFSET = 9;

const palette: Record<TrailSignVariant, { plate: string; edge: string; ink: string }> = {
  solid: { plate: colors.brand.forest, edge: colors.brand.forestDark, ink: colors.text.inverse },
  soft: { plate: colors.brand.surface, edge: colors.brand.border, ink: colors.brand.forest },
  muted: { plate: colors.surface.muted, edge: colors.border.strong, ink: colors.text.tertiary },
};

/** Plate outline: rounded on the post side, pointed towards the destination. */
function platePath(width: number, dy: number) {
  const bottom = dy + HEIGHT;
  return `M${RADIUS} ${dy} H${width - TIP} L${width} ${dy + HEIGHT / 2} L${width - TIP} ${bottom} H${RADIUS} Q0 ${bottom} 0 ${bottom - RADIUS} V${dy + RADIUS} Q0 ${dy} ${RADIUS} ${dy} Z`;
}

/** Routed border running parallel to the plate edge, like an engraved sign. */
function borderPath(width: number) {
  const half = HEIGHT / 2;
  // Horizontal shift that keeps the inner tip parallel to the outer one.
  const apexShift = (INSET * Math.hypot(TIP, half)) / half;
  const apexX = width - apexShift;
  const shoulderX = apexX - (TIP * (half - INSET)) / half;
  const r = RADIUS - 2;
  const top = INSET;
  const bottom = HEIGHT - INSET;
  return `M${INSET + r} ${top} H${shoulderX} L${apexX} ${half} L${shoulderX} ${bottom} H${INSET + r} Q${INSET} ${bottom} ${INSET} ${bottom - r} V${top + r} Q${INSET} ${top} ${INSET + r} ${top} Z`;
}

/**
 * Action drawn as a trail direction sign: a plank with visible thickness, a
 * routed border, two fixing bolts on the post side and a pointed end towards
 * the destination. Reserved for "go somewhere" actions (open a map, open a
 * RaceBook), never for form submission or destructive actions.
 */
export function TrailSignButton({
  label,
  icon,
  variant = 'soft',
  fullWidth = false,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  style,
  ...props
}: Props) {
  const [width, setWidth] = useState(0);
  const { plate, edge, ink } = palette[variant];

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
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {width > 0 ? (
        <Svg accessible={false} height={HEIGHT + DEPTH} style={styles.art} width={width}>
          {/* Plank thickness, then the face. */}
          <Path d={platePath(width, DEPTH)} fill={edge} />
          <Path d={platePath(width, 0)} fill={plate} />
          {/* Faint grain. */}
          <Line stroke={ink} strokeLinecap="round" strokeOpacity={0.08} x1={24} x2={width * 0.62} y1={13} y2={13} />
          <Line stroke={ink} strokeLinecap="round" strokeOpacity={0.08} x1={width * 0.3} x2={width - TIP - 8} y1={HEIGHT - 12} y2={HEIGHT - 12} />
          <Path d={borderPath(width)} fill="none" stroke={ink} strokeLinejoin="round" strokeOpacity={0.32} strokeWidth={1} />
          <Circle cx={BOLT_X} cy={HEIGHT / 2 - BOLT_OFFSET} fill={ink} fillOpacity={0.55} r={1.75} />
          <Circle cx={BOLT_X} cy={HEIGHT / 2 + BOLT_OFFSET} fill={ink} fillOpacity={0.55} r={1.75} />
        </Svg>
      ) : null}
      <View style={styles.content}>
        {icon}
        <Text numberOfLines={1} size="sm" weight="bold" style={[styles.label, { color: ink }]}>
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
  art: { position: 'absolute', left: 0, top: 0 },
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
  pressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
  disabled: { opacity: 0.5 },
});

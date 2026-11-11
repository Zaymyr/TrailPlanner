import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from './Text';

export type TrailSignVariant = 'solid' | 'soft' | 'muted';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Usually an Ionicons glyph sized 15–18, colored by the caller. */
  icon?: ReactNode;
  variant?: TrailSignVariant;
  /** Overrides the sign color (organizer-themed RaceBook surfaces). */
  color?: string;
  textColor?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = mobileComponents.trailSign.height;
const TIP = mobileComponents.trailSign.tipWidth;
// Full-height at the seam, narrowing to a softly rounded point.
const TIP_PATH = `M0 0 L${TIP - 3} ${HEIGHT / 2 - 3} Q${TIP} ${HEIGHT / 2} ${TIP - 3} ${HEIGHT / 2 + 3} L0 ${HEIGHT} Z`;

const palette: Record<TrailSignVariant, { background: string; text: string }> = {
  solid: { background: colors.brand.forest, text: colors.text.inverse },
  soft: { background: colors.brand.surface, text: colors.brand.forest },
  muted: { background: colors.surface.muted, text: colors.text.tertiary },
};

/**
 * Action shaped like a trail direction signpost: rounded on the leading edge,
 * pointed on the trailing edge. Reserved for "go somewhere" actions (open a
 * map, open a RaceBook), never for form submission or destructive actions.
 */
export function TrailSignButton({
  label,
  icon,
  variant = 'soft',
  color,
  textColor,
  fullWidth = false,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  style,
  ...props
}: Props) {
  const background = color ?? palette[variant].background;
  const foreground = textColor ?? palette[variant].text;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.root,
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={[styles.body, { backgroundColor: background }]}>
        {icon}
        <Text numberOfLines={1} size="sm" weight="bold" style={[styles.label, { color: foreground }]}>
          {label}
        </Text>
      </View>
      <Svg accessible={false} height={HEIGHT} style={styles.tip} width={TIP}>
        <Path d={TIP_PATH} fill={background} />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    height: HEIGHT,
  },
  fullWidth: { alignSelf: 'stretch' },
  body: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingLeft: spacing[3],
    paddingRight: spacing[1],
    borderTopLeftRadius: mobileComponents.dataRadius,
    borderBottomLeftRadius: mobileComponents.dataRadius,
  },
  label: { flexShrink: 1 },
  // Overlap the seam by a hairline so no gap shows on fractional layouts.
  tip: { marginLeft: -0.5 },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: mobileComponents.motion.pressScale }],
  },
  disabled: { opacity: 0.5 },
});

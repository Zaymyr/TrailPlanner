import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { useTrailRandom } from './TrailSeedProvider';
import {
  ACTION_PLATE_DEPTH,
  ACTION_PLATE_PRESS,
  ActionClosedTrailTape,
  ActionCrossMark,
  ActionEnamelPlate,
  ActionGroundArrow,
  ActionLockMark,
  ActionTicket,
  ENAMEL_RADIUS,
  TICKET_SHADOW,
} from './trail/ActionPlates';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-outline';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

export type ActionButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: string;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  isLoading?: boolean;
  /**
   * Stable id that makes two tickets with the same label lean differently
   * (e.g. a plan id). The label alone is used when omitted.
   */
  variationKey?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

type Look = ActionButtonVariant | 'closed';

/** Ticket stub width per size: room for a 16pt `leading` glyph. */
const STUB_WIDTH: Record<ActionButtonSize, number> = { sm: 36, md: 42, lg: 44 };
/** A stub without a glyph only carries a punched hole: kept narrow. */
const BLANK_STUB_WIDTH = 18;
/** Keeps primary labels clear of the corner rivets. */
const ENAMEL_MIN_PADDING = spacing[5];
const DESTRUCTIVE_RADIUS = 12;
const CLOSED_TRAIL_RADIUS = 8;
/** Closed-trail plate rim (mockup #A9A595). */
const CLOSED_TRAIL_PLATE_BORDER = colors.trail.stone;
/** Enamel plate lettering: uppercase, tracked 0.08em. */
const ENAMEL_TRACKING = 0.08;

/**
 * Trail-object actions.
 * - primary: enamelled riveted plate, "j'agis ici". One plate per screen.
 * - secondary: aid-station ticket with a stub, set with a slight hand lean.
 *   The stub shows the `leading` glyph, otherwise a single punched hole
 *   (never a number or other text).
 * - ghost: label over an amber arrow painted on the ground (soft exit).
 * - destructive: "wrong way" red cross plate, filled. Reserved for the
 *   confirmation step (dialogs, sheets that confirm). Never varies.
 * - destructive-outline: the same "wrong way" cross and label in danger red
 *   on cream, red border, no fill, no thickness. For delete actions inside
 *   lists and rows. Never varies.
 * - disabled (any variant, not while loading): closed trail, a striped tape
 *   across and the label on a light plate above it. Never varies.
 */
export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  fullWidth = false,
  isLoading = false,
  variationKey,
  disabled,
  accessibilityLabel,
  accessibilityState,
  onLayout,
  style,
  textStyle,
  ...props
}: ActionButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);
  // A busy button keeps its own look (with a spinner); only a refused action is a closed trail.
  const look: Look = isDisabled && !isLoading ? 'closed' : variant;
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [labelWidth, setLabelWidth] = useState(0);
  const random = useTrailRandom(`action|${variant}|${variationKey ?? ''}|${children}`, {
    neutral: look === 'closed' || look === 'destructive' || look === 'destructive-outline',
  });
  const lean = look === 'secondary' ? random.jitter('tilt', mobileComponents.trailVariation.ticket.tilt) : 0;
  const wobble = random.jitter('wobble', 1);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    const height = Math.round(event.nativeEvent.layout.height);
    setLayout((current) => (current.width === width && current.height === height ? current : { width, height }));
    onLayout?.(event);
  };

  const raised = look === 'primary' || look === 'destructive';
  const stub = leading ? STUB_WIDTH[size] : BLANK_STUB_WIDTH;
  const textSize = size === 'sm' ? 'sm' : 'base';
  const outlined = look === 'destructive-outline';
  const spinnerColor = raised ? colors.text.inverse : outlined ? colors.semantic.danger : colors.brand.forest;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      onLayout={handleLayout}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        lookStyles[look],
        look === 'primary' && {
          paddingHorizontal: Math.max(ENAMEL_MIN_PADDING, mobileComponents.action.paddingHorizontal[size]),
        },
        look === 'secondary' && {
          paddingLeft: stub + spacing[3],
          paddingBottom: sizeStyles[size].paddingVertical + TICKET_SHADOW,
        },
        raised && { paddingBottom: sizeStyles[size].paddingVertical + ACTION_PLATE_DEPTH },
        lean !== 0 && { transform: [{ rotate: `${lean}deg` }] },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && pressedStyles[look],
        isLoading && styles.busy,
        style,
      ]}
    >
      {({ pressed }) => {
        const isPressed = pressed && !isDisabled;
        return (
          <>
            {look === 'primary' ? (
              <ActionEnamelPlate height={layout.height} pressed={isPressed} width={layout.width} />
            ) : null}
            {look === 'destructive' ? (
              <>
                <View pointerEvents="none" style={styles.dangerEdge} />
                <View pointerEvents="none" style={[styles.dangerFace, isPressed && styles.dangerFacePressed]} />
              </>
            ) : null}
            {look === 'secondary' ? (
              <>
                <ActionTicket height={layout.height} punched={!leading} stub={stub} width={layout.width} />
                {leading ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                    style={[styles.stub, { width: stub }]}
                  >
                    {leading}
                  </View>
                ) : null}
              </>
            ) : null}
            {look === 'closed' ? <ActionClosedTrailTape height={layout.height} width={layout.width} /> : null}

            {isLoading ? (
              <ActivityIndicator color={spinnerColor} />
            ) : look === 'closed' ? (
              <View style={styles.closedPlateEdge}>
                <View style={styles.closedPlate}>
                  <ActionLockMark color={colors.trail.closedTrailInk} />
                  <Text size={textSize} weight="bold" style={[styles.closedLabel, textStyle]}>
                    {children}
                  </Text>
                </View>
              </View>
            ) : look === 'ghost' ? (
              <View style={styles.ghostColumn}>
                <View
                  onLayout={(event) => {
                    const next = Math.round(event.nativeEvent.layout.width);
                    setLabelWidth((current) => (current === next ? current : next));
                  }}
                  style={styles.row}
                >
                  {leading}
                  <Text size={textSize} tone="brand" weight="bold" style={textStyle}>
                    {children}
                  </Text>
                  {trailing}
                </View>
                <ActionGroundArrow width={labelWidth + spacing[3]} wobble={wobble} />
              </View>
            ) : (
              <View style={[styles.row, raised && isPressed && styles.contentSunk]}>
                {look === 'destructive'
                  ? leading ?? <ActionCrossMark color={colors.text.inverse} />
                  : outlined
                    ? leading ?? <ActionCrossMark color={colors.semantic.danger} />
                    : look === 'secondary' ? null : leading}
                <Text
                  size={textSize}
                  tone={raised ? 'inverse' : 'primary'}
                  weight={look === 'primary' ? 'bold' : 'semibold'}
                  style={[
                    look === 'primary' && styles.enamelLabel,
                    outlined && styles.dangerOutlineLabel,
                    look === 'primary' && { letterSpacing: ENAMEL_TRACKING * (textSize === 'sm' ? 14 : 16) },
                    textStyle,
                  ]}
                >
                  {children}
                </Text>
                {trailing}
              </View>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  busy: {
    opacity: 0.8,
  },
  contentSunk: {
    transform: [{ translateY: ACTION_PLATE_PRESS }],
  },
  enamelLabel: {
    textTransform: 'uppercase',
  },
  dangerEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ACTION_PLATE_DEPTH,
    bottom: 0,
    borderRadius: DESTRUCTIVE_RADIUS,
    backgroundColor: colors.trail.dangerEdge,
  },
  dangerFace: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: ACTION_PLATE_DEPTH,
    borderRadius: DESTRUCTIVE_RADIUS,
    borderWidth: 1,
    borderColor: colors.semantic.danger,
    backgroundColor: colors.semantic.danger,
  },
  dangerFacePressed: {
    top: ACTION_PLATE_PRESS,
    bottom: ACTION_PLATE_DEPTH - ACTION_PLATE_PRESS,
  },
  stub: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: TICKET_SHADOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostColumn: {
    alignItems: 'flex-start',
  },
  closedPlateEdge: {
    borderRadius: 6,
    backgroundColor: colors.border.strong,
    paddingBottom: 2,
  },
  closedPlate: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: CLOSED_TRAIL_PLATE_BORDER,
    backgroundColor: colors.trail.enamelLiner,
  },
  closedLabel: {
    color: colors.trail.closedTrailInk,
  },
  /** #C0392B on #FAF8F2: 5.1:1. */
  dangerOutlineLabel: {
    color: colors.semantic.danger,
  },
});

const sizeStyles = {
  sm: {
    minHeight: mobileComponents.action.minHeight.sm,
    paddingHorizontal: mobileComponents.action.paddingHorizontal.sm,
    paddingVertical: spacing[2],
  },
  md: {
    minHeight: mobileComponents.action.minHeight.md,
    paddingHorizontal: mobileComponents.action.paddingHorizontal.md,
    paddingVertical: spacing[3],
  },
  lg: {
    minHeight: mobileComponents.action.minHeight.lg,
    paddingHorizontal: mobileComponents.action.paddingHorizontal.lg,
    paddingVertical: spacing[3],
  },
} as const satisfies Record<ActionButtonSize, ViewStyle>;

const lookStyles: Record<Look, ViewStyle> = StyleSheet.create({
  primary: { borderRadius: ENAMEL_RADIUS },
  secondary: {},
  ghost: { paddingVertical: 6, paddingHorizontal: spacing[3] },
  destructive: { borderRadius: DESTRUCTIVE_RADIUS },
  'destructive-outline': {
    borderRadius: DESTRUCTIVE_RADIUS,
    borderWidth: 1.5,
    borderColor: colors.semantic.danger,
    backgroundColor: colors.surface.cream,
  },
  closed: {
    borderRadius: CLOSED_TRAIL_RADIUS,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    backgroundColor: colors.trail.closedTrail,
  },
});

/** Raised plates sink into their thickness instead of fading. */
const pressedStyles: Record<Look, ViewStyle> = StyleSheet.create({
  primary: {},
  secondary: { opacity: 0.9 },
  ghost: { opacity: 0.7 },
  destructive: {},
  /** Tinted, never filled: #C0392B on #FDECEA stays 4.7:1. */
  'destructive-outline': { backgroundColor: colors.semantic.dangerSurface },
  closed: {},
});

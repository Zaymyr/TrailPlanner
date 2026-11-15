import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { DataText } from './DataText';
import { Text } from './Text';
import { MilestoneHeart } from './trail/MilestoneGlyphs';
import { splitMilestoneLabel } from './trail/MilestoneLabel';

/** `distance` = green cap when active; `climb` (D+ filters) = amber cap. */
export type ChoiceChipTone = 'distance' | 'climb';
/** `value` engraves the figure and unit; `favorite` paints a heart instead. */
export type ChoiceChipKind = 'value' | 'favorite';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Explicit unit when `label` is a bare figure ("30–60" + "km"). */
  unit?: string;
  tone?: ChoiceChipTone;
  kind?: ChoiceChipKind;
  /** Short caption under the heart of a `favorite` milestone (defaults to the label). */
  caption?: string;
};

type Palette = { cap: string; border: string; ink: string; plinth: string };

/** Amber D+ milestone (mockup values; token candidates for the design system). */
const CLIMB_BORDER = colors.trail.climbBorder;
const CLIMB_INK = colors.trail.amberInk;
const CLIMB_PLINTH = colors.trail.climbPlinth;

const idle: Palette = {
  cap: colors.border.strong,
  border: colors.border.strong,
  ink: colors.text.secondary,
  plinth: colors.border.subtle,
};

const activeByTone: Record<ChoiceChipTone, Palette> = {
  distance: { cap: colors.brand.forest, border: colors.brand.forest, ink: colors.brand.forest, plinth: colors.brand.border },
  climb: { cap: colors.accent.amber, border: CLIMB_BORDER, ink: CLIMB_INK, plinth: CLIMB_PLINTH },
};

const MILESTONE = {
  capHeight: 11,
  topRadius: 18,
  footRadius: 4,
  plinth: 3,
  minHeight: 56,
  minWidth: 64,
} as const;

/**
 * Filter chip drawn as a kilometre milestone (borne): rounded top with a
 * painted cap, figure in JetBrains Mono and unit in spaced capitals. The cap
 * turns forest green (amber for D+ filters) when the filter is on; selection
 * is also exposed through `accessibilityState.selected` and the ink color.
 * The `favorite` kind paints a heart in place of the figure.
 */
export function ChoiceChip({
  label,
  selected,
  icon,
  trailing,
  disabled,
  accessibilityState,
  accessibilityLabel,
  style,
  unit,
  tone = 'distance',
  kind = 'value',
  caption,
  ...props
}: Props) {
  const palette = selected ? activeByTone[tone] : idle;
  const parts = splitMilestoneLabel(label, unit);

  let body: ReactNode;
  if (kind === 'favorite') {
    body = (
      <>
        {icon ?? <MilestoneHeart color={palette.ink} filled={selected} />}
        <DataText numberOfLines={1} weight="bold" style={[styles.unit, styles.caption, { color: palette.ink }]}>
          {(caption ?? label).toLocaleUpperCase('fr-FR')}
        </DataText>
      </>
    );
  } else if (parts.unit) {
    body = (
      <>
        {icon}
        <DataText numberOfLines={1} weight="bold" style={[styles.figure, { color: palette.ink }]}>
          {parts.value}
        </DataText>
        <DataText numberOfLines={1} weight="semibold" style={[styles.unit, { color: palette.ink }]}>
          {parts.unit}
        </DataText>
      </>
    );
  } else {
    body = (
      <>
        {icon}
        <Text numberOfLines={1} size="sm" weight="bold" style={{ color: palette.ink }}>
          {label}
        </Text>
      </>
    );
  }

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityState={{ ...accessibilityState, selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outer,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {/* Painted plinth under the milestone (solid offset, no blur). */}
      <View accessible={false} pointerEvents="none" style={[styles.plinth, { backgroundColor: palette.plinth }]} />
      <View style={[styles.stone, { borderColor: palette.border }]}>
        <View accessible={false} pointerEvents="none" style={[styles.cap, { backgroundColor: palette.cap }]} />
        <View style={styles.face}>
          {body}
          {trailing}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    minHeight: MILESTONE.minHeight,
    minWidth: MILESTONE.minWidth,
    paddingBottom: MILESTONE.plinth,
  },
  plinth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: MILESTONE.topRadius,
    borderBottomLeftRadius: MILESTONE.footRadius,
    borderBottomRightRadius: MILESTONE.footRadius,
  },
  stone: {
    flexGrow: 1,
    minHeight: MILESTONE.minHeight - MILESTONE.plinth,
    borderWidth: 1.5,
    borderTopLeftRadius: MILESTONE.topRadius,
    borderTopRightRadius: MILESTONE.topRadius,
    borderBottomLeftRadius: MILESTONE.footRadius,
    borderBottomRightRadius: MILESTONE.footRadius,
    backgroundColor: colors.surface.white,
    overflow: 'hidden',
  },
  cap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MILESTONE.capHeight,
  },
  face: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: MILESTONE.capHeight + 2,
    paddingBottom: spacing[1],
    paddingHorizontal: mobileComponents.filterChip.paddingHorizontal,
  },
  figure: { fontSize: 15, lineHeight: 18 },
  unit: { fontSize: 10, lineHeight: 12, letterSpacing: 1.6 },
  caption: { letterSpacing: 1.2 },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.5 },
});

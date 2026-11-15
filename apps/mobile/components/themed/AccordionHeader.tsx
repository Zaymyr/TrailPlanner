import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { DataText } from './DataText';
import { Text } from './Text';

/** Section milestone ("borne") geometry: rounded top, painted cap. */
const BORNE = { width: 40, height: 44, topRadius: 14, footRadius: 4, border: 1.5, cap: 9 } as const;
const TRAIL_WIDTH = 2;
const ROW_MIN_HEIGHT = 52;
const COLUMN_GAP = spacing[3];

/**
 * Left inset that aligns content with the accordion title (borne + gap), for
 * collapsed previews that sit under the header without a trail line.
 */
export const ACCORDION_CONTENT_INSET = BORNE.width + COLUMN_GAP;

type HeaderProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  title: string;
  subtitle?: string | null;
  /** Figure painted on the borne (JetBrains Mono bold), e.g. number of items. */
  count?: number | string | null;
  /** Glyph painted on the borne when there is no `count`. */
  icon?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** Organizer themes: cap, open chevron and trail color. Defaults to brand forest. */
  accentColor?: string;
  /** Title/subtitle ink for themed surfaces. */
  titleColor?: string;
  subtitleColor?: string;
  /** Extra element between the copy and the chevron (badge, logo). */
  trailing?: ReactNode;
  /**
   * Locks the section (e.g. forced open while searching): not toggleable,
   * no chevron, not dimmed since the content stays readable.
   */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Accordion row drawn as a kilometre milestone: a small borne whose cap is
 * painted forest when the section is open and grey when it is closed, the
 * section title, then a chevron. Pair it with `AccordionTrail` (or use
 * `AccordionSection`) so the open content hangs from a solid trail line.
 */
export function AccordionHeader({
  title,
  subtitle,
  count,
  icon,
  expanded,
  onToggle,
  accentColor = colors.brand.forest,
  titleColor = colors.text.primary,
  subtitleColor = colors.text.secondary,
  trailing,
  accessibilityLabel,
  accessibilityState,
  disabled,
  style,
  ...props
}: HeaderProps) {
  const hasCount = count != null && count !== '';
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, expanded, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, style]}
    >
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.borne}>
        <View style={[styles.cap, { backgroundColor: expanded ? accentColor : colors.trail.braceletMuted }]} />
        <View style={styles.face}>
          {hasCount ? (
            <DataText adjustsFontSizeToFit numberOfLines={1} weight="bold" style={styles.count}>
              {String(count)}
            </DataText>
          ) : (
            icon ?? null
          )}
        </View>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} weight="bold" style={[styles.title, { color: titleColor }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[styles.subtitle, { color: subtitleColor }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {disabled ? null : (
        <Ionicons
          color={expanded ? accentColor : colors.text.secondary}
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
        />
      )}
    </Pressable>
  );
}

type TrailProps = {
  children: ReactNode;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Solid trail line descending from under the borne along the left of an
 * open section; the content sits to its right, aligned with the title.
 * Consecutive trails (e.g. list items) join into one continuous line.
 */
export function AccordionTrail({ children, accentColor = colors.brand.forest, style, contentStyle }: TrailProps) {
  return (
    <View style={[styles.trailRow, style]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.trailColumn}>
        <View style={[styles.trailLine, { backgroundColor: accentColor }]} />
      </View>
      <View style={[styles.trailContent, contentStyle]}>{children}</View>
    </View>
  );
}

type SectionProps = Omit<HeaderProps, 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Accordion header plus, when open, its content hung from the trail line. */
export function AccordionSection({ children, style, headerStyle, contentStyle, ...headerProps }: SectionProps) {
  return (
    <View style={style}>
      <AccordionHeader {...headerProps} style={headerStyle} />
      {headerProps.expanded && children ? (
        <AccordionTrail accentColor={headerProps.accentColor} contentStyle={contentStyle}>
          {children}
        </AccordionTrail>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: COLUMN_GAP,
    paddingVertical: spacing[1],
  },
  pressed: { opacity: 0.8 },
  borne: {
    width: BORNE.width,
    height: BORNE.height,
    borderWidth: BORNE.border,
    borderColor: colors.border.strong,
    borderTopLeftRadius: BORNE.topRadius,
    borderTopRightRadius: BORNE.topRadius,
    borderBottomLeftRadius: BORNE.footRadius,
    borderBottomRightRadius: BORNE.footRadius,
    backgroundColor: colors.surface.white,
    overflow: 'hidden',
  },
  cap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BORNE.cap,
  },
  face: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: BORNE.cap - BORNE.border,
    paddingHorizontal: 2,
  },
  count: { fontSize: 15, lineHeight: 18, color: colors.text.primary },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 21 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  trailRow: { flexDirection: 'row', alignItems: 'stretch' },
  trailColumn: { width: BORNE.width, alignItems: 'center' },
  trailLine: { flex: 1, width: TRAIL_WIDTH, borderRadius: TRAIL_WIDTH / 2 },
  trailContent: { flex: 1, minWidth: 0, marginLeft: COLUMN_GAP },
});

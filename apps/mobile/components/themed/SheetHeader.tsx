import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { IconAction } from './IconAction';
import { Text } from './Text';
import { TrailBlaze } from './TrailBlaze';

/** Short dotted trail segment drawn in place of the grey drag handle. */
const HANDLE = { width: 48, thickness: 3, dash: 2, gap: 5 } as const;
/** Slender vertical blaze before the title: 10 x 34 pt, 2:1:4 bands. */
const SHEET_BLAZE = { width: 10, unit: 30 / 7, gap: 2 } as const;

type Props = {
  title: string;
  /** Secondary line under the title (13 pt, secondary ink); may be a Cote-formatted string. */
  subtitle?: string | null;
  /** Shows the round close watch button when provided. */
  onClose?: () => void;
  /** Spoken label of the close button (required when `onClose` is set). */
  closeLabel?: string;
  closeTestID?: string;
  closeDisabled?: boolean;
  /** Extra actions or badges placed between the title and the close button. */
  trailing?: ReactNode;
  /** Dotted trail-segment handle above the row (bottom sheets). Default true. */
  showHandle?: boolean;
  /** Optional line clamp for long titles (unclamped by default). */
  numberOfTitleLines?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The trail-signature sheet header: a short dotted trail segment as the drag
 * handle, then a slender trail blaze, the title and optional subtitle, an
 * optional trailing slot, and a round watch close button. It only draws; a
 * sheet that pans from its handle keeps its own gesture wrapper around it.
 */
export function SheetHeader({
  title,
  subtitle,
  onClose,
  closeLabel,
  closeTestID,
  closeDisabled,
  trailing,
  showHandle = true,
  numberOfTitleLines,
  style,
  testID,
}: Props) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {showHandle ? <SheetHandle /> : null}
      <View style={styles.row}>
        <TrailBlaze geometry={SHEET_BLAZE} style={styles.blaze} />
        <View style={styles.copy}>
          <Text accessibilityRole="header" numberOfLines={numberOfTitleLines} weight="bold" style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text tone="secondary" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        {onClose ? (
          <IconAction
            accessibilityLabel={closeLabel ?? title}
            disabled={closeDisabled}
            icon={<Ionicons color={colors.text.primary} name="close" size={22} />}
            onPress={onClose}
            testID={closeTestID}
            tone="neutral"
          />
        ) : null}
      </View>
    </View>
  );
}

/** The dotted trail-segment handle alone, for sheets that place it themselves. */
export function SheetHandle({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.handle, style]}
    >
      <Svg height={HANDLE.thickness} width={HANDLE.width}>
        <Line
          stroke={colors.border.strong}
          strokeDasharray={[HANDLE.dash, HANDLE.gap]}
          strokeLinecap="round"
          strokeWidth={HANDLE.thickness}
          x1={HANDLE.thickness / 2}
          x2={HANDLE.width - HANDLE.thickness / 2}
          y1={HANDLE.thickness / 2}
          y2={HANDLE.thickness / 2}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[3] },
  handle: {
    alignSelf: 'center',
    height: HANDLE.thickness,
    width: HANDLE.width,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  blaze: { alignSelf: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 20, lineHeight: 25, color: colors.text.primary },
  subtitle: { fontSize: 13, lineHeight: 18 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});

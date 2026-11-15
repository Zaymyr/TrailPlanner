import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@pace-yourself/design-system';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../themed/Text';
import { TapeStrip } from '../themed/trail/TapeStrip';

/**
 * Warning ink and halo for the tape banner. Amber 700 keeps 4.5:1 on the
 * warning surface where the semantic warning (#D97706) does not.
 */
const TAPE_BANNER_INK = colors.trail.amberInk;
const TAPE_BANNER_BORDER = colors.trail.tapeBannerBorder;
const TAPE_BANNER_ICON_SURFACE = colors.trail.tapeBannerIconSurface;

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  collapsible?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  /** Stable key for the tape's session variation. */
  variationKey?: string;
};

/**
 * "Dernière minute" banner: a strip of closed-trail tape (orange/white
 * rubalise) across the top of a warning surface. Same content contract as the
 * RaceBook inline alert.
 */
export function TapeAlertBanner({
  icon,
  title,
  message,
  collapsible = false,
  expandLabel,
  collapseLabel,
  variationKey = title,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.banner}>
      <TapeStrip style={styles.tape} variationKey={variationKey} />
      <View style={styles.row}>
        <View accessible={false} style={styles.iconWrap}>
          <Ionicons color={TAPE_BANNER_INK} name={icon} size={18} />
        </View>
        <Text numberOfLines={collapsible && !expanded ? 1 : undefined} style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{` – ${message}`}</Text>
        </Text>
        {collapsible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            hitSlop={8}
            onPress={() => setExpanded((current) => !current)}
            style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
          >
            <Text style={styles.toggleText}>{expanded ? collapseLabel : expandLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TAPE_BANNER_BORDER,
    backgroundColor: colors.semantic.warningSurface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  tape: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TAPE_BANNER_ICON_SURFACE,
  },
  text: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 19,
  },
  title: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 19,
  },
  toggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  togglePressed: { opacity: 0.64 },
  toggleText: {
    color: TAPE_BANNER_INK,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});

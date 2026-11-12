import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { ActionButton } from '../themed/ActionButton';
import { Text } from '../themed/Text';
import { TrailSignButton } from '../themed/TrailSignButton';

/** Gap kept between the card and whatever sits below it (screen edge or tab bar). */
const CARD_GAP = 14;

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * - `acknowledge` (default): the action stays on this screen ("J'ai compris"):
   *   a ground arrow next to the skip action, an enamel plate when alone.
   * - `navigate`: the action opens another screen ("Créer mon plan"): a trail sign.
   */
  actionKind?: 'acknowledge' | 'navigate';
  skipLabel?: string;
  onSkip?: () => void;
  busy?: boolean;
  /**
   * Height of the navigation drawn at the bottom of the screen (e.g. the
   * RaceBook tab bar, safe-area inset included). The card floats above it so
   * it never covers the navigation it talks about.
   */
  bottomOffset?: number;
};

export function OnboardingGuideCard({
  title,
  body,
  actionLabel,
  onAction,
  actionKind = 'acknowledge',
  skipLabel,
  onSkip,
  busy = false,
  bottomOffset = 0,
}: Props) {
  const hasSkip = Boolean(skipLabel && onSkip);
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <View accessibilityRole="summary" style={[styles.card, { bottom: bottomOffset + CARD_GAP }]}>
      <View style={styles.headingRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" color={Colors.brandPrimary} size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {hasSkip ? (
          <ActionButton disabled={busy} onPress={onSkip} size="sm" variant="ghost">
            {skipLabel as string}
          </ActionButton>
        ) : null}
        {hasAction && actionKind === 'navigate' ? (
          <TrailSignButton
            disabled={busy}
            icon={<Ionicons color={Colors.brandPrimary} name="flag-outline" size={16} />}
            label={actionLabel as string}
            onPress={onAction}
            variant="soft"
          />
        ) : null}
        {hasAction && actionKind === 'acknowledge' ? (
          <ActionButton
            isLoading={busy}
            onPress={onAction}
            size="sm"
            variant={hasSkip ? 'secondary' : 'primary'}
          >
            {actionLabel as string}
          </ActionButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.surface,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  headingRow: { flexDirection: 'row', gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
  },
  copy: { flex: 1, gap: 3 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
});

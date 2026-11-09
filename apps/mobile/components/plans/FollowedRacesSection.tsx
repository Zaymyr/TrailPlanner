import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FollowedRaceEvent } from '../../lib/raceFavorites';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';
import { formatEventDate } from './plansHelpers';

type Props = {
  events: FollowedRaceEvent[];
  locale: 'fr' | 'en';
  title: string;
  subtitle: string;
  racebookLabel: string;
  noRacebookLabel: string;
  onOpenEvent: (eventId: string) => void;
};

/**
 * Upcoming races the runner follows without a plan. Each card leads to the
 * event's distances in the catalog, where the RaceBook is the primary action;
 * no plan call-to-action is shown here because the plan is optional.
 */
export function FollowedRacesSection({
  events,
  locale,
  title,
  subtitle,
  racebookLabel,
  noRacebookLabel,
  onOpenEvent,
}: Props) {
  if (events.length === 0) return null;

  return (
    <View style={styles.section} testID="followed-races-section">
      <View style={styles.header}>
        <Heading variant="h3">{title}</Heading>
        <Text tone="secondary" size="sm" lineHeight="normal">{subtitle}</Text>
      </View>
      {events.map((event) => {
        const date = formatEventDate(event.race_date, locale);
        const meta = [date, event.location].filter(Boolean).join(' · ');
        return (
          <Pressable
            accessibilityLabel={`${event.name}. ${event.hasRacebook ? racebookLabel : noRacebookLabel}`}
            accessibilityRole="button"
            key={event.id}
            onPress={() => onOpenEvent(event.id)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardCopy}>
              <Text weight="bold" size="base" numberOfLines={2}>{event.name}</Text>
              {meta ? <Text tone="secondary" size="sm" numberOfLines={1}>{meta}</Text> : null}
            </View>
            <View style={[styles.cta, !event.hasRacebook && styles.ctaMuted]}>
              <Ionicons
                color={event.hasRacebook ? colors.text.inverse : colors.brand.forest}
                name={event.hasRacebook ? 'book-outline' : 'list-outline'}
                size={16}
              />
              <Text tone={event.hasRacebook ? 'inverse' : 'brand'} size="xs" weight="bold">
                {event.hasRacebook ? racebookLabel : noRacebookLabel}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[2] },
  header: { gap: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.white,
  },
  cardPressed: { opacity: 0.82 },
  cardCopy: { flex: 1, gap: 2 },
  cta: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.brand.forest,
  },
  ctaMuted: {
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.border.brand,
  },
});

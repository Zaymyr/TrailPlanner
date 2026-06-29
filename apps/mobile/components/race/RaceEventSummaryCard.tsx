import { Image, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

export type RaceEventSummaryRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  thumbnail_url?: string | null;
};

export type RaceEventSummaryEvent<T extends RaceEventSummaryRace = RaceEventSummaryRace> = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url?: string | null;
  races: T[];
};

type RaceEventSummaryCardProps<T extends RaceEventSummaryRace> = {
  event: RaceEventSummaryEvent<T>;
  locale: 'fr' | 'en';
  viewFormatsLabel: string;
  singleFormatLabel: string;
  multipleFormatsLabel: string;
  chooseFormatHint: string;
  favoriteLabel?: string;
  unfavoriteLabel?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onOpenFormats: () => void;
};

function formatEventDate(isoDate: string | null, locale: 'fr' | 'en'): string | null {
  if (!isoDate) return null;

  return new Date(isoDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getRaceShortLabel(raceName: string, eventName: string): string {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-\u2013\u2014\u00b7]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function getEventImageUrl(event: Pick<RaceEventSummaryEvent, 'thumbnail_url' | 'races'>): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function formatElevation(elevationGainM: number) {
  return Math.round(elevationGainM).toString();
}

function getEventDistanceRange(races: RaceEventSummaryRace[]) {
  if (races.length === 0) return null;

  const distances = races.map((race) => race.distance_km);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  if (Math.abs(maxDistance - minDistance) < 0.05) {
    return `${formatDistance(maxDistance)} km`;
  }

  return `${formatDistance(minDistance)}-${formatDistance(maxDistance)} km`;
}

export function RaceEventSummaryCard<T extends RaceEventSummaryRace>({
  event,
  locale,
  viewFormatsLabel,
  singleFormatLabel,
  multipleFormatsLabel,
  chooseFormatHint,
  favoriteLabel = 'Ajouter aux favoris',
  unfavoriteLabel = 'Retirer des favoris',
  isFavorite = false,
  onToggleFavorite,
  onOpenFormats,
}: RaceEventSummaryCardProps<T>) {
  const eventImageUrl = getEventImageUrl(event);
  const dateStr = formatEventDate(event.race_date, locale);
  const headerMeta = [event.location, dateStr].filter(Boolean).join(' • ');
  const distanceRange = getEventDistanceRange(event.races);
  const primaryRace = event.races[0] ?? null;
  const formatsLabel =
    event.races.length === 1
      ? singleFormatLabel
      : multipleFormatsLabel.replace('{count}', String(event.races.length));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="flag-outline" size={18} color={Colors.brandPrimary} />
        </View>
        <View style={styles.headerText}>
          <Text numberOfLines={2} style={styles.name}>
            {event.name}
          </Text>
          {headerMeta ? <Text style={styles.meta}>{headerMeta}</Text> : null}
        </View>
        {eventImageUrl ? (
          <Image source={{ uri: eventImageUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : null}
        {onToggleFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? unfavoriteLabel : favoriteLabel}
            hitSlop={10}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onToggleFavorite();
            }}
            style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? Colors.textOnBrand : Colors.brandPrimary}
            />
          </Pressable>
        ) : null}
      </View>

      <TouchableOpacity activeOpacity={0.84} onPress={onOpenFormats}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillText}>{formatsLabel}</Text>
          </View>
          {distanceRange ? (
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>{distanceRange}</Text>
            </View>
          ) : null}
        </View>

        {primaryRace ? (
          <Text style={styles.supportText} numberOfLines={2}>
            {event.races.length === 1
              ? `${getRaceShortLabel(primaryRace.name, event.name)} • ${formatDistance(primaryRace.distance_km)} km • D+ ${formatElevation(primaryRace.elevation_gain_m)} m`
              : chooseFormatHint}
          </Text>
        ) : null}

        <View style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{viewFormatsLabel}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  favoriteButtonActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  supportText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 14,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '700',
  },
});

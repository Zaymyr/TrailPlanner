import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
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
  onOpenFormats: () => void;
  selectedRaceId?: string | null;
  showSupportText?: boolean;
  variant?: 'card' | 'row';
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
  onOpenFormats,
  selectedRaceId = null,
  showSupportText = true,
  variant = 'card',
}: RaceEventSummaryCardProps<T>) {
  const eventImageUrl = getEventImageUrl(event);
  const dateStr = formatEventDate(event.race_date, locale);
  const headerMeta = [event.location, dateStr].filter(Boolean).join(' • ');
  const distanceRange = getEventDistanceRange(event.races);
  const selectedEventRace = event.races.find((race) => race.id === selectedRaceId) ?? null;
  const primaryRace = event.races[0] ?? null;
  const formatsLabel =
    event.races.length === 1
      ? singleFormatLabel
      : multipleFormatsLabel.replace('{count}', String(event.races.length));
  const summaryText = [formatsLabel, distanceRange].filter(Boolean).join(' • ');
  const isRow = variant === 'row';

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onOpenFormats}
      style={[
        isRow ? styles.row : styles.card,
        isRow && selectedEventRace && styles.rowSelected,
      ]}
    >
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
      </View>

      {isRow ? (
        summaryText ? <Text style={styles.rowSummary}>{summaryText}</Text> : null
      ) : (
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
      )}

      {showSupportText && primaryRace ? (
        <Text style={styles.supportText} numberOfLines={2}>
          {selectedEventRace
            ? `${getRaceShortLabel(selectedEventRace.name, event.name)} • ${formatDistance(selectedEventRace.distance_km)} km • D+ ${formatElevation(selectedEventRace.elevation_gain_m)} m`
            : event.races.length === 1
              ? `${getRaceShortLabel(primaryRace.name, event.name)} • ${formatDistance(primaryRace.distance_km)} km • D+ ${formatElevation(primaryRace.elevation_gain_m)} m`
              : chooseFormatHint}
        </Text>
      ) : null}

      {isRow ? (
        <View style={styles.rowAction}>
          <Text style={styles.rowActionText}>{viewFormatsLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.brandPrimary} />
        </View>
      ) : (
        <View style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{viewFormatsLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
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
  row: {
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowSelected: {
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderBottomColor: 'transparent',
    backgroundColor: Colors.brandSurface,
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
  rowSummary: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  supportText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 2,
  },
  rowActionText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});

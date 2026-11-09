import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import { formatDistance, formatDistanceRange } from '../../lib/displayFormat';

export type RaceEventSummaryRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number | null;
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
  showChooseFormatHint?: boolean;
  favoriteLabel?: string;
  unfavoriteLabel?: string;
  isFavorite?: boolean;
  allowOptimisticFavoriteToggle?: boolean;
  hasNewUpdate?: boolean;
  /** Shown as a badge when at least one format has a published RaceBook. */
  racebookAvailableLabel?: string | null;
  onToggleFavorite?: () => void;
  onOpenFormats: () => void;
};

function formatEventDate(isoDate: string | null, locale: 'fr' | 'en'): string | null {
  if (!isoDate) return null;

  return new Date(isoDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).replace(/ /g, '\u00a0');
}

function getRaceShortLabel(raceName: string, eventName: string): string {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-\u2013\u2014\u00b7]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function getEventImageUrl(event: Pick<RaceEventSummaryEvent, 'thumbnail_url' | 'races'>): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

function formatElevation(elevationGainM: number | null, locale: 'fr' | 'en') {
  if (elevationGainM === null) return locale === 'fr' ? 'D+ inconnu' : 'D+ unknown';
  return `D+ ${Math.round(elevationGainM)} m`;
}

function getEventDistanceRange(races: RaceEventSummaryRace[], locale: 'fr' | 'en') {
  if (races.length === 0) return null;

  const distances = races.map((race) => race.distance_km);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  if (Math.abs(maxDistance - minDistance) < 0.05) {
    return formatDistance(maxDistance, locale);
  }

  return formatDistanceRange(minDistance, maxDistance, locale);
}

export function RaceEventSummaryCard<T extends RaceEventSummaryRace>({
  event,
  locale,
  viewFormatsLabel,
  singleFormatLabel,
  multipleFormatsLabel,
  chooseFormatHint,
  showChooseFormatHint = true,
  favoriteLabel = 'Ajouter aux favoris',
  unfavoriteLabel = 'Retirer des favoris',
  isFavorite = false,
  allowOptimisticFavoriteToggle = false,
  hasNewUpdate = false,
  racebookAvailableLabel = null,
  onToggleFavorite,
  onOpenFormats,
}: RaceEventSummaryCardProps<T>) {
  const favoriteScale = useRef(new Animated.Value(1)).current;
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [displayedFavorite, setDisplayedFavorite] = useState(isFavorite);
  const eventImageUrl = getEventImageUrl(event);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const visibleEventImageUrl = eventImageUrl && eventImageUrl !== failedImageUrl ? eventImageUrl : null;
  const dateStr = formatEventDate(event.race_date, locale);
  const distanceRange = getEventDistanceRange(event.races, locale);
  const primaryRace = event.races[0] ?? null;
  const formatsLabel =
    event.races.length === 1
      ? singleFormatLabel
      : multipleFormatsLabel.replace('{count}', String(event.races.length));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setDisplayedFavorite(isFavorite);
  }, [isFavorite]);

  const handleFavoritePress = () => {
    if (allowOptimisticFavoriteToggle) {
      setDisplayedFavorite((current) => !current);
    }
    if (!reduceMotionEnabled) {
      favoriteScale.stopAnimation();
      Animated.sequence([
        Animated.spring(favoriteScale, {
          toValue: 1.28,
          speed: 28,
          bounciness: 8,
          useNativeDriver: true,
        }),
        Animated.spring(favoriteScale, {
          toValue: 1,
          speed: 24,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onToggleFavorite?.();
  };

  return (
    <Pressable
      accessibilityLabel={`${event.name}. ${viewFormatsLabel}`}
      accessibilityRole="button"
      onPress={onOpenFormats}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {visibleEventImageUrl ? <View style={styles.imageRail}>
          <Image source={{ uri: visibleEventImageUrl }} style={styles.railImage} resizeMode="cover" onError={() => setFailedImageUrl(visibleEventImageUrl)} />
      </View> : (
        // Events without an image (or with a broken one) keep the same rail so
        // every card in the list shares one layout.
        <View accessible={false} style={[styles.imageRail, styles.imagePlaceholder]} testID="race-event-image-placeholder">
          <Ionicons color={Colors.brandPrimary} name="trail-sign" size={24} />
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={2} style={styles.name}>
              {event.name}
            </Text>
            {hasNewUpdate ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            ) : null}
          </View>
          {racebookAvailableLabel ? (
            <View style={styles.racebookBadge} testID="race-event-racebook-badge">
              <Ionicons color={Colors.brandPrimary} name="book-outline" size={12} />
              <Text style={styles.racebookBadgeText}>{racebookAvailableLabel}</Text>
            </View>
          ) : null}
          {event.location || dateStr ? (
            <View style={styles.metaRow}>
              {event.location ? <Text numberOfLines={1} style={[styles.meta, styles.location]}>{event.location}</Text> : null}
              {event.location && dateStr ? <Text style={styles.meta}>•</Text> : null}
              {dateStr ? <Text numberOfLines={1} style={styles.meta}>{dateStr}</Text> : null}
            </View>
          ) : null}
          </View>
          {onToggleFavorite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={displayedFavorite ? unfavoriteLabel : favoriteLabel}
              hitSlop={6}
              onPress={(pressEvent) => {
                pressEvent.stopPropagation();
                handleFavoritePress();
              }}
              style={[styles.favoriteButton, displayedFavorite && styles.favoriteButtonActive]}
            >
              <Animated.View style={{ transform: [{ scale: favoriteScale }] }}>
                <Ionicons
                  name={displayedFavorite ? 'heart' : 'heart-outline'}
                  size={21}
                  color={Colors.brandPrimary}
                />
              </Animated.View>
            </Pressable>
          ) : null}
        </View>

      <View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillText}>{formatsLabel}</Text>
          </View>
          {distanceRange ? (
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>{distanceRange}</Text>
            </View>
          ) : null}
          <View style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{viewFormatsLabel}</Text>
            <Ionicons color={Colors.brandPrimary} name="chevron-forward" size={16} />
          </View>
        </View>

        {primaryRace && (event.races.length === 1 || showChooseFormatHint) ? (
          <Text style={styles.supportText} numberOfLines={2}>
            {event.races.length === 1
              ? `${getRaceShortLabel(primaryRace.name, event.name)} • ${formatDistance(primaryRace.distance_km, locale)} • ${formatElevation(primaryRace.elevation_gain_m, locale)}`
              : chooseFormatHint}
          </Text>
        ) : null}

        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardContent: {
    flex: 1,
    gap: 10,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  newBadge: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  newBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  racebookBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.surfaceSecondary,
  },
  racebookBadgeText: {
    color: Colors.brandPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  location: {
    flex: 1,
    minWidth: 0,
  },
  imageRail: {
    width: 58,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  imagePlaceholder: {
    backgroundColor: Colors.brandSurface,
  },
  railImage: {
    ...StyleSheet.absoluteFillObject,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  favoriteButtonActive: {
    backgroundColor: 'transparent',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  primaryAction: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginLeft: 'auto',
  },
  primaryActionText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});

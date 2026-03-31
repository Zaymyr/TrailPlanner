import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

type Race = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  has_aid_stations: boolean | null;
  gpx_storage_path: string | null;
  thumbnail_url?: string | null;
};

type EventGroup = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url?: string | null;
  races: Race[];
};

function formatEventDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getRaceShortLabel(raceName: string, eventName: string): string {
  const cleaned = raceName
    .replace(eventName, '')
    .replace(/[\s\-–—·]+/g, ' ')
    .trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function getEventImageUrl(event: Pick<EventGroup, 'thumbnail_url' | 'races'>): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

function SkeletonEventCard() {
  return (
    <View style={[styles.eventCard, { opacity: 0.6 }]}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonSubtitle} />
      <View style={styles.divider} />
      <View style={styles.racesRow}>
        <View style={[styles.skeletonRaceCard, { flex: 1 }]} />
        <View style={[styles.skeletonRaceCard, { flex: 1 }]} />
      </View>
    </View>
  );
}

function RaceSubCard({
  race,
  eventName,
  flex,
}: {
  race: Race;
  eventName: string;
  flex?: boolean;
}) {
  const router = useRouter();
  const label = getRaceShortLabel(race.name, eventName);
  return (
    <View style={[styles.raceCard, flex ? { flex: 1 } : styles.raceCardFixed]}>
      <Text style={styles.raceLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.raceStats}>
        {race.distance_km}km{'  '}D+{race.elevation_gain_m}m
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() =>
          router.push({
            pathname: '/(app)/plan/new',
            params: { catalogRaceId: race.id },
          })
        }
      >
        <Text style={styles.createButtonText}>+ Créer un plan</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalRaceCard({ race, flex }: { race: Race; flex?: boolean }) {
  const router = useRouter();
  return (
    <View style={[styles.raceCard, flex ? { flex: 1 } : styles.raceCardFixed]}>
      <Text style={styles.raceLabel} numberOfLines={2}>{race.name}</Text>
      <Text style={styles.raceStats}>
        {race.distance_km}km{'  '}D+{race.elevation_gain_m}m
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() =>
          router.push({
            pathname: '/(app)/plan/new',
            params: { catalogRaceId: race.id },
          })
        }
      >
        <Text style={styles.createButtonText}>➕ Créer un plan</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalRacesSection({ races }: { races: Race[] }) {
  const useFlex = races.length <= 2;
  return (
    <View style={[styles.eventCard, styles.personalCard]}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventHeaderEmoji}>🗺️</Text>
        <View style={styles.eventHeaderText}>
          <Text style={styles.eventName}>Mes courses</Text>
        </View>
      </View>
      <View style={styles.divider} />
      {useFlex ? (
        <View style={styles.racesRow}>
          {races.map((race) => (
            <PersonalRaceCard key={race.id} race={race} flex />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.racesScrollContent}
        >
          {races.map((race) => (
            <PersonalRaceCard key={race.id} race={race} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function CatalogScreen() {
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [personalRaces, setPersonalRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetchEvents() {
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? null;

        const [eventsResult, orphansResult, personalResult] = await Promise.all([
          supabase
            .from('race_events')
            .select(`
              id,
              name,
              location,
              race_date,
              thumbnail_url,
              races (
                id,
                name,
                distance_km,
                elevation_gain_m,
                has_aid_stations,
                gpx_storage_path,
                thumbnail_url
              )
            `)
            .eq('is_live', true)
            .order('name'),
          supabase
            .from('races')
            .select('id, name, distance_km, elevation_gain_m, has_aid_stations, gpx_storage_path, thumbnail_url')
            .eq('is_live', true)
            .is('event_id', null),
          userId
            ? supabase
                .from('races')
                .select('id, name, distance_km, elevation_gain_m, has_aid_stations, gpx_storage_path, thumbnail_url')
                .eq('is_public', false)
                .eq('created_by', userId)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (cancelled) return;
        if (eventsResult.error) throw eventsResult.error;
        if (orphansResult.error) throw orphansResult.error;

        const groups: EventGroup[] = (eventsResult.data ?? []) as EventGroup[];
        const orphans = (orphansResult.data ?? []) as Race[];
        if (orphans.length > 0) {
          groups.push({
            id: '__orphans__',
            name: 'Autres courses',
            location: null,
            race_date: null,
            races: orphans,
          });
        }

        setEventGroups(groups);
        setPersonalRaces((personalResult.data ?? []) as Race[]);
        setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    return fetchEvents();
  }, []);

  if (loading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={styles.list}
      >
        <SkeletonEventCard />
        <SkeletonEventCard />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger les courses</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchEvents();
          }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={eventGroups}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.list,
        eventGroups.length === 0 && personalRaces.length === 0 && styles.listEmpty,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchEvents();
          }}
          tintColor={Colors.brandPrimary}
        />
      }
      ListHeaderComponent={
        personalRaces.length > 0 ? (
          <PersonalRacesSection races={personalRaces} />
        ) : null
      }
      ListEmptyComponent={
        personalRaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏁</Text>
            <Text style={styles.emptyTitle}>Aucune course disponible</Text>
            <Text style={styles.emptySubtitle}>Le catalogue sera bientôt enrichi.</Text>
          </View>
        ) : null
      }
      renderItem={({ item: event }) => {
        const dateStr = formatEventDate(event.race_date);
        const headerMeta = [event.location, dateStr].filter(Boolean).join(' · ');
        const useFlex = event.races.length <= 2;
        const eventImageUrl = getEventImageUrl(event);
        return (
          <View style={[styles.eventCard, eventImageUrl ? styles.eventCardWithImage : null]}>
            {eventImageUrl ? (
              <ImageBackground
                source={{ uri: eventImageUrl }}
                imageStyle={styles.eventCardImage}
                style={styles.eventCardImageFill}
              >
                <View style={styles.eventCardImageOverlay} />
              </ImageBackground>
            ) : null}
            {/* Event header */}
            <View style={styles.eventHeader}>
              <Text style={styles.eventHeaderEmoji}>🏔️</Text>
              <View style={styles.eventHeaderText}>
                <Text style={styles.eventName}>{event.name}</Text>
                {headerMeta ? (
                  <Text style={styles.eventMeta}>{headerMeta}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Race format sub-cards */}
            {useFlex ? (
              <View style={styles.racesRow}>
                {event.races.map((race) => (
                  <RaceSubCard key={race.id} race={race} eventName={event.name} flex />
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.racesScrollContent}
              >
                {event.races.map((race) => (
                  <RaceSubCard key={race.id} race={race} eventName={event.name} />
                ))}
              </ScrollView>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
  },
  list: {
    padding: 16,
    gap: 16,
    backgroundColor: Colors.background,
  },
  listEmpty: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Event card
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  eventCardWithImage: {
    overflow: 'hidden',
  },
  eventCardImageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  eventCardImage: {
    borderRadius: 16,
  },
  eventCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  personalCard: {
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventHeaderEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  eventHeaderText: {
    flex: 1,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  eventMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  // Race sub-cards — flex row (≤ 2 races)
  racesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  // Race sub-cards — horizontal scroll (3+ races)
  racesScrollContent: {
    flexDirection: 'row',
    gap: 10,
  },
  raceCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    minWidth: 140,
  },
  raceCardFixed: {
    width: 150,
  },
  raceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  raceStats: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  createButton: {
    backgroundColor: 'transparent',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    marginTop: 8,
  },
  createButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Skeleton placeholders
  skeletonTitle: {
    height: 18,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    width: '60%',
    marginBottom: 8,
  },
  skeletonSubtitle: {
    height: 13,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 6,
    width: '40%',
  },
  skeletonRaceCard: {
    height: 100,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
  },
});

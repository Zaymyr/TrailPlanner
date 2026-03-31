import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

type Race = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  race_date?: string | null;
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

function isUpcomingOrUndated(isoDate: string | null | undefined) {
  if (!isoDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const raceDate = new Date(isoDate);
  if (Number.isNaN(raceDate.getTime())) return true;
  raceDate.setHours(0, 0, 0, 0);

  return raceDate >= today;
}

function matchesDistanceFilter(distanceKm: number, distanceFilter: string) {
  const trimmed = distanceFilter.trim().replace(',', '.');
  if (!trimmed) return true;

  const targetDistance = Number(trimmed);
  if (!Number.isFinite(targetDistance)) return true;

  return Math.abs(distanceKm - targetDistance) <= 2;
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
  const [nameFilter, setNameFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState('');
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
                race_date,
                has_aid_stations,
                gpx_storage_path,
                thumbnail_url
              )
            `)
            .eq('is_live', true)
            .order('name'),
          supabase
            .from('races')
            .select('id, name, distance_km, elevation_gain_m, race_date, has_aid_stations, gpx_storage_path, thumbnail_url')
            .eq('is_live', true)
            .is('event_id', null),
          userId
            ? supabase
                .from('races')
                .select('id, name, distance_km, elevation_gain_m, race_date, has_aid_stations, gpx_storage_path, thumbnail_url')
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

  const filteredEventGroups = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();

    return eventGroups
      .filter((event) => isUpcomingOrUndated(event.race_date))
      .map((event) => {
        const eventMatchesName =
          normalizedName.length === 0 ||
          event.name.toLowerCase().includes(normalizedName) ||
          (event.location ?? '').toLowerCase().includes(normalizedName);

        const races = event.races.filter((race) => {
          const raceMatchesName =
            normalizedName.length === 0 ||
            eventMatchesName ||
            race.name.toLowerCase().includes(normalizedName);

          return raceMatchesName && matchesDistanceFilter(race.distance_km, distanceFilter);
        });

        return { ...event, races };
      })
      .filter((event) => event.races.length > 0);
  }, [distanceFilter, eventGroups, nameFilter]);

  const filteredPersonalRaces = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();

    return personalRaces.filter((race) => {
      const raceMatchesName =
        normalizedName.length === 0 || race.name.toLowerCase().includes(normalizedName);

      return (
        isUpcomingOrUndated(race.race_date) &&
        raceMatchesName &&
        matchesDistanceFilter(race.distance_km, distanceFilter)
      );
    });
  }, [distanceFilter, nameFilter, personalRaces]);

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
      data={filteredEventGroups}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.list,
        filteredEventGroups.length === 0 && filteredPersonalRaces.length === 0 && styles.listEmpty,
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
        <View style={styles.listHeader}>
          <View style={styles.filtersCard}>
            <TextInput
              value={nameFilter}
              onChangeText={setNameFilter}
              placeholder="Rechercher une course"
              placeholderTextColor={Colors.textMuted}
              style={styles.filterInput}
            />
            <TextInput
              value={distanceFilter}
              onChangeText={setDistanceFilter}
              placeholder="Distance (km)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.filterInput}
            />
            <Text style={styles.filterHint}>Courses futures uniquement</Text>
          </View>
          {filteredPersonalRaces.length > 0 ? (
            <PersonalRacesSection races={filteredPersonalRaces} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        filteredPersonalRaces.length === 0 ? (
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
          <View style={styles.eventCard}>
            {/* Event header */}
            <View style={styles.eventHeader}>
              <Text style={styles.eventHeaderEmoji}>🏔️</Text>
              <View style={styles.eventHeaderText}>
                <Text style={styles.eventName}>{event.name}</Text>
                {headerMeta ? (
                  <Text style={styles.eventMeta}>{headerMeta}</Text>
                ) : null}
              </View>
              {eventImageUrl ? (
                <Image source={{ uri: eventImageUrl }} style={styles.eventThumbnail} resizeMode="cover" />
              ) : null}
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
  listHeader: {
    gap: 16,
  },
  filtersCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  filterInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  filterHint: {
    fontSize: 12,
    color: Colors.textSecondary,
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
  eventThumbnail: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
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

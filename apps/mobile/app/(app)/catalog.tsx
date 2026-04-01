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
  Modal,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
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

function formatEventDate(isoDate: string | null, locale: 'fr' | 'en'): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getRaceShortLabel(raceName: string, eventName: string): string {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-–—·]+/g, ' ').trim();
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

function parseNumberFilter(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateFilter(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const localMatch = /^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/.exec(trimmed);

  let year: string;
  let month: string;
  let day: string;

  if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else if (localMatch) {
    [, day, month, year] = localMatch;
  } else {
    return null;
  }

  const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function matchesDistanceRange(distanceKm: number, minDistance: string, maxDistance: string) {
  const min = parseNumberFilter(minDistance);
  const max = parseNumberFilter(maxDistance);

  if (min !== null && distanceKm < min) return false;
  if (max !== null && distanceKm > max) return false;
  return true;
}

function matchesDateRange(isoDate: string | null | undefined, minDate: string, maxDate: string) {
  if (!isoDate) return true;

  const raceDate = new Date(isoDate);
  if (Number.isNaN(raceDate.getTime())) return true;
  raceDate.setHours(0, 0, 0, 0);

  const min = parseDateFilter(minDate);
  const max = parseDateFilter(maxDate);

  if (min && raceDate < min) return false;
  if (max && raceDate > max) return false;
  return true;
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
  createPlanLabel,
  flex,
}: {
  race: Race;
  eventName: string;
  createPlanLabel: string;
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
        <Text style={styles.createButtonText}>{createPlanLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalRaceCard({
  race,
  createPlanLabel,
  flex,
}: {
  race: Race;
  createPlanLabel: string;
  flex?: boolean;
}) {
  const router = useRouter();

  return (
    <View style={[styles.raceCard, flex ? { flex: 1 } : styles.raceCardFixed]}>
      <Text style={styles.raceLabel} numberOfLines={2}>
        {race.name}
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
        <Text style={styles.createButtonText}>{createPlanLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalRacesSection({
  races,
  myRacesLabel,
  createPlanLabel,
}: {
  races: Race[];
  myRacesLabel: string;
  createPlanLabel: string;
}) {
  const useFlex = races.length <= 2;

  return (
    <View style={[styles.eventCard, styles.personalCard]}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventHeaderEmoji}>🗺️</Text>
        <View style={styles.eventHeaderText}>
          <Text style={styles.eventName}>{myRacesLabel}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      {useFlex ? (
        <View style={styles.racesRow}>
          {races.map((race) => (
            <PersonalRaceCard key={race.id} race={race} flex createPlanLabel={createPlanLabel} />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.racesScrollContent}
        >
          {races.map((race) => (
            <PersonalRaceCard key={race.id} race={race} createPlanLabel={createPlanLabel} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function CatalogScreen() {
  const { locale, t } = useI18n();
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [personalRaces, setPersonalRaces] = useState<Race[]>([]);
  const [nameFilter, setNameFilter] = useState('');
  const [distanceMinFilter, setDistanceMinFilter] = useState('');
  const [distanceMaxFilter, setDistanceMaxFilter] = useState('');
  const [dateMinFilter, setDateMinFilter] = useState('');
  const [dateMaxFilter, setDateMaxFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
            name: t.catalog.otherRaces,
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
          setError(err instanceof Error ? err.message : t.common.error);
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
  }, [t.catalog.otherRaces, t.common.error]);

  const filteredEventGroups = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();

    return eventGroups
      .filter(
        (event) =>
          isUpcomingOrUndated(event.race_date) &&
          matchesDateRange(event.race_date, dateMinFilter, dateMaxFilter),
      )
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

          return (
            raceMatchesName &&
            matchesDistanceRange(race.distance_km, distanceMinFilter, distanceMaxFilter) &&
            matchesDateRange(race.race_date ?? event.race_date, dateMinFilter, dateMaxFilter)
          );
        });

        return { ...event, races };
      })
      .filter((event) => event.races.length > 0);
  }, [dateMaxFilter, dateMinFilter, distanceMaxFilter, distanceMinFilter, eventGroups, nameFilter]);

  const filteredPersonalRaces = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();

    return personalRaces.filter((race) => {
      const raceMatchesName =
        normalizedName.length === 0 || race.name.toLowerCase().includes(normalizedName);

      return (
        isUpcomingOrUndated(race.race_date) &&
        raceMatchesName &&
        matchesDistanceRange(race.distance_km, distanceMinFilter, distanceMaxFilter) &&
        matchesDateRange(race.race_date, dateMinFilter, dateMaxFilter)
      );
    });
  }, [dateMaxFilter, dateMinFilter, distanceMaxFilter, distanceMinFilter, nameFilter, personalRaces]);

  const activeFiltersCount = useMemo(() => {
    return [distanceMinFilter, distanceMaxFilter, dateMinFilter, dateMaxFilter].filter(
      (value) => value.trim().length > 0,
    ).length;
  }, [dateMaxFilter, dateMinFilter, distanceMaxFilter, distanceMinFilter]);

  function resetFilters() {
    setDistanceMinFilter('');
    setDistanceMaxFilter('');
    setDateMinFilter('');
    setDateMaxFilter('');
  }

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
        <Text style={styles.errorText}>{t.catalog.loadError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchEvents();
          }}
        >
          <Text style={styles.retryButtonText}>{t.common.retry}</Text>
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
              placeholder={t.catalog.searchPlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.filterInput}
            />
            <View style={styles.filterActionsRow}>
              <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersOpen(true)}>
                <Ionicons name="options-outline" size={16} color={Colors.brandPrimary} />
                <Text style={styles.filterButtonText}>
                  {activeFiltersCount > 0
                    ? `${t.catalog.filters} (${activeFiltersCount})`
                    : t.catalog.filters}
                </Text>
              </TouchableOpacity>
              <Text style={styles.filterHint}>{t.catalog.futureOnly}</Text>
            </View>
          </View>
          {filteredPersonalRaces.length > 0 ? (
            <PersonalRacesSection
              races={filteredPersonalRaces}
              myRacesLabel={t.catalog.myRaces}
              createPlanLabel={t.catalog.createPlan}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        filteredPersonalRaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏁</Text>
            <Text style={styles.emptyTitle}>{t.catalog.noCatalogTitle}</Text>
            <Text style={styles.emptySubtitle}>{t.catalog.noCatalogSubtitle}</Text>
          </View>
        ) : null
      }
      renderItem={({ item: event }) => {
        const dateStr = formatEventDate(event.race_date, locale);
        const headerMeta = [event.location, dateStr].filter(Boolean).join(' · ');
        const useFlex = event.races.length <= 2;
        const eventImageUrl = getEventImageUrl(event);

        return (
          <View style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventHeaderEmoji}>🏔️</Text>
              <View style={styles.eventHeaderText}>
                <Text style={styles.eventName}>{event.name}</Text>
                {headerMeta ? <Text style={styles.eventMeta}>{headerMeta}</Text> : null}
              </View>
              {eventImageUrl ? (
                <Image source={{ uri: eventImageUrl }} style={styles.eventThumbnail} resizeMode="cover" />
              ) : null}
            </View>

            <View style={styles.divider} />

            {useFlex ? (
              <View style={styles.racesRow}>
                {event.races.map((race) => (
                  <RaceSubCard
                    key={race.id}
                    race={race}
                    eventName={event.name}
                    createPlanLabel={t.catalog.createPlan}
                    flex
                  />
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.racesScrollContent}
              >
                {event.races.map((race) => (
                  <RaceSubCard
                    key={race.id}
                    race={race}
                    eventName={event.name}
                    createPlanLabel={t.catalog.createPlan}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        );
      }}
      ListFooterComponent={
        <Modal
          visible={filtersOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setFiltersOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <SafeAreaView style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.catalog.modalTitle}</Text>
                <TouchableOpacity onPress={() => setFiltersOpen(false)}>
                  <Ionicons name="close" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={styles.modalSectionTitle}>{t.catalog.distanceTitle}</Text>
                <View style={styles.rangeRow}>
                  <TextInput
                    value={distanceMinFilter}
                    onChangeText={setDistanceMinFilter}
                    placeholder={t.catalog.minKm}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.filterInput, styles.rangeInput]}
                  />
                  <TextInput
                    value={distanceMaxFilter}
                    onChangeText={setDistanceMaxFilter}
                    placeholder={t.catalog.maxKm}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.filterInput, styles.rangeInput]}
                  />
                </View>

                <Text style={styles.modalSectionTitle}>{t.catalog.dateTitle}</Text>
                <View style={styles.rangeRow}>
                  <TextInput
                    value={dateMinFilter}
                    onChangeText={setDateMinFilter}
                    placeholder={t.catalog.minDate}
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.filterInput, styles.rangeInput]}
                  />
                  <TextInput
                    value={dateMaxFilter}
                    onChangeText={setDateMaxFilter}
                    placeholder={t.catalog.maxDate}
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.filterInput, styles.rangeInput]}
                  />
                </View>
                <Text style={styles.modalHint}>{t.catalog.dateHint}</Text>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={resetFilters}>
                  <Text style={styles.secondaryActionButtonText}>{t.catalog.reset}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryActionButton} onPress={() => setFiltersOpen(false)}>
                  <Text style={styles.primaryActionButtonText}>{t.catalog.apply}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      }
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
  filterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
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
    flexShrink: 1,
    textAlign: 'right',
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
  racesRow: {
    flexDirection: 'row',
    gap: 10,
  },
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18, 24, 16, 0.24)',
  },
  modalSheet: {
    maxHeight: '78%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  modalContent: {
    padding: 20,
    gap: 14,
  },
  modalSectionTitle: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeInput: {
    flex: 1,
  },
  modalHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  secondaryActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryActionButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryActionButtonText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '700',
  },
});

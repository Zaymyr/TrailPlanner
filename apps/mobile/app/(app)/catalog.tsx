import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

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

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function formatElevation(elevationGainM: number) {
  return Math.round(elevationGainM).toString();
}

function getEventDistanceRange(races: Race[]) {
  if (races.length === 0) return null;

  const distances = races.map((race) => race.distance_km);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  if (Math.abs(maxDistance - minDistance) < 0.05) {
    return `${formatDistance(maxDistance)} km`;
  }

  return `${formatDistance(minDistance)}-${formatDistance(maxDistance)} km`;
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

function sortRaces(races: Race[]) {
  return [...races].sort((left, right) => {
    if (left.distance_km !== right.distance_km) {
      return left.distance_km - right.distance_km;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortEvents(events: EventGroup[]) {
  const getTimestamp = (value: string | null) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };

  return [...events].sort((left, right) => {
    const timestampDiff = getTimestamp(left.race_date) - getTimestamp(right.race_date);
    if (timestampDiff !== 0) return timestampDiff;
    return left.name.localeCompare(right.name);
  });
}

function SkeletonEventCard() {
  return (
    <View style={[styles.eventCard, { opacity: 0.6 }]}>
      <View style={styles.skeletonHeaderRow}>
        <View style={styles.skeletonBadge} />
        <View style={styles.skeletonHeaderText}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
      </View>
      <View style={styles.skeletonPillsRow}>
        <View style={styles.skeletonPill} />
        <View style={styles.skeletonPill} />
      </View>
      <View style={styles.skeletonSupportText} />
      <View style={styles.skeletonButton} />
    </View>
  );
}

function RaceRow({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.formatRow}>
      <View style={styles.formatRowContent}>
        <Text style={styles.formatTitle}>{title}</Text>
        <Text style={styles.formatSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={styles.formatActionButton} onPress={onPress}>
        <Text style={styles.formatActionButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EventSummaryCard({
  event,
  locale,
  viewFormatsLabel,
  singleFormatLabel,
  multipleFormatsLabel,
  chooseFormatHint,
  onOpenFormats,
}: {
  event: EventGroup;
  locale: 'fr' | 'en';
  viewFormatsLabel: string;
  singleFormatLabel: string;
  multipleFormatsLabel: string;
  chooseFormatHint: string;
  onOpenFormats: () => void;
}) {
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
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventBadge}>
          <Ionicons name="flag-outline" size={18} color={Colors.brandPrimary} />
        </View>
        <View style={styles.eventHeaderText}>
          <Text style={styles.eventName}>{event.name}</Text>
          {headerMeta ? <Text style={styles.eventMeta}>{headerMeta}</Text> : null}
        </View>
        {eventImageUrl ? (
          <Image source={{ uri: eventImageUrl }} style={styles.eventThumbnail} resizeMode="cover" />
        ) : null}
      </View>

      <View style={styles.eventSummaryRow}>
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
        <Text style={styles.eventSupportText} numberOfLines={2}>
          {event.races.length === 1
            ? `${getRaceShortLabel(primaryRace.name, event.name)} • ${formatDistance(primaryRace.distance_km)} km • D+ ${formatElevation(primaryRace.elevation_gain_m)} m`
            : chooseFormatHint}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.eventPrimaryButton}
        onPress={onOpenFormats}
      >
        <Text style={styles.eventPrimaryButtonText}>{viewFormatsLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalRacesSection({
  races,
  title,
  createPlanLabel,
  onCreatePlan,
}: {
  races: Race[];
  title: string;
  createPlanLabel: string;
  onCreatePlan: (raceId: string) => void;
}) {
  return (
    <View style={styles.personalSection}>
      <View style={styles.personalSectionHeader}>
        <View style={styles.eventBadge}>
          <Ionicons name="person-outline" size={18} color={Colors.brandPrimary} />
        </View>
        <Text style={styles.personalSectionTitle}>{title}</Text>
      </View>

      <View style={styles.personalList}>
        {races.map((race) => (
          <RaceRow
            key={race.id}
            title={race.name}
            subtitle={`${formatDistance(race.distance_km)} km • D+ ${formatElevation(race.elevation_gain_m)} m`}
            actionLabel={createPlanLabel}
            onPress={() => onCreatePlan(race.id)}
          />
        ))}
      </View>
    </View>
  );
}

export default function CatalogScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [personalRaces, setPersonalRaces] = useState<Race[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventGroup | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [distanceMinFilter, setDistanceMinFilter] = useState('');
  const [distanceMaxFilter, setDistanceMaxFilter] = useState('');
  const [dateMinFilter, setDateMinFilter] = useState('');
  const [dateMaxFilter, setDateMaxFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCreatePlan(catalogRaceId: string) {
    router.push({
      pathname: '/(app)/plan/new',
      params: { catalogRaceId },
    });
  }

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
        if (personalResult.error) throw personalResult.error;

        const groups = sortEvents(
          ((eventsResult.data ?? []) as Array<Omit<EventGroup, 'races'> & { races?: Race[] | null }>).map((event) => ({
            ...event,
            races: sortRaces((event.races ?? []) as Race[]),
          }))
        );
        const orphans = sortRaces((orphansResult.data ?? []) as Race[]);

        if (orphans.length > 0) {
          groups.push({
            id: '__orphans__',
            name: t.catalog.otherRaces,
            location: null,
            race_date: null,
            thumbnail_url: null,
            races: orphans,
          });
        }

        setEventGroups(groups);
        setPersonalRaces(sortRaces((personalResult.data ?? []) as Race[]));
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

        const races = sortRaces(
          event.races.filter((race) => {
            const raceMatchesName =
              normalizedName.length === 0 ||
              eventMatchesName ||
              race.name.toLowerCase().includes(normalizedName);

            return (
              raceMatchesName &&
              matchesDistanceRange(race.distance_km, distanceMinFilter, distanceMaxFilter) &&
              matchesDateRange(race.race_date ?? event.race_date, dateMinFilter, dateMaxFilter)
            );
          })
        );

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

  const activeFiltersCount = useMemo(
    () =>
      [distanceMinFilter, distanceMaxFilter, dateMinFilter, dateMaxFilter].filter(
        (value) => value.trim().length > 0,
      ).length,
    [dateMaxFilter, dateMinFilter, distanceMaxFilter, distanceMinFilter],
  );

  const selectedEventDate = selectedEvent ? formatEventDate(selectedEvent.race_date, locale) : null;
  const selectedEventMeta = selectedEvent
    ? [selectedEvent.location, selectedEventDate].filter(Boolean).join(' • ')
    : null;
  const selectedEventImage = selectedEvent ? getEventImageUrl(selectedEvent) : null;
  const selectedEventDistanceRange = selectedEvent ? getEventDistanceRange(selectedEvent.races) : null;
  const selectedFormatsLabel = selectedEvent
    ? selectedEvent.races.length === 1
      ? t.catalog.singleFormatLabel
      : t.catalog.multipleFormatsLabel.replace('{count}', String(selectedEvent.races.length))
    : null;

  function resetFilters() {
    setDistanceMinFilter('');
    setDistanceMaxFilter('');
    setDateMinFilter('');
    setDateMaxFilter('');
  }

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.list}>
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
    <>
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
                title={t.catalog.myRaces}
                createPlanLabel={t.catalog.createPlan}
                onCreatePlan={handleCreatePlan}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          filteredPersonalRaces.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="map-outline" size={28} color={Colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>{t.catalog.noCatalogTitle}</Text>
              <Text style={styles.emptySubtitle}>{t.catalog.noCatalogSubtitle}</Text>
            </View>
          ) : null
        }
        renderItem={({ item: event }) => (
          <EventSummaryCard
            event={event}
            locale={locale}
            viewFormatsLabel={t.catalog.viewFormats}
            singleFormatLabel={t.catalog.singleFormatLabel}
            multipleFormatsLabel={t.catalog.multipleFormatsLabel}
            chooseFormatHint={t.catalog.chooseFormatHint}
            onOpenFormats={() => setSelectedEvent(event)}
          />
        )}
        ListFooterComponent={<View style={styles.listFooterSpacing} />}
      />

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

      <Modal
        visible={Boolean(selectedEvent)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.sheetOverlay} onPress={() => setSelectedEvent(null)} />
          <SafeAreaView style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>{selectedEvent?.name}</Text>
                {selectedEventMeta ? <Text style={styles.sheetSubtitle}>{selectedEventMeta}</Text> : null}
              </View>
              <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setSelectedEvent(null)}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedEventImage ? (
              <Image source={{ uri: selectedEventImage }} style={styles.sheetImage} resizeMode="cover" />
            ) : null}

            <View style={styles.eventSummaryRow}>
              {selectedFormatsLabel ? (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>{selectedFormatsLabel}</Text>
                </View>
              ) : null}
              {selectedEventDistanceRange ? (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>{selectedEventDistanceRange}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.sheetHint}>{t.catalog.chooseFormatHint}</Text>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              {selectedEvent?.races.map((race) => (
                <RaceRow
                  key={race.id}
                  title={getRaceShortLabel(race.name, selectedEvent.name)}
                  subtitle={`${formatDistance(race.distance_km)} km • D+ ${formatElevation(race.elevation_gain_m)} m`}
                  actionLabel={t.catalog.createPlan}
                  onPress={() => {
                    setSelectedEvent(null);
                    handleCreatePlan(race.id);
                  }}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  listFooterSpacing: {
    height: 8,
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
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
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
  personalSection: {
    gap: 12,
  },
  personalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personalSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  personalList: {
    gap: 10,
  },
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    gap: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  eventHeaderText: {
    flex: 1,
    gap: 3,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  eventThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  eventSummaryRow: {
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
  eventSupportText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  eventPrimaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  eventPrimaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  formatRowContent: {
    flex: 1,
    gap: 4,
  },
  formatTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  formatSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  formatActionButton: {
    minWidth: 112,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  formatActionButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  skeletonBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
  },
  skeletonHeaderText: {
    flex: 1,
    gap: 8,
  },
  skeletonTitle: {
    height: 18,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    width: '60%',
  },
  skeletonSubtitle: {
    height: 13,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 6,
    width: '40%',
  },
  skeletonPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonPill: {
    width: 84,
    height: 28,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
  },
  skeletonSupportText: {
    height: 16,
    borderRadius: 8,
    width: '70%',
    backgroundColor: Colors.surfaceSecondary,
  },
  skeletonButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
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
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    maxHeight: '82%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 14,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetHeaderText: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetImage: {
    width: '100%',
    height: 132,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  sheetHint: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  sheetContent: {
    gap: 10,
    paddingBottom: 12,
  },
});

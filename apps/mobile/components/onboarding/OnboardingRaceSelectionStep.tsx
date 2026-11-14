import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Locale, MobileTranslations } from '../../locales/types';
import { Colors } from '../../constants/colors';
import { RaceEventSummaryCard } from '../race/RaceEventSummaryCard';
import { ActionButton } from '../themed/ActionButton';
import { Field } from '../themed/Field';
import { SheetHeader } from '../themed/SheetHeader';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';
import { OnboardingShell } from './OnboardingIntroSteps';

export type OnboardingRaceOption = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number | null;
  location_text: string | null;
  race_date: string | null;
  is_public: boolean;
  created_by: string | null;
  thumbnail_url?: string | null;
};

export type OnboardingRaceEventGroup = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url?: string | null;
  races: OnboardingRaceOption[];
};

type OnboardingRaceSelectionStepProps = {
  copy: MobileTranslations;
  locale: Locale;
  totalSteps: number;
  skippingOnboarding: boolean;
  onSkip: () => void;
  raceSearch: string;
  onChangeRaceSearch: (value: string) => void;
  loadingRaces: boolean;
  raceLoadError: string | null;
  onRetryRaces: () => void;
  raceEventGroups: OnboardingRaceEventGroup[];
  selectedRaceId: string | null;
  selectedRaceSummary: string | null;
  selectedRaceEvent: OnboardingRaceEventGroup | null;
  onOpenRaceEvent: (event: OnboardingRaceEventGroup) => void;
  onCloseRaceEvent: () => void;
  onSelectRace: (raceId: string) => void;
};

function formatEventDate(isoDate: string | null, locale: Locale) {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function getRaceShortLabel(raceName: string, eventName: string) {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-–—·]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function getEventImageUrl(
  event: Pick<OnboardingRaceEventGroup, 'thumbnail_url' | 'races'>,
): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

function getEventDistanceRange(races: OnboardingRaceOption[]) {
  if (races.length === 0) return null;

  const distances = races.map((race) => race.distance_km);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  if (Math.abs(maxDistance - minDistance) < 0.05) {
    return `${formatDistance(maxDistance)} km`;
  }

  return `${formatDistance(minDistance)}-${formatDistance(maxDistance)} km`;
}

export function OnboardingRaceSelectionStep({
  copy,
  locale,
  totalSteps,
  skippingOnboarding,
  onSkip,
  raceSearch,
  onChangeRaceSearch,
  loadingRaces,
  raceLoadError,
  onRetryRaces,
  raceEventGroups,
  selectedRaceId,
  selectedRaceSummary,
  selectedRaceEvent,
  onOpenRaceEvent,
  onCloseRaceEvent,
  onSelectRace,
}: OnboardingRaceSelectionStepProps) {
  const filteredRaceEventGroups = useMemo(() => {
    const normalizedSearch = raceSearch.trim().toLowerCase();

    return raceEventGroups
      .map((event) => {
        const eventMatchesName =
          normalizedSearch.length === 0 ||
          event.name.toLowerCase().includes(normalizedSearch) ||
          (event.location ?? '').toLowerCase().includes(normalizedSearch);
        const races = event.races.filter((race) => {
          if (eventMatchesName) return true;
          const location = race.location_text?.toLowerCase() ?? '';
          return race.name.toLowerCase().includes(normalizedSearch) || location.includes(normalizedSearch);
        });

        return { ...event, races };
      })
      .filter((event) => event.races.length > 0);
  }, [raceEventGroups, raceSearch]);
  const selectedRaceEventDate = selectedRaceEvent
    ? formatEventDate(selectedRaceEvent.race_date, locale)
    : null;
  const selectedRaceEventMeta = selectedRaceEvent
    ? [selectedRaceEvent.location, selectedRaceEventDate].filter(Boolean).join(' • ')
    : null;
  const selectedRaceEventImage = selectedRaceEvent ? getEventImageUrl(selectedRaceEvent) : null;
  const selectedRaceEventDistanceRange = selectedRaceEvent
    ? getEventDistanceRange(selectedRaceEvent.races)
    : null;
  const selectedRaceEventFormatsLabel = selectedRaceEvent
    ? selectedRaceEvent.races.length === 1
      ? copy.catalog.singleFormatLabel
      : copy.catalog.multipleFormatsLabel.replace('{count}', String(selectedRaceEvent.races.length))
    : null;

  return (
    <>
      <OnboardingShell
        step={5}
        totalSteps={totalSteps}
        stepLabel={copy.onboarding.stepLabel}
        skipLabel={copy.onboarding.skipOnboardingCta}
        skipDisabled={skippingOnboarding}
        onSkip={onSkip}
      >
        <Text style={styles.title}>{copy.onboarding.raceTitle}</Text>
        <Text style={styles.subtitle}>{copy.onboarding.raceSubtitle}</Text>
        <Text style={styles.predictionHint}>{copy.onboarding.raceHint}</Text>

        <View style={styles.racePickerPanel}>
          {selectedRaceSummary ? (
            <View style={styles.inlineInfoRow}>
              <View style={styles.selectionCountPill}>
                <Text style={styles.selectionCountText}>{selectedRaceSummary}</Text>
              </View>
            </View>
          ) : null}

          <Field
            accessibilityLabel={copy.onboarding.raceSearchPlaceholder}
            autoCapitalize="none"
            containerStyle={styles.searchField}
            onChangeText={onChangeRaceSearch}
            placeholder={copy.onboarding.raceSearchPlaceholder}
            value={raceSearch}
            variant="search"
          />

          {loadingRaces ? (
            <View style={styles.raceCenteredState}>
              <ActivityIndicator color={Colors.brandPrimary} />
              <Text style={styles.raceStateText}>{copy.onboarding.raceLoading}</Text>
            </View>
          ) : raceLoadError ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.errorText}>{raceLoadError}</Text>
              <ActionButton onPress={onRetryRaces} size="sm" variant="secondary">
                {copy.common.retry}
              </ActionButton>
            </View>
          ) : filteredRaceEventGroups.length === 0 ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.emptyTitle}>{copy.onboarding.raceEmptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{copy.onboarding.raceEmptySubtitle}</Text>
            </View>
          ) : (
            <View style={styles.raceEventList}>
              {filteredRaceEventGroups.map((event) => (
                <RaceEventSummaryCard
                  key={event.id}
                  event={event}
                  locale={locale}
                  viewFormatsLabel={copy.catalog.viewFormats}
                  singleFormatLabel={copy.catalog.singleFormatLabel}
                  multipleFormatsLabel={copy.catalog.multipleFormatsLabel}
                  chooseFormatHint={copy.catalog.chooseFormatHint}
                  onOpenFormats={() => onOpenRaceEvent(event)}
                />
              ))}

            </View>
          )}
        </View>
      </OnboardingShell>

      <Modal
        visible={Boolean(selectedRaceEvent)}
        animationType="slide"
        transparent
        onRequestClose={onCloseRaceEvent}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.sheetOverlay} onPress={onCloseRaceEvent} />
          <SafeAreaView accessibilityViewIsModal style={styles.sheetCard}>
            <SheetHeader
              closeLabel={copy.common.close}
              onClose={onCloseRaceEvent}
              subtitle={selectedRaceEventMeta}
              title={selectedRaceEvent?.name ?? ''}
            />

            {selectedRaceEventImage ? (
              <Image source={{ uri: selectedRaceEventImage }} style={styles.sheetImage} resizeMode="cover" />
            ) : null}

            <View style={styles.eventSummaryRow}>
              {selectedRaceEventFormatsLabel ? (
                <StatusPill label={selectedRaceEventFormatsLabel} />
              ) : null}
              {selectedRaceEventDistanceRange ? (
                <StatusPill label={selectedRaceEventDistanceRange} />
              ) : null}
            </View>

            <Text style={styles.sheetHint}>{copy.catalog.chooseFormatHint}</Text>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              {selectedRaceEvent?.races.map((race) => {
                const selected = race.id === selectedRaceId;

                return (
                  <TouchableOpacity
                    key={race.id}
                    style={[styles.formatRow, selected && styles.formatRowSelected]}
                    disabled={race.elevation_gain_m === null}
                    onPress={() => onSelectRace(race.id)}
                  >
                    <View style={styles.formatRowContent}>
                      <Text style={styles.formatTitle}>
                        {selectedRaceEvent
                          ? getRaceShortLabel(race.name, selectedRaceEvent.name)
                          : race.name}
                      </Text>
                      <Text style={styles.formatSubtitle}>
                        {race.elevation_gain_m === null
                          ? 'D+ inconnu'
                          : `${formatDistance(race.distance_km)} km • D+ ${Math.round(race.elevation_gain_m)} m`}
                      </Text>
                    </View>

                    {selected ? (
                      <StatusPill label={copy.onboarding.raceSelectedBadge} tone="brand" />
                    ) : (
                      <View style={styles.formatActionButton}>
                        <Text style={styles.formatActionButtonText}>{copy.catalog.selectRace}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  predictionHint: { color: Colors.brandPrimary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: -8, marginBottom: 20, fontWeight: '600' },
  racePickerPanel: { gap: 14, marginBottom: 16 },
  searchField: { marginBottom: 8 },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  raceCenteredState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  raceStateText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inlineInfoRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 12 },
  raceEventList: { gap: 16 },
  eventSummaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  selectionCountPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  selectionCountText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 24, 16, 0.24)' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject },
  sheetCard: { maxHeight: '82%', backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 14 },
  sheetImage: { width: '100%', height: 132, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  sheetHint: { color: Colors.textSecondary, fontSize: 14, lineHeight: 19 },
  sheetContent: { gap: 10, paddingBottom: 12 },
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  formatRowSelected: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandSurface },
  formatRowContent: { flex: 1, gap: 4 },
  formatTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  formatSubtitle: { color: Colors.textSecondary, fontSize: 13 },
  formatActionButton: { minWidth: 112, minHeight: 42, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.brandPrimary, backgroundColor: Colors.brandSurface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  formatActionButtonText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
});

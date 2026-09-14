import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Locale, MobileTranslations } from '../../locales/types';
import type { GpxFeedback, ImportedGpxDocument } from '../../lib/race-import';
import { Colors } from '../../constants/colors';
import { GpxImportPreviewModal } from '../race/GpxImportPreviewModal';
import { RaceEventSummaryCard } from '../race/RaceEventSummaryCard';
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
  personalRaceOptions: OnboardingRaceOption[];
  raceEventGroups: OnboardingRaceEventGroup[];
  publicRaceOptions: OnboardingRaceOption[];
  selectedRaceId: string | null;
  selectedRaceSummary: string | null;
  selectedRaceEvent: OnboardingRaceEventGroup | null;
  onOpenRaceEvent: (event: OnboardingRaceEventGroup) => void;
  onCloseRaceEvent: () => void;
  onSelectRace: (raceId: string) => void;
  importingRaceGpx: boolean;
  raceImportFeedback: GpxFeedback | null;
  onImportRaceGpx: () => void;
  pendingRaceGpxDocument: ImportedGpxDocument | null;
  pendingRaceGpxName: string;
  onChangePendingRaceGpxName: (value: string) => void;
  onCancelRaceGpxPreview: () => void;
  onConfirmRaceGpxImport: () => void;
};

function formatRaceDate(isoDate: string | null, locale: Locale) {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  personalRaceOptions,
  raceEventGroups,
  publicRaceOptions,
  selectedRaceId,
  selectedRaceSummary,
  selectedRaceEvent,
  onOpenRaceEvent,
  onCloseRaceEvent,
  onSelectRace,
  importingRaceGpx,
  raceImportFeedback,
  onImportRaceGpx,
  pendingRaceGpxDocument,
  pendingRaceGpxName,
  onChangePendingRaceGpxName,
  onCancelRaceGpxPreview,
  onConfirmRaceGpxImport,
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
  const filteredPersonalRaceOptions = useMemo(() => {
    const normalizedSearch = raceSearch.trim().toLowerCase();
    if (!normalizedSearch) return personalRaceOptions;

    return personalRaceOptions.filter((race) => {
      const location = race.location_text?.toLowerCase() ?? '';
      return race.name.toLowerCase().includes(normalizedSearch) || location.includes(normalizedSearch);
    });
  }, [personalRaceOptions, raceSearch]);
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

  const renderRaceOption = (race: OnboardingRaceOption) => {
    const selected = race.id === selectedRaceId;
    const raceMeta = [race.location_text, formatRaceDate(race.race_date, locale)]
      .filter(Boolean)
      .join(' • ');

    return (
      <TouchableOpacity
        key={race.id}
        style={[styles.raceChoiceCard, selected && styles.raceChoiceCardSelected]}
        disabled={race.elevation_gain_m === null}
        onPress={() => onSelectRace(race.id)}
      >
        <View style={styles.raceChoiceHeader}>
          <Text style={styles.raceChoiceTitle}>{race.name}</Text>
          {selected ? (
            <View style={styles.raceSelectedBadge}>
              <Text style={styles.raceSelectedBadgeText}>{copy.onboarding.raceSelectedBadge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.raceChoiceStats}>
          {race.distance_km} km •{' '}
          {race.elevation_gain_m === null ? 'D+ non renseigné' : `D+ ${race.elevation_gain_m} m`}
        </Text>
        {raceMeta ? <Text style={styles.raceChoiceMeta}>{raceMeta}</Text> : null}
      </TouchableOpacity>
    );
  };

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
          <View style={[styles.noticeBox, styles.raceImportNoticeBox]}>
            <Text style={styles.noticeTitle}>{copy.onboarding.raceImportTitle}</Text>
            <Text style={styles.noticeText}>{copy.onboarding.raceImportSubtitle}</Text>
            <TouchableOpacity
              style={[styles.importGpxButton, importingRaceGpx && styles.buttonDisabled]}
              onPress={onImportRaceGpx}
              disabled={importingRaceGpx}
            >
              {importingRaceGpx ? (
                <ActivityIndicator color={Colors.brandPrimary} />
              ) : (
                <View style={styles.importGpxButtonContent}>
                  <Ionicons name="document-attach-outline" size={18} color={Colors.brandPrimary} />
                  <Text style={styles.importGpxButtonText}>{copy.onboarding.raceImportCta}</Text>
                </View>
              )}
            </TouchableOpacity>
            {raceImportFeedback ? (
              <View
                style={[
                  styles.importGpxFeedback,
                  raceImportFeedback.tone === 'warning' && styles.importGpxFeedbackWarning,
                ]}
              >
                <Text style={styles.importGpxFeedbackText}>{raceImportFeedback.message}</Text>
              </View>
            ) : null}
          </View>

          {selectedRaceSummary ? (
            <View style={styles.inlineInfoRow}>
              <View style={styles.selectionCountPill}>
                <Text style={styles.selectionCountText}>{selectedRaceSummary}</Text>
              </View>
            </View>
          ) : null}

          <TextInput
            style={styles.textInput}
            value={raceSearch}
            onChangeText={onChangeRaceSearch}
            placeholder={copy.onboarding.raceSearchPlaceholder}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />

          {loadingRaces ? (
            <View style={styles.raceCenteredState}>
              <ActivityIndicator color={Colors.brandPrimary} />
              <Text style={styles.raceStateText}>{copy.onboarding.raceLoading}</Text>
            </View>
          ) : raceLoadError ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.errorText}>{raceLoadError}</Text>
              <TouchableOpacity style={styles.retryButtonInline} onPress={onRetryRaces}>
                <Text style={styles.retryButtonInlineText}>{copy.common.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : filteredPersonalRaceOptions.length === 0 && filteredRaceEventGroups.length === 0 ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.emptyTitle}>{copy.onboarding.raceEmptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{copy.onboarding.raceEmptySubtitle}</Text>
            </View>
          ) : (
            <View style={styles.raceEventList}>
              {filteredPersonalRaceOptions.length > 0 ? (
                <View style={styles.raceGroup}>
                  <Text style={styles.raceGroupLabel}>{copy.races.myRaces}</Text>
                  {filteredPersonalRaceOptions.map(renderRaceOption)}
                </View>
              ) : null}

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

              {publicRaceOptions.length > 0 ? (
                <View style={styles.raceGroup}>
                  <Text style={styles.raceGroupLabel}>{copy.races.publicRaces}</Text>
                  {publicRaceOptions.map(renderRaceOption)}
                </View>
              ) : null}
            </View>
          )}
        </View>
      </OnboardingShell>

      <GpxImportPreviewModal
        visible={Boolean(pendingRaceGpxDocument)}
        document={pendingRaceGpxDocument}
        raceName={pendingRaceGpxName}
        onRaceNameChange={onChangePendingRaceGpxName}
        onCancel={onCancelRaceGpxPreview}
        onConfirm={onConfirmRaceGpxImport}
        confirming={importingRaceGpx}
      />

      <Modal
        visible={Boolean(selectedRaceEvent)}
        animationType="slide"
        transparent
        onRequestClose={onCloseRaceEvent}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.sheetOverlay} onPress={onCloseRaceEvent} />
          <SafeAreaView style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>{selectedRaceEvent?.name}</Text>
                {selectedRaceEventMeta ? <Text style={styles.sheetSubtitle}>{selectedRaceEventMeta}</Text> : null}
              </View>
              <TouchableOpacity style={styles.sheetCloseButton} onPress={onCloseRaceEvent}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedRaceEventImage ? (
              <Image source={{ uri: selectedRaceEventImage }} style={styles.sheetImage} resizeMode="cover" />
            ) : null}

            <View style={styles.eventSummaryRow}>
              {selectedRaceEventFormatsLabel ? (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>{selectedRaceEventFormatsLabel}</Text>
                </View>
              ) : null}
              {selectedRaceEventDistanceRange ? (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>{selectedRaceEventDistanceRange}</Text>
                </View>
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
                          ? 'D+ non renseigné'
                          : `${formatDistance(race.distance_km)} km • D+ ${Math.round(race.elevation_gain_m)} m`}
                      </Text>
                    </View>

                    {selected ? (
                      <View style={styles.raceSelectedBadge}>
                        <Text style={styles.raceSelectedBadgeText}>
                          {copy.onboarding.raceSelectedBadge}
                        </Text>
                      </View>
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
  textInput: { backgroundColor: Colors.surfaceSecondary, color: Colors.textPrimary, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 8 },
  buttonDisabled: { opacity: 0.6 },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  raceCenteredState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  raceStateText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  retryButtonInline: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface },
  retryButtonInlineText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inlineInfoRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 12 },
  raceEventList: { gap: 16 },
  raceGroup: { gap: 0 },
  raceGroupLabel: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  raceChoiceCard: { borderLeftWidth: 3, borderLeftColor: 'transparent', borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 13, gap: 5 },
  raceChoiceCardSelected: { borderLeftColor: Colors.brandPrimary, borderBottomColor: 'transparent', backgroundColor: Colors.brandSurface },
  raceChoiceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  raceChoiceTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  raceChoiceStats: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  raceChoiceMeta: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  eventSummaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  summaryPillText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  selectionCountPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  selectionCountText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '700' },
  raceSelectedBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.brandPrimary },
  raceSelectedBadgeText: { color: Colors.textOnBrand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  noticeBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 8, marginBottom: 24 },
  raceImportNoticeBox: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, marginBottom: 2 },
  noticeTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  noticeText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  importGpxButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.brandBorder, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 4 },
  importGpxButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  importGpxButtonText: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '700' },
  importGpxFeedback: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  importGpxFeedbackWarning: { borderColor: Colors.warning },
  importGpxFeedbackText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 24, 16, 0.24)' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject },
  sheetCard: { maxHeight: '82%', backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 14 },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: Colors.border, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sheetHeaderText: { flex: 1, gap: 4 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  sheetCloseButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
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

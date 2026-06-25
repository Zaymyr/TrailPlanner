import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DataText } from '../../../../components/themed/DataText';
import { Heading } from '../../../../components/themed/Heading';
import { Text } from '../../../../components/themed/Text';
import { Colors } from '../../../../constants/colors';
import { useI18n } from '../../../../lib/i18n';
import { fetchRaceRacebookData, type RacebookAidStation, type RacebookScreenData } from '../../../../lib/racebook';

type RacebookTabKey = 'profile' | 'gear' | 'access' | 'aid';

function formatDateRange(startDate: string | null, endDate: string | null, locale: 'fr' | 'en'): string | null {
  if (!startDate && !endDate) return null;

  const formatDate = (value: string | null) => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start && end && start !== end) {
    return `${start} - ${end}`;
  }

  return start ?? end;
}

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function formatElevation(elevationGainM: number) {
  return Math.round(elevationGainM).toString();
}

function formatStationDistance(km: number) {
  return `${formatDistance(km)} km`;
}

function compactList(values: string[], maxItems = 3): string[] {
  if (values.length <= maxItems) return values;
  return [...values.slice(0, maxItems), `+${values.length - maxItems}`];
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return <Text style={styles.emptyText}>{message}</Text>;
}

function InfoList({ values }: { values: string[] }) {
  return (
    <View style={styles.listGroup}>
      {values.map((value) => (
        <View key={value} style={styles.listRow}>
          <View style={styles.listDot} />
          <Text style={styles.listText}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ChipRow({ values }: { values: string[] }) {
  return (
    <View style={styles.chipRow}>
      {values.map((value) => (
        <View key={value} style={styles.chip}>
          <Text style={styles.chipText}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function AidStationCard({
  station,
  locale,
}: {
  station: RacebookAidStation;
  locale: 'fr' | 'en';
}) {
  const serviceChips = [
    station.waterAvailable ? (locale === 'fr' ? 'Eau' : 'Water') : null,
    station.solidAvailable ? (locale === 'fr' ? 'Solide' : 'Food') : null,
    station.assistanceAllowed ? (locale === 'fr' ? 'Assistance' : 'Crew') : null,
    station.organizerDetails.dropBagAvailable ? (locale === 'fr' ? 'Sac' : 'Drop bag') : null,
    station.organizerDetails.cutoffTime
      ? locale === 'fr'
        ? `Barrière ${station.organizerDetails.cutoffTime}`
        : `Cutoff ${station.organizerDetails.cutoffTime}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const profileChips = [
    station.organizerDetails.cumulativeElevationGainM !== null
      ? `D+ ${Math.round(station.organizerDetails.cumulativeElevationGainM)} m`
      : null,
    station.organizerDetails.cumulativeElevationLossM !== null
      ? `D- ${Math.round(station.organizerDetails.cumulativeElevationLossM)} m`
      : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <View style={styles.aidStationCard}>
      <View style={styles.aidStationHeader}>
        <View style={styles.aidStationTitleWrap}>
          <Text style={styles.aidStationName}>{station.name}</Text>
          <DataText style={styles.aidStationDistance}>{formatStationDistance(station.km)}</DataText>
        </View>
        {profileChips.length > 0 ? <ChipRow values={profileChips} /> : null}
      </View>

      {serviceChips.length > 0 ? <ChipRow values={serviceChips} /> : null}

      {station.products.length > 0 ? (
        <View style={styles.inlineBlock}>
          <Text style={styles.inlineBlockTitle}>{locale === 'fr' ? 'Produits' : 'Products'}</Text>
          <ChipRow values={compactList(station.products.map((product) => product.label), 4)} />
        </View>
      ) : null}

      {station.organizerDetails.organizerNote || station.notes ? (
        <Text style={styles.noteText}>{station.organizerDetails.organizerNote ?? station.notes}</Text>
      ) : null}
    </View>
  );
}

export default function RaceRacebookScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { locale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<RacebookTabKey>('profile');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RacebookScreenData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    fetchRaceRacebookData(id)
      .then((result: RacebookScreenData | null) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const tabs = useMemo(
    () => [
      { key: 'profile' as const, label: t.catalog.racebookTabProfile },
      { key: 'gear' as const, label: t.catalog.racebookTabGear },
      { key: 'access' as const, label: t.catalog.racebookTabAccess },
      { key: 'aid' as const, label: t.catalog.racebookTabAid },
    ],
    [t.catalog.racebookTabAccess, t.catalog.racebookTabAid, t.catalog.racebookTabGear, t.catalog.racebookTabProfile],
  );

  const headerDate = formatDateRange(
    data?.event.raceDate ?? data?.race.raceDate ?? null,
    data?.event.organizerDetails.dateRange.endDate ?? null,
    locale,
  );

  const headerLocation = data?.event.location ?? data?.race.location ?? null;
  const eventMeta = [headerLocation, headerDate].filter(Boolean) as string[];

  const profileSections = useMemo(() => {
    if (!data) return [];

    const runnerDetails = data.runnerDetails;
    const scheduleLines = [
      runnerDetails.schedule.startTime
        ? locale === 'fr'
          ? `Départ ${runnerDetails.schedule.startTime}`
          : `Start ${runnerDetails.schedule.startTime}`
        : null,
      runnerDetails.schedule.finishCutoffTime
        ? locale === 'fr'
          ? `Barrière arrivée ${runnerDetails.schedule.finishCutoffTime}`
          : `Finish cutoff ${runnerDetails.schedule.finishCutoffTime}`
        : null,
      runnerDetails.schedule.cutoffNote,
      runnerDetails.schedule.note,
    ].filter((value): value is string => Boolean(value));

    const bibLines = [
      runnerDetails.bibPickup.location,
      runnerDetails.bibPickup.schedule,
      runnerDetails.bibPickup.requiredDocuments,
      runnerDetails.bibPickup.thirdPartyPickupAllowed === true
        ? locale === 'fr'
          ? 'Retrait par tiers autorisé'
          : 'Third-party pickup allowed'
        : null,
      runnerDetails.bibPickup.equipmentCheck === true
        ? locale === 'fr'
          ? 'Contrôle matériel prévu'
          : 'Equipment check planned'
        : null,
      runnerDetails.bibPickup.note,
    ].filter((value): value is string => Boolean(value));

    const runnerInfoVisible = runnerDetails.access.enabledSections.runnerInfo !== false;
    const runnerInfoLines = runnerInfoVisible
      ? [
          runnerDetails.runnerInfo.startArea,
          runnerDetails.runnerInfo.briefing,
          runnerDetails.runnerInfo.rules,
          runnerDetails.runnerInfo.note,
        ].filter((value): value is string => Boolean(value))
      : [];

    const servicesLines = [
      runnerDetails.services.supporters,
      runnerDetails.services.accommodations,
      runnerDetails.services.restaurants,
      runnerDetails.services.recovery,
      runnerDetails.services.partners,
      runnerDetails.services.lastMinuteMessage,
      runnerDetails.services.note,
    ].filter((value): value is string => Boolean(value));

    return [
      { title: t.catalog.racebookSectionSchedule, lines: scheduleLines },
      { title: t.catalog.racebookSectionBib, lines: bibLines },
      { title: t.catalog.racebookSectionRunnerInfo, lines: runnerInfoLines },
      { title: t.catalog.racebookSectionServices, lines: servicesLines },
    ].filter((section) => section.lines.length > 0);
  }, [data, locale, t.catalog.racebookSectionBib, t.catalog.racebookSectionRunnerInfo, t.catalog.racebookSectionSchedule, t.catalog.racebookSectionServices]);

  const accessSections = useMemo(() => {
    if (!data) return [];

    const access = data.runnerDetails.access;

    return [
      {
        title: t.catalog.racebookAccessGettingThere,
        lines: [access.startAddress, access.finishAddress].filter((value): value is string => Boolean(value)),
      },
      {
        title: t.catalog.racebookAccessParking,
        lines: access.enabledSections.officialParkings && access.officialParkings ? [access.officialParkings] : [],
      },
      {
        title: t.catalog.racebookAccessShuttles,
        lines:
          access.enabledSections.shuttles
            ? [access.shuttles, access.shuttleSchedule].filter((value): value is string => Boolean(value))
            : [],
      },
      {
        title: t.catalog.racebookAccessRestrictions,
        lines:
          access.enabledSections.roadRestrictions && access.roadRestrictions ? [access.roadRestrictions] : [],
      },
      {
        title: t.catalog.racebookAccessMap,
        lines: access.enabledSections.mapUrl && access.mapUrl ? [access.mapUrl] : [],
      },
      {
        title: t.catalog.racebookAccessNote,
        lines: access.note ? [access.note] : [],
      },
    ].filter((section) => section.lines.length > 0);
  }, [
    data,
    t.catalog.racebookAccessGettingThere,
    t.catalog.racebookAccessMap,
    t.catalog.racebookAccessNote,
    t.catalog.racebookAccessParking,
    t.catalog.racebookAccessRestrictions,
    t.catalog.racebookAccessShuttles,
  ]);

  const equipmentRequired = data?.runnerDetails.equipment.items
    .filter((item: RacebookScreenData['runnerDetails']['equipment']['items'][number]) => item.required)
    .map((item: RacebookScreenData['runnerDetails']['equipment']['items'][number]) => item.label) ?? [];
  const equipmentRecommended = data?.runnerDetails.equipment.items
    .filter((item: RacebookScreenData['runnerDetails']['equipment']['items'][number]) => !item.required)
    .map((item: RacebookScreenData['runnerDetails']['equipment']['items'][number]) => item.label) ?? [];
  const equipmentNotes = [data?.runnerDetails.equipment.note].filter((value): value is string => Boolean(value));

  const unavailable = !loading && (!data || !data.canOpen);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.brandPrimary} size="small" />
          <Text style={styles.loadingText}>{t.catalog.racebookLoading}</Text>
        </View>
      ) : unavailable ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="information-circle-outline" size={26} color={Colors.brandPrimary} />
          </View>
          <Heading variant="h3" style={styles.unavailableTitle}>
            {t.catalog.racebookUnavailableTitle}
          </Heading>
          <Text style={styles.unavailableBody}>{t.catalog.racebookUnavailableBody}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t.common.back}</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroBadge}>
                <Ionicons name="book-outline" size={18} color={Colors.brandPrimary} />
              </View>
              <View style={styles.heroHeaderText}>
                {data.event.name ? <Text style={styles.heroKicker}>{data.event.name}</Text> : null}
                <Heading variant="h2" style={styles.heroTitle}>
                  {data.race.name}
                </Heading>
                {eventMeta.length > 0 ? (
                  <Text style={styles.heroMeta}>{eventMeta.join(' • ')}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.heroSummaryRow}>
              <View style={styles.summaryChip}>
                <DataText style={styles.summaryChipText}>{`${formatDistance(data.race.distanceKm)} km`}</DataText>
              </View>
              <View style={styles.summaryChip}>
                <DataText style={styles.summaryChipText}>{`D+ ${formatElevation(data.race.elevationGainM)} m`}</DataText>
              </View>
              {data.runnerDetails.schedule.startTime ? (
                <View style={styles.summaryChip}>
                  <DataText style={styles.summaryChipText}>{data.runnerDetails.schedule.startTime}</DataText>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.tabsWrap}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.contentWrap}>
            {activeTab === 'profile' ? (
              profileSections.length > 0 ? (
                profileSections.map((section) => (
                  <SectionCard key={section.title} title={section.title}>
                    <InfoList values={section.lines} />
                  </SectionCard>
                ))
              ) : (
                <SectionCard title={t.catalog.racebookTabProfile}>
                  <EmptyState message={t.catalog.racebookEmptyProfile} />
                </SectionCard>
              )
            ) : null}

            {activeTab === 'gear' ? (
              <SectionCard title={t.catalog.racebookTabGear}>
                {equipmentRequired.length === 0 &&
                equipmentRecommended.length === 0 &&
                equipmentNotes.length === 0 ? (
                  <EmptyState message={t.catalog.racebookEmptyGear} />
                ) : (
                  <>
                    {equipmentRequired.length > 0 ? (
                      <View style={styles.inlineBlock}>
                        <Text style={styles.inlineBlockTitle}>{t.catalog.racebookGearRequired}</Text>
                        <ChipRow values={equipmentRequired} />
                      </View>
                    ) : null}
                    {equipmentRecommended.length > 0 ? (
                      <View style={styles.inlineBlock}>
                        <Text style={styles.inlineBlockTitle}>{t.catalog.racebookGearRecommended}</Text>
                        <ChipRow values={equipmentRecommended} />
                      </View>
                    ) : null}
                    {equipmentNotes.length > 0 ? <InfoList values={equipmentNotes} /> : null}
                  </>
                )}
              </SectionCard>
            ) : null}

            {activeTab === 'access' ? (
              accessSections.length > 0 ? (
                accessSections.map((section) => (
                  <SectionCard key={section.title} title={section.title}>
                    {section.title === t.catalog.racebookAccessMap && section.lines[0]?.startsWith('http') ? (
                      <TouchableOpacity onPress={() => Linking.openURL(section.lines[0]!).catch(() => {})}>
                        <Text style={styles.linkText}>{section.lines[0]}</Text>
                      </TouchableOpacity>
                    ) : (
                      <InfoList values={section.lines} />
                    )}
                  </SectionCard>
                ))
              ) : (
                <SectionCard title={t.catalog.racebookTabAccess}>
                  <EmptyState message={t.catalog.racebookEmptyAccess} />
                </SectionCard>
              )
            ) : null}

            {activeTab === 'aid' ? (
              data.aidStations.length > 0 ? (
                <SectionCard title={t.catalog.racebookTabAid}>
                  <View style={styles.aidStationsWrap}>
                    {data.aidStations.map((station: RacebookAidStation) => (
                      <AidStationCard key={station.id} station={station} locale={locale} />
                    ))}
                  </View>
                </SectionCard>
              ) : (
                <SectionCard title={t.catalog.racebookTabAid}>
                  <EmptyState message={t.catalog.racebookEmptyAid} />
                </SectionCard>
              )
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
    backgroundColor: Colors.background,
  },
  centerState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  unavailableTitle: {
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  unavailableBody: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandPrimary,
  },
  backButtonText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  heroHeaderText: {
    flex: 1,
    gap: 4,
  },
  heroKicker: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: Colors.textPrimary,
  },
  heroMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  tabsWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabButtonActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  tabButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: Colors.textOnBrand,
  },
  contentWrap: {
    gap: 12,
  },
  sectionCard: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  listGroup: {
    gap: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: Colors.brandPrimary,
  },
  listText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  chipText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineBlock: {
    gap: 8,
  },
  inlineBlockTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  linkText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  aidStationsWrap: {
    gap: 12,
  },
  aidStationCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aidStationHeader: {
    gap: 8,
  },
  aidStationTitleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  aidStationName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  aidStationDistance: {
    color: Colors.brandPrimary,
    fontSize: 12,
  },
  noteText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

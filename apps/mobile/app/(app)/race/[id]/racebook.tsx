import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
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

type LabeledItem = {
  label: string;
  value: string;
};

type MetricItem = {
  label: string;
  value: string;
  tone?: 'neutral' | 'gain' | 'loss';
};

function formatDate(value: string | null, locale: 'fr' | 'en'): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function formatElevation(value: number | null) {
  if (value === null) return null;
  return Math.round(value).toString();
}

function formatStationDistance(km: number) {
  return `${formatDistance(km)} km`;
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

function LabeledInfoList({ items }: { items: LabeledItem[] }) {
  return (
    <View style={styles.listGroup}>
      {items.map((item) => (
        <View key={`${item.label}:${item.value}`} style={styles.tableRow}>
          <Text style={styles.tableLabel}>{item.label}</Text>
          <View style={styles.tableDivider} />
          <Text style={styles.tableValue}>{item.value}</Text>
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

function GearList({
  items,
  requiredLabel,
  recommendedLabel,
}: {
  items: RacebookScreenData['runnerDetails']['equipment']['items'];
  requiredLabel: string;
  recommendedLabel: string;
}) {
  return (
    <View style={styles.listGroup}>
      {items.map((item) => (
        <View key={`${item.id ?? item.label}-${item.required ? 'required' : 'recommended'}`} style={styles.gearRow}>
          <View style={styles.gearInlineRow}>
            <View style={styles.listDot} />
            <Text style={styles.gearLabel}>{item.label}</Text>
            <View style={[styles.statusBadge, item.required ? styles.statusBadgeRequired : styles.statusBadgeRecommended]}>
              <Text style={[styles.statusBadgeText, item.required ? styles.statusBadgeTextRequired : styles.statusBadgeTextRecommended]}>
                {item.required ? requiredLabel : recommendedLabel}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function ServicePill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.servicePill}>
      <Ionicons name={icon} size={14} color={Colors.brandPrimary} />
      <Text style={styles.servicePillText}>{label}</Text>
    </View>
  );
}

function AidStationCard({
  station,
  previousStation,
  copy,
}: {
  station: RacebookAidStation;
  previousStation?: RacebookAidStation;
  copy: {
    aidProducts: string;
    aidWater: string;
    aidFood: string;
    aidAssistance: string;
    aidDropBag: string;
    aidDistance: string;
    aidElevationGain: string;
    aidElevationLoss: string;
    aidCutoffTime: string;
  };
}) {
  const serviceItems = [
    station.waterAvailable ? { icon: 'water-outline' as const, label: copy.aidWater } : null,
    station.solidAvailable ? { icon: 'restaurant-outline' as const, label: copy.aidFood } : null,
    station.assistanceAllowed ? { icon: 'people-outline' as const, label: copy.aidAssistance } : null,
    station.organizerDetails.dropBagAvailable ? { icon: 'briefcase-outline' as const, label: copy.aidDropBag } : null,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const segmentGain = (() => {
    if (station.organizerDetails.cumulativeElevationGainM === null) return null;
    if (!previousStation || previousStation.organizerDetails.cumulativeElevationGainM === null) {
      return Math.round(station.organizerDetails.cumulativeElevationGainM);
    }
    return Math.round(station.organizerDetails.cumulativeElevationGainM - previousStation.organizerDetails.cumulativeElevationGainM);
  })();

  const segmentLoss = (() => {
    if (station.organizerDetails.cumulativeElevationLossM === null) return null;
    if (!previousStation || previousStation.organizerDetails.cumulativeElevationLossM === null) {
      return Math.round(station.organizerDetails.cumulativeElevationLossM);
    }
    return Math.round(station.organizerDetails.cumulativeElevationLossM - previousStation.organizerDetails.cumulativeElevationLossM);
  })();

  const metricItems: MetricItem[] = [
    { label: copy.aidDistance, value: formatStationDistance(station.km) },
    ...(segmentGain !== null ? [{ label: copy.aidElevationGain, value: `${segmentGain} m`, tone: 'gain' as const }] : []),
    ...(segmentLoss !== null ? [{ label: copy.aidElevationLoss, value: `${segmentLoss} m`, tone: 'loss' as const }] : []),
    ...(station.organizerDetails.cutoffTime ? [{ label: copy.aidCutoffTime, value: station.organizerDetails.cutoffTime }] : []),
  ];

  return (
    <View style={styles.aidStationCard}>
      <View style={styles.aidStationLayout}>
        <View style={styles.aidStationMainColumn}>
          <View style={styles.aidStationHeader}>
            <View style={styles.aidStationTitleWrap}>
              <Text style={styles.aidStationName}>{station.name}</Text>
            </View>
          </View>

          {serviceItems.length > 0 ? (
            <View style={styles.servicePillRow}>
              {serviceItems.map((item) => (
                <ServicePill key={`${station.id}-${item.label}`} icon={item.icon} label={item.label} />
              ))}
            </View>
          ) : null}

          {station.products.length > 0 ? (
            <View style={styles.inlineBlock}>
              <Text style={styles.inlineBlockTitle}>{copy.aidProducts}</Text>
              <ChipRow values={station.products.map((product) => product.label)} />
            </View>
          ) : null}

          {station.organizerDetails.organizerNote || station.notes ? (
            <Text style={styles.noteText}>{station.organizerDetails.organizerNote ?? station.notes}</Text>
          ) : null}
        </View>

        <View style={styles.aidStationMetricsColumn}>
          {metricItems.map((item) => (
            <View key={`${station.id}-${item.label}`} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <DataText
                style={[
                  styles.metricValue,
                  item.tone === 'gain' ? styles.segmentGainText : null,
                  item.tone === 'loss' ? styles.segmentLossText : null,
                ]}
              >
                {item.value}
              </DataText>
            </View>
          ))}
        </View>
      </View>
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

  const headerDate = formatDate(data?.race.raceDate ?? data?.event.raceDate ?? null, locale);
  const headerLocation = data?.event.location ?? data?.race.location ?? null;
  const eventMeta = [headerLocation, headerDate].filter(Boolean) as string[];
  const lastMinuteMessage = data?.runnerDetails.services.lastMinuteMessage ?? null;

  const profileSections = useMemo(() => {
    if (!data) return [];

    const runnerDetails = data.runnerDetails;
    const startInfoItems = [
      runnerDetails.schedule.startTime
        ? { label: t.catalog.racebookFieldStartTime, value: runnerDetails.schedule.startTime }
        : null,
      runnerDetails.access.startAddress
        ? { label: t.catalog.racebookFieldStartLocation, value: runnerDetails.access.startAddress }
        : null,
    ].filter((value): value is LabeledItem => Boolean(value));

    const bibItems = [
      runnerDetails.bibPickup.location
        ? { label: t.catalog.racebookFieldBibLocation, value: runnerDetails.bibPickup.location }
        : null,
      runnerDetails.bibPickup.schedule
        ? { label: t.catalog.racebookFieldBibWindow, value: runnerDetails.bibPickup.schedule }
        : null,
      runnerDetails.bibPickup.requiredDocuments
        ? { label: t.catalog.racebookFieldBibDocuments, value: runnerDetails.bibPickup.requiredDocuments }
        : null,
    ].filter((value): value is LabeledItem => Boolean(value));

    const bibLines = [
      runnerDetails.bibPickup.thirdPartyPickupAllowed === true ? t.catalog.racebookBibThirdPartyPickupAllowed : null,
      runnerDetails.bibPickup.equipmentCheck === true ? t.catalog.racebookBibEquipmentCheck : null,
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
      runnerDetails.services.note,
    ].filter((value): value is string => Boolean(value));

    return [
      { title: t.catalog.racebookSectionStartInfo, items: startInfoItems, lines: [] as string[] },
      { title: t.catalog.racebookSectionBib, items: bibItems, lines: bibLines },
      { title: t.catalog.racebookSectionRunnerInfo, items: [] as LabeledItem[], lines: runnerInfoLines },
      { title: t.catalog.racebookSectionServices, items: [] as LabeledItem[], lines: servicesLines },
    ].filter((section) => section.items.length > 0 || section.lines.length > 0);
  }, [
    data,
    t.catalog.racebookBibEquipmentCheck,
    t.catalog.racebookBibThirdPartyPickupAllowed,
    t.catalog.racebookFieldBibDocuments,
    t.catalog.racebookFieldBibLocation,
    t.catalog.racebookFieldBibWindow,
    t.catalog.racebookFieldStartLocation,
    t.catalog.racebookFieldStartTime,
    t.catalog.racebookSectionBib,
    t.catalog.racebookSectionRunnerInfo,
    t.catalog.racebookSectionServices,
    t.catalog.racebookSectionStartInfo,
  ]);

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

  const equipmentItems = data?.runnerDetails.equipment.items ?? [];
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
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t.common.back}</Text>
          </Pressable>
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
                {eventMeta.length > 0 ? <Text style={styles.heroMeta}>{eventMeta.join(' • ')}</Text> : null}
              </View>
            </View>

            <View style={styles.heroSummaryRow}>
              <View style={styles.summaryChip}>
                <DataText style={styles.summaryChipText}>{`${formatDistance(data.race.distanceKm)} km`}</DataText>
              </View>
              <View style={styles.summaryChip}>
                <DataText style={styles.summaryChipText}>{`D+ ${formatElevation(data.race.elevationGainM)} m`}</DataText>
              </View>
              {data.race.elevationLossM !== null ? (
                <View style={styles.summaryChip}>
                  <DataText style={styles.summaryChipText}>{`D- ${formatElevation(data.race.elevationLossM)} m`}</DataText>
                </View>
              ) : null}
              {data.runnerDetails.schedule.startTime ? (
                <View style={styles.summaryChip}>
                  <DataText style={styles.summaryChipText}>{data.runnerDetails.schedule.startTime}</DataText>
                </View>
              ) : null}
            </View>
          </View>

          {lastMinuteMessage ? (
            <View style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={styles.alertIconWrap}>
                  <Ionicons name="megaphone-outline" size={16} color={Colors.warning} />
                </View>
                <Text style={styles.alertTitle}>{t.catalog.racebookLastMinuteTitle}</Text>
              </View>
              <Text style={styles.alertBody}>{lastMinuteMessage}</Text>
            </View>
          ) : null}

          <View style={styles.tabsWrap}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.contentWrap}>
            {activeTab === 'profile' ? (
              profileSections.length > 0 ? (
                profileSections.map((section) => (
                  <SectionCard key={section.title} title={section.title}>
                    {section.items.length > 0 ? <LabeledInfoList items={section.items} /> : null}
                    {section.lines.length > 0 ? <InfoList values={section.lines} /> : null}
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
                {equipmentItems.length === 0 && equipmentNotes.length === 0 ? (
                  <EmptyState message={t.catalog.racebookEmptyGear} />
                ) : (
                  <>
                    {equipmentItems.length > 0 ? (
                      <GearList
                        items={equipmentItems}
                        requiredLabel={t.catalog.racebookGearRequired}
                        recommendedLabel={t.catalog.racebookGearRecommended}
                      />
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
                      <Pressable onPress={() => Linking.openURL(section.lines[0]!).catch(() => {})}>
                        <Text style={styles.linkText}>{section.lines[0]}</Text>
                      </Pressable>
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
                    {data.aidStations.map((station: RacebookAidStation, index: number) => (
                      <AidStationCard
                        key={station.id}
                        station={station}
                        previousStation={index > 0 ? data.aidStations[index - 1] : undefined}
                        copy={{
                          aidProducts: t.catalog.racebookAidProducts,
                          aidWater: t.catalog.racebookAidWater,
                          aidFood: t.catalog.racebookAidFood,
                          aidAssistance: t.catalog.racebookAidAssistance,
                          aidDropBag: t.catalog.racebookAidDropBag,
                          aidDistance: t.catalog.racebookAidDistance,
                          aidElevationGain: t.catalog.racebookAidElevationGain,
                          aidElevationLoss: t.catalog.racebookAidElevationLoss,
                          aidCutoffTime: t.catalog.racebookAidCutoffTime,
                        }}
                      />
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
  alertCard: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7C97A',
    backgroundColor: Colors.warningSurface,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6DA',
  },
  alertTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  alertBody: {
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
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
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableLabel: {
    flexShrink: 0,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tableDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  tableValue: {
    minWidth: 72,
    textAlign: 'right',
    color: Colors.textPrimary,
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
  gearRow: {
    width: '100%',
  },
  gearInlineRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  gearLabel: {
    flexShrink: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeRequired: {
    backgroundColor: '#FDECEA',
    borderColor: '#E9B0AA',
  },
  statusBadgeRecommended: {
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D0FF',
  },
  statusBadgeText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextRequired: {
    color: Colors.danger,
  },
  statusBadgeTextRecommended: {
    color: '#2563EB',
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
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aidStationLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  aidStationMainColumn: {
    flex: 1,
    gap: 10,
  },
  aidStationHeader: {
    gap: 6,
  },
  aidStationTitleWrap: {
    gap: 8,
  },
  aidStationName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  aidStationMetricsColumn: {
    width: 88,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    gap: 8,
  },
  metricRow: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  servicePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  servicePillText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentGainText: {
    color: Colors.danger,
  },
  segmentLossText: {
    color: '#2563EB',
  },
  noteText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

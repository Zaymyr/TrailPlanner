import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ProfileMiniChart } from '../../../../components/plan-form/ProfileMiniChart';
import { RacebookLeafletMap } from '../../../../components/race/RacebookLeafletMap';
import { Card } from '../../../../components/themed/Card';
import { DataText } from '../../../../components/themed/DataText';
import { Heading } from '../../../../components/themed/Heading';
import { Text } from '../../../../components/themed/Text';
import { Colors } from '../../../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../../../lib/gpx';
import { useI18n } from '../../../../lib/i18n';
import { fetchRaceElevationProfile, fetchRaceRoutePreviewPoints } from '../../../../lib/raceProfile';
import { fetchRaceRacebookData, type RacebookAidStation, type RacebookScreenData } from '../../../../lib/racebook';
import type { ElevationPoint } from '../../../../components/plan-form/profile-utils';

type RacebookTabKey = 'gear' | 'bib' | 'course' | 'access' | 'services';

type LabeledItem = {
  label: string;
  value: string;
  actionUrl: string | null;
  dataValue?: boolean;
  tone?: 'neutral' | 'positive' | 'critical';
};

type MetricItem = {
  label: string;
  value: string;
  tone?: 'neutral' | 'gain' | 'loss';
};

type AccessSection = {
  title: string;
  items?: LabeledItem[];
  lines?: string[];
  linkUrl?: string | null;
};

type BibPickupSlot = RacebookScreenData['runnerDetails']['bibPickup']['locations'][number]['slots'][number];

type BibPickupDayGroup = {
  key: string;
  label: string;
  timeRanges: string[];
};

type BibPickupLocationGroup = {
  key: string;
  location: string;
  actionUrl: string | null;
  days: BibPickupDayGroup[];
};

function sortGearItems(items: RacebookScreenData['runnerDetails']['equipmentStatus']['items']) {
  return [...items].sort((left, right) => {
    const leftGroup = !left.active ? 2 : left.required ? 0 : 1;
    const rightGroup = !right.active ? 2 : right.required ? 0 : 1;

    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    return 0;
  });
}

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

function formatDateRange(startDate: string | null, endDate: string | null, locale: 'fr' | 'en'): string | null {
  const start = formatDate(startDate, locale);
  const end = formatDate(endDate, locale);

  if (!start) return end;
  if (!end || start === end) return start;
  return `${start} – ${end}`;
}

function buildTelephoneUrl(phone: string): string | null {
  const normalized = phone.trim().replace(/(?!^\+)[^\d]/g, '');
  return normalized.length > 0 ? `tel:${normalized}` : null;
}

function formatBibPickupDate(value: string | null, locale: 'fr' | 'en'): string | null {
  if (!value) return null;

  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;

  const formatted = parsed.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${formatted.charAt(0).toLocaleUpperCase(locale === 'fr' ? 'fr-FR' : 'en-US')}${formatted.slice(1)}`;
}

function formatBibPickupTime(value: string | null, locale: 'fr' | 'en'): string | null {
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;

  const hour = String(Number(match[1]));
  return locale === 'fr' ? `${hour}h${match[2]}` : `${hour.padStart(2, '0')}:${match[2]}`;
}

function groupBibPickupSlots(
  slots: BibPickupSlot[],
  locale: 'fr' | 'en',
  fallbackDayLabel: string,
): BibPickupDayGroup[] {
  const groups = new Map<string, BibPickupDayGroup>();

  slots.forEach((slot, slotIndex) => {
    const dateKey = slot.date ?? `undated-${slotIndex}`;
    const startTime = formatBibPickupTime(slot.startTime, locale);
    const endTime = formatBibPickupTime(slot.endTime, locale);
    const timeRange = [startTime, endTime].filter(Boolean).join(' – ');
    const existing = groups.get(dateKey);

    if (existing) {
      if (timeRange) existing.timeRanges.push(timeRange);
      return;
    }

    groups.set(dateKey, {
      key: dateKey,
      label: formatBibPickupDate(slot.date, locale) ?? fallbackDayLabel,
      timeRanges: timeRange ? [timeRange] : [],
    });
  });

  return [...groups.values()];
}

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
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
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <Text style={styles.emptyText}>{message}</Text>;
}

function CourseProfileCard({
  title,
  points,
  emptyMessage,
}: {
  title: string;
  points: ElevationPoint[];
  emptyMessage: string;
}) {
  return (
    <SectionCard title={title}>
      {points.length >= 2 ? (
        <View style={styles.courseProfileWrap}>
          <ProfileMiniChart points={points} />
          <View style={styles.courseProfileMetaRow}>
            <DataText style={styles.courseProfileMetaText}>{`${formatDistance(points[0]?.distanceKm ?? 0)} km`}</DataText>
            <DataText style={styles.courseProfileMetaText}>{`${formatDistance(points[points.length - 1]?.distanceKm ?? 0)} km`}</DataText>
          </View>
        </View>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </SectionCard>
  );
}

function CourseMapCard({
  title,
  points,
  emptyMessage,
}: {
  title: string;
  points: MobileGpxPreviewPoint[];
  emptyMessage: string;
}) {
  return (
    <SectionCard title={title}>
      {points.length >= 2 ? (
        <RacebookLeafletMap points={points} />
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </SectionCard>
  );
}

function InlineAlertCard({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <View style={styles.alertIconWrap}>
          <Ionicons name={icon} size={14} color={Colors.warning} />
        </View>
        <Text style={styles.alertInlineText}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertBody}>{` - ${message}`}</Text>
        </Text>
      </View>
    </View>
  );
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

function LabeledInfoList({ items, emphasis = false }: { items: LabeledItem[]; emphasis?: boolean }) {
  return (
    <View style={styles.listGroup}>
      {items.map((item) => (
        <View
          key={`${item.label}:${item.value}`}
          style={[
            styles.tableRow,
            emphasis ? styles.tableRowEmphasis : null,
            item.tone === 'positive' ? styles.tableRowPositive : null,
            item.tone === 'critical' ? styles.tableRowCritical : null,
          ]}
        >
          <Text style={[styles.tableLabel, emphasis ? styles.tableLabelEmphasis : null]}>{item.label}</Text>
          <View style={styles.tableDivider} />
          <View style={styles.tableValueWrap}>
            {item.actionUrl ? (
              <Pressable
                style={styles.tableValueAction}
                onPress={() => Linking.openURL(item.actionUrl!).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`Ouvrir ${item.label}`}
              >
                <Text style={[styles.tableValue, emphasis ? styles.tableValueEmphasis : null, styles.tableValueLink]}>
                  {item.value}
                </Text>
              </Pressable>
            ) : item.dataValue ? (
              <DataText
                tone={item.tone === 'critical' ? 'danger' : item.tone === 'positive' ? 'brand' : 'primary'}
                weight="semibold"
                style={[styles.tableValue, emphasis ? styles.tableValueEmphasis : null]}
              >
                {item.value}
              </DataText>
            ) : (
              <Text
                style={[
                  styles.tableValue,
                  emphasis ? styles.tableValueEmphasis : null,
                  item.tone === 'positive' ? styles.tableValuePositive : null,
                  item.tone === 'critical' ? styles.tableValueCritical : null,
                ]}
              >
                {item.value}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function BibPickupLocationList({
  groups,
  locationLabel,
}: {
  groups: BibPickupLocationGroup[];
  locationLabel: string;
}) {
  return (
    <View style={styles.bibLocationList}>
      {groups.map((group) => (
        <View key={group.key} style={styles.bibLocationCard}>
          <View style={styles.bibLocationHeader}>
            <View style={styles.bibLocationIcon}>
              <Ionicons name="location-outline" size={18} color={Colors.brandPrimary} />
            </View>
            <View style={styles.bibLocationTextWrap}>
              {group.actionUrl ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${locationLabel}: ${group.location}`}
                  onPress={() => Linking.openURL(group.actionUrl!).catch(() => {})}
                  style={styles.bibLocationAction}
                >
                  <Text style={[styles.bibLocationValue, styles.tableValueLink]}>{group.location}</Text>
                </Pressable>
              ) : (
                <Text style={styles.bibLocationValue}>{group.location}</Text>
              )}
            </View>
          </View>

          {group.days.length > 0 ? (
            <View style={styles.bibDayList}>
              {group.days.map((day) => (
                <View key={`${group.key}-${day.key}`} style={styles.bibDayRow}>
                  <Text style={styles.bibDayLabel}>{day.label}</Text>
                  {day.timeRanges.length > 0 ? (
                    <View style={styles.bibTimeList}>
                      {day.timeRanges.map((timeRange, timeIndex) => (
                        <DataText key={`${day.key}-${timeRange}-${timeIndex}`} style={styles.bibTimeValue}>
                          {timeRange}
                        </DataText>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function HeroDetailGroup({ title, values }: { title: string; values: string[] }) {
  return (
    <View style={styles.heroDetailGroup}>
      <Text style={styles.heroDetailTitle}>{title}</Text>
      <InfoList values={values} />
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
  coldWeatherLabel,
  hotWeatherLabel,
}: {
  items: RacebookScreenData['runnerDetails']['equipmentStatus']['items'];
  requiredLabel: string;
  recommendedLabel: string;
  coldWeatherLabel: string;
  hotWeatherLabel: string;
}) {
  const sortedItems = sortGearItems(items);

  return (
    <View style={styles.listGroup}>
      {sortedItems.map((item) => (
        <View key={`${item.id ?? item.label}-${item.required ? 'required' : 'recommended'}`} style={styles.gearRow}>
          <View style={styles.gearInlineRow}>
            <Text style={[styles.gearLabel, !item.active ? styles.gearLabelMuted : null]}>{item.label}</Text>
            {item.cold || item.heat ? (
              <View style={styles.weatherIconRow}>
                {item.cold ? (
                  <View
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={coldWeatherLabel}
                    style={[styles.weatherIconBadge, styles.weatherIconBadgeCold, !item.active ? styles.weatherIconBadgeMuted : null]}
                  >
                    <Ionicons name="snow-outline" size={12} color="#2563EB" />
                  </View>
                ) : null}
                {item.heat ? (
                  <View
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={hotWeatherLabel}
                    style={[styles.weatherIconBadge, styles.weatherIconBadgeHeat, !item.active ? styles.weatherIconBadgeMuted : null]}
                  >
                    <Ionicons name="thermometer-outline" size={12} color={Colors.warning} />
                  </View>
                ) : null}
              </View>
            ) : null}
            <View
              style={[
                styles.statusBadge,
                item.required ? styles.statusBadgeRequired : styles.statusBadgeRecommended,
                !item.active ? styles.statusBadgeMuted : null,
              ]}
            >
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

function ServiceIconButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: active }}
      hitSlop={4}
      onPress={onPress}
      style={[styles.serviceIconButton, active ? styles.serviceIconButtonActive : null]}
    >
      <Ionicons name={icon} size={17} color={active ? Colors.textOnBrand : Colors.brandPrimary} />
    </Pressable>
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
  const [activeServiceLabel, setActiveServiceLabel] = useState<string | null>(null);
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
            <View style={styles.serviceInfoGroup}>
              <View style={styles.serviceIconRow}>
                {serviceItems.map((item) => (
                  <ServiceIconButton
                    key={`${station.id}-${item.label}`}
                    icon={item.icon}
                    label={item.label}
                    active={activeServiceLabel === item.label}
                    onPress={() => {
                      setActiveServiceLabel((current) => (current === item.label ? null : item.label));
                    }}
                  />
                ))}
              </View>
              {activeServiceLabel ? (
                <View style={styles.serviceTooltip} accessibilityLiveRegion="polite">
                  <Text style={styles.serviceTooltipText}>{activeServiceLabel}</Text>
                </View>
              ) : null}
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
              <Text style={styles.metricLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <DataText
                numberOfLines={1}
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
  const [activeTab, setActiveTab] = useState<RacebookTabKey>('gear');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<RacebookScreenData | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [routePreviewPoints, setRoutePreviewPoints] = useState<MobileGpxPreviewPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      fetchRaceRacebookData(id),
      fetchRaceElevationProfile(id),
      fetchRaceRoutePreviewPoints(id),
    ])
      .then(([result, profilePoints, routePoints]: [RacebookScreenData | null, ElevationPoint[], MobileGpxPreviewPoint[]]) => {
        if (!cancelled) {
          setData(result);
          setElevationProfile(profilePoints);
          setRoutePreviewPoints(routePoints);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setElevationProfile([]);
          setRoutePreviewPoints([]);
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

  const handleRefresh = useCallback(async () => {
    if (!id) return;

    setRefreshing(true);

    try {
      const [result, profilePoints, routePoints] = await Promise.all([
        fetchRaceRacebookData(id),
        fetchRaceElevationProfile(id),
        fetchRaceRoutePreviewPoints(id),
      ]);

      setData(result);
      setElevationProfile(profilePoints);
      setRoutePreviewPoints(routePoints);
    } catch {
      // Keep the last successfully loaded Racebook visible when a refresh fails.
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  const eventDateRange = formatDateRange(
    data?.event.raceDate ?? null,
    data?.event.organizerDetails.dateRange.endDate ?? null,
    locale,
  );
  const formattedRaceDate = formatDate(data?.race.raceDate ?? null, locale);
  const formattedEventStartDate = formatDate(data?.event.raceDate ?? null, locale);
  const showDistinctRaceDate = Boolean(formattedRaceDate && formattedRaceDate !== formattedEventStartDate);
  const eventLocationDetails = data?.event.organizerDetails.eventLocation;
  const raceLocationDetails = data?.race.organizerDetails.raceLocation;
  const headerLocation =
    data?.event.location ??
    eventLocationDetails?.label ??
    data?.race.location ??
    raceLocationDetails?.label ??
    null;
  const headerLocationUrl =
    (data?.event.location ?? eventLocationDetails?.label)
      ? eventLocationDetails?.googleMapsUrl ?? null
      : raceLocationDetails?.googleMapsUrl ?? null;
  const weatherPlan = data?.runnerDetails.equipmentStatus.weatherPlan ?? 'normal';
  const weatherAlertMessage =
    weatherPlan === 'cold'
      ? 'Plan grand froid activé - vérifie le matériel'
      : weatherPlan === 'heat'
        ? 'Plan grosse chaleur activé - vérifie le matériel'
        : null;
  const weatherAlertIcon = weatherPlan === 'heat' ? 'thermometer-outline' : 'snow-outline';
  const lastMinuteMessage = data?.runnerDetails.services.lastMinuteMessage ?? null;
  const officialWebsiteUrl = data?.event.organizerDetails.officialWebsiteUrl ?? null;
  const emergencyContact = data?.event.organizerDetails.emergencyContact;
  const emergencyTelephoneUrl = emergencyContact?.phone ? buildTelephoneUrl(emergencyContact.phone) : null;

  const runnerInfoLines = useMemo(() => {
    if (!data || data.runnerDetails.access.enabledSections.runnerInfo === false) return [];

    return [
      data.runnerDetails.runnerInfo.startArea,
      data.runnerDetails.runnerInfo.briefing,
      data.runnerDetails.runnerInfo.rules,
      data.runnerDetails.runnerInfo.note,
    ].filter((value): value is string => Boolean(value));
  }, [data]);

  const serviceSections = useMemo(() => {
    if (!data) return [];

    return [
      { title: t.catalog.racebookServiceSupporters, value: data.runnerDetails.services.supporters },
      { title: t.catalog.racebookServiceAccommodations, value: data.runnerDetails.services.accommodations },
      { title: t.catalog.racebookServiceRestaurants, value: data.runnerDetails.services.restaurants },
      { title: t.catalog.racebookServiceRecovery, value: data.runnerDetails.services.recovery },
      { title: t.catalog.racebookServicePartners, value: data.runnerDetails.services.partners },
      { title: t.catalog.racebookSectionAdditionalInfo, value: data.runnerDetails.services.note },
    ].filter((section): section is { title: string; value: string } => Boolean(section.value));
  }, [
    data,
    t.catalog.racebookSectionAdditionalInfo,
    t.catalog.racebookServiceAccommodations,
    t.catalog.racebookServicePartners,
    t.catalog.racebookServiceRecovery,
    t.catalog.racebookServiceRestaurants,
    t.catalog.racebookServiceSupporters,
  ]);

  const tabs = useMemo(() => {
    const availableTabs: Array<{ key: RacebookTabKey; label: string }> = [
      { key: 'gear', label: t.catalog.racebookTabGear },
      { key: 'bib', label: t.catalog.racebookTabBib },
      { key: 'course', label: t.catalog.racebookTabCourse },
      { key: 'access', label: t.catalog.racebookTabAccess },
    ];

    if (serviceSections.length > 0) {
      availableTabs.push({ key: 'services', label: t.catalog.racebookSectionServices });
    }

    return availableTabs;
  }, [
    serviceSections.length,
    t.catalog.racebookSectionServices,
    t.catalog.racebookTabAccess,
    t.catalog.racebookTabBib,
    t.catalog.racebookTabCourse,
    t.catalog.racebookTabGear,
  ]);

  useEffect(() => {
    if (activeTab === 'services' && serviceSections.length === 0) {
      setActiveTab('gear');
    }
  }, [activeTab, serviceSections.length]);

  const bibLocationGroups = useMemo(() => {
    if (!data) return [];

    const bibPickup = data.runnerDetails.bibPickup;
    const pickupLocations =
      bibPickup.locations.length > 0
        ? bibPickup.locations
        : bibPickup.location
          ? [{ location: bibPickup.location, locationDetails: bibPickup.locationDetails, slots: [] }]
          : [];
    return pickupLocations
      .map((pickupLocation, locationIndex): BibPickupLocationGroup | null => {
        if (!pickupLocation.location) return null;

        return {
          key: `${pickupLocation.location}-${locationIndex}`,
          location: pickupLocation.location,
          actionUrl: pickupLocation.locationDetails.googleMapsUrl,
          days: groupBibPickupSlots(pickupLocation.slots, locale, t.catalog.racebookFieldBibWindow),
        };
      })
      .filter((value): value is BibPickupLocationGroup => Boolean(value));
  }, [data, locale, t.catalog.racebookFieldBibWindow]);

  const bibItems = useMemo(() => {
    if (!data) return [];

    const bibPickup = data.runnerDetails.bibPickup;
    const items: Array<LabeledItem | null> = [
      bibPickup.schedule
        ? { label: t.catalog.racebookFieldBibWindow, value: bibPickup.schedule, actionUrl: null }
        : null,
      bibPickup.requiredDocuments
        ? { label: t.catalog.racebookFieldBibDocuments, value: bibPickup.requiredDocuments, actionUrl: null }
        : null,
    ];

    return items.filter((value): value is LabeledItem => Boolean(value));
  }, [data, t.catalog.racebookFieldBibDocuments, t.catalog.racebookFieldBibWindow]);

  const bibLines = useMemo(() => {
    if (!data) return [];

    const bibPickup = data.runnerDetails.bibPickup;
    return [
      bibPickup.thirdPartyPickupAllowed === true ? t.catalog.racebookBibThirdPartyPickupAllowed : null,
      bibPickup.equipmentCheck === true ? t.catalog.racebookBibEquipmentCheck : null,
      bibPickup.note,
    ].filter((value): value is string => Boolean(value));
  }, [data, t.catalog.racebookBibEquipmentCheck, t.catalog.racebookBibThirdPartyPickupAllowed]);

  const courseItems = useMemo(() => {
    if (!data) return [];

    const schedule = data.runnerDetails.schedule;
    const items: Array<LabeledItem | null> = [
      schedule.startTime
        ? {
            label: t.catalog.racebookFieldStartTime,
            value: schedule.startTime,
            actionUrl: null,
            dataValue: true,
            tone: 'positive' as const,
          }
        : null,
      schedule.finishCutoffTime
        ? {
            label: t.catalog.racebookFieldFinishCutoff,
            value: schedule.finishCutoffTime,
            actionUrl: null,
            dataValue: true,
            tone: 'critical' as const,
          }
        : null,
    ];

    return items.filter((value): value is LabeledItem => Boolean(value));
  }, [
    data,
    t.catalog.racebookFieldFinishCutoff,
    t.catalog.racebookFieldStartTime,
  ]);

  const courseConstraintLines = useMemo(() => {
    if (!data) return [];
    return [data.runnerDetails.schedule.cutoffNote, data.runnerDetails.schedule.note].filter(
      (value): value is string => Boolean(value),
    );
  }, [data]);

  const relaySegments = useMemo(() => {
    if (!data || data.race.participationMode === null || data.race.participationMode === 'solo') return [];
    const boundaries = [
      { name: t.catalog.racebookMapStart, km: 0, handoverTime: null, cutoffTime: null, notes: null },
      ...data.relayPoints.map((point) => ({
        name: point.name,
        km: point.km,
        handoverTime: point.handoverTime,
        cutoffTime: point.cutoffTime,
        notes: point.notes,
      })),
      { name: t.catalog.racebookMapFinish, km: data.race.distanceKm, handoverTime: null, cutoffTime: null, notes: null },
    ];

    return boundaries.slice(0, -1).map((start, index) => ({
      start,
      end: boundaries[index + 1],
      distanceKm: Math.max(0, boundaries[index + 1].km - start.km),
    }));
  }, [data, t.catalog.racebookMapFinish, t.catalog.racebookMapStart]);

  const participationLabel = data?.race.participationMode === 'solo'
    ? t.catalog.racebookParticipationSolo
    : data?.race.participationMode === 'relay'
      ? t.catalog.racebookParticipationRelay
      : data?.race.participationMode === 'solo_and_relay'
        ? t.catalog.racebookParticipationSoloAndRelay
        : null;

  const accessSections = useMemo(() => {
    if (!data) return [];

    const access = data.runnerDetails.access;

    const sections: AccessSection[] = [
      {
        title: t.catalog.racebookAccessLocations,
        items: [
          access.startAddress
            ? {
                label: t.catalog.racebookFieldStartLocation,
                value: access.startAddress,
                actionUrl: access.startLocation.googleMapsUrl,
              }
            : null,
          access.finishAddress
            ? {
                label: t.catalog.racebookFieldFinishLocation,
                value: access.finishAddress,
                actionUrl: access.finishLocation.googleMapsUrl,
              }
            : null,
        ].filter((value): value is LabeledItem => Boolean(value)),
      },
      {
        title: t.catalog.racebookAccessParking,
        lines: access.officialParkings ? [access.officialParkings] : [],
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
        linkUrl: access.enabledSections.mapUrl ? access.mapUrl : null,
      },
      {
        title: t.catalog.racebookAccessNote,
        lines: access.note ? [access.note] : [],
      },
    ];

    return sections.filter((section) => (section.items?.length ?? 0) > 0 || (section.lines?.length ?? 0) > 0);
  }, [
    data,
    t.catalog.racebookAccessLocations,
    t.catalog.racebookAccessMap,
    t.catalog.racebookAccessNote,
    t.catalog.racebookAccessParking,
    t.catalog.racebookAccessRestrictions,
    t.catalog.racebookAccessShuttles,
    t.catalog.racebookFieldFinishLocation,
    t.catalog.racebookFieldStartLocation,
  ]);

  const equipmentItems = data?.runnerDetails.equipmentStatus.items ?? [];
  const requiredEquipment = equipmentItems.filter((item) => item.active && item.required);
  const recommendedEquipment = equipmentItems.filter((item) => item.active && !item.required);
  const conditionalEquipment = equipmentItems.filter((item) => !item.active);
  const equipmentNotes = [data?.runnerDetails.equipment.note].filter((value): value is string => Boolean(value));
  const bibPrimaryItems = bibItems.filter((item) => item.label !== t.catalog.racebookFieldBibDocuments);
  const bibSecondaryItems = bibItems.filter((item) => item.label === t.catalog.racebookFieldBibDocuments);
  const hasCourseContent =
    courseItems.length > 0 ||
    courseConstraintLines.length > 0 ||
    routePreviewPoints.length >= 2 ||
    elevationProfile.length >= 2 ||
    relaySegments.length > 0 ||
    (data?.aidStations.length ?? 0) > 0;
  const unavailable = !loading && (!data || !data.canOpen);

  return (
      <ScrollView
        contentContainerStyle={styles.container}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.brandPrimary}
            colors={[Colors.brandPrimary]}
          />
        }
      >
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
          <Card style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroHeaderText}>
                {data.event.name && data.event.name !== data.race.name ? (
                  <Text style={styles.heroKicker}>{data.event.name}</Text>
                ) : null}
                <Heading variant="h2" style={styles.heroTitle}>
                  {data.race.name}
                </Heading>
                <View style={styles.heroMetaGroup}>
                  {eventDateRange ? <Text style={styles.heroMeta}>{eventDateRange}</Text> : null}
                  {headerLocation ? (
                    headerLocationUrl ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Ouvrir ${headerLocation}`}
                        onPress={() => Linking.openURL(headerLocationUrl).catch(() => {})}
                        style={styles.heroLocationAction}
                      >
                        <Text style={[styles.heroMeta, styles.tableValueLink]}>{headerLocation}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.heroMeta}>{headerLocation}</Text>
                    )
                  ) : null}
                  {showDistinctRaceDate ? (
                    <Text style={styles.heroFormatDate}>
                      {`${t.catalog.racebookFieldFormatDate} · ${formattedRaceDate}`}
                    </Text>
                  ) : null}
                  {participationLabel ? <Text style={styles.heroFormatDate}>{participationLabel}</Text> : null}
                </View>
              </View>
              {officialWebsiteUrl ? (
                <View style={styles.heroQuickActions}>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={t.catalog.racebookOfficialWebsite}
                    onPress={() => Linking.openURL(officialWebsiteUrl).catch(() => {})}
                    style={({ pressed }) => [
                      styles.heroQuickAction,
                      styles.heroWebsiteAction,
                      pressed && styles.heroQuickActionPressed,
                    ]}
                  >
                    <Ionicons name="globe-outline" size={20} color={Colors.brandPrimary} />
                    <Text style={styles.heroQuickActionLabel} numberOfLines={2}>
                      {t.catalog.racebookOfficialWebsiteShort}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {emergencyContact?.phone && emergencyTelephoneUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t.catalog.racebookCallEmergency}
                onPress={() => Linking.openURL(emergencyTelephoneUrl).catch(() => {})}
                style={({ pressed }) => [
                  styles.heroQuickAction,
                  styles.heroEmergencyAction,
                  pressed && styles.heroQuickActionPressed,
                ]}
              >
                <Ionicons name="call-outline" size={20} color={Colors.danger} />
                <View style={styles.heroQuickActionText}>
                  <View style={styles.heroEmergencyLine}>
                    <Text style={[styles.heroQuickActionLabel, styles.heroEmergencyLabel]} numberOfLines={1}>
                      {t.catalog.racebookEmergencyShort}
                    </Text>
                    {emergencyContact.name ? (
                      <>
                        <Text style={styles.heroEmergencySeparator}>-</Text>
                        <Text style={styles.heroEmergencyName} numberOfLines={1}>
                          {emergencyContact.name}
                        </Text>
                      </>
                    ) : null}
                    <Text style={styles.heroEmergencySeparator}>-</Text>
                    <DataText style={styles.heroEmergencyPhone} numberOfLines={1}>
                      {emergencyContact.phone}
                    </DataText>
                  </View>
                </View>
              </Pressable>
            ) : null}

            {runnerInfoLines.length > 0 ? <View style={styles.heroDivider} /> : null}
            {runnerInfoLines.length > 0 ? (
              <HeroDetailGroup title={t.catalog.racebookSectionRunnerInfo} values={runnerInfoLines} />
            ) : null}
          </Card>

          {weatherAlertMessage ? <InlineAlertCard icon={weatherAlertIcon} title="Alerte météo" message={weatherAlertMessage} /> : null}

          {lastMinuteMessage ? (
            <InlineAlertCard icon="megaphone-outline" title={t.catalog.racebookLastMinuteTitle} message={lastMinuteMessage} />
          ) : null}

          <View style={styles.tabsWrap}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tabButton,
                    tabs.length === 5 ? styles.tabButtonCompact : null,
                    active && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      tabs.length === 5 ? styles.tabButtonTextCompact : null,
                      active && styles.tabButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.contentWrap}>
            {activeTab === 'gear' ? (
              equipmentItems.length === 0 && equipmentNotes.length === 0 ? (
                <SectionCard title={t.catalog.racebookTabGear}>
                  <EmptyState message={t.catalog.racebookEmptyGear} />
                </SectionCard>
              ) : (
                <>
                  {requiredEquipment.length > 0 ? (
                    <SectionCard title={t.catalog.racebookSectionGearRequired}>
                      <GearList
                        items={requiredEquipment}
                        requiredLabel={t.catalog.racebookGearRequired}
                        recommendedLabel={t.catalog.racebookGearRecommended}
                        coldWeatherLabel={t.catalog.racebookGearColdWeather}
                        hotWeatherLabel={t.catalog.racebookGearHotWeather}
                      />
                    </SectionCard>
                  ) : null}
                  {recommendedEquipment.length > 0 ? (
                    <SectionCard title={t.catalog.racebookSectionGearRecommended}>
                      <GearList
                        items={recommendedEquipment}
                        requiredLabel={t.catalog.racebookGearRequired}
                        recommendedLabel={t.catalog.racebookGearRecommended}
                        coldWeatherLabel={t.catalog.racebookGearColdWeather}
                        hotWeatherLabel={t.catalog.racebookGearHotWeather}
                      />
                    </SectionCard>
                  ) : null}
                  {conditionalEquipment.length > 0 ? (
                    <SectionCard title={t.catalog.racebookSectionGearConditional}>
                      <GearList
                        items={conditionalEquipment}
                        requiredLabel={t.catalog.racebookGearRequired}
                        recommendedLabel={t.catalog.racebookGearRecommended}
                        coldWeatherLabel={t.catalog.racebookGearColdWeather}
                        hotWeatherLabel={t.catalog.racebookGearHotWeather}
                      />
                    </SectionCard>
                  ) : null}
                  {equipmentNotes.length > 0 ? (
                    <SectionCard title={t.catalog.racebookSectionAdditionalInfo}>
                      <InfoList values={equipmentNotes} />
                    </SectionCard>
                  ) : null}
                </>
              )
            ) : null}

            {activeTab === 'bib' ? (
              <SectionCard title={t.catalog.racebookSectionBib}>
                {bibLocationGroups.length === 0 && bibItems.length === 0 && bibLines.length === 0 ? (
                  <EmptyState message={t.catalog.racebookEmptyBib} />
                ) : (
                  <>
                    {bibLocationGroups.length > 0 ? (
                      <BibPickupLocationList
                        groups={bibLocationGroups}
                        locationLabel={t.catalog.racebookFieldBibLocation}
                      />
                    ) : null}
                    {bibLocationGroups.length > 0 && (bibPrimaryItems.length > 0 || bibSecondaryItems.length > 0 || bibLines.length > 0) ? (
                      <View style={styles.sectionDivider} />
                    ) : null}
                    {bibPrimaryItems.length > 0 ? <LabeledInfoList items={bibPrimaryItems} emphasis /> : null}
                    {bibPrimaryItems.length > 0 && (bibSecondaryItems.length > 0 || bibLines.length > 0) ? (
                      <View style={styles.sectionDivider} />
                    ) : null}
                    {bibSecondaryItems.length > 0 ? <LabeledInfoList items={bibSecondaryItems} /> : null}
                    {bibLines.length > 0 ? <InfoList values={bibLines} /> : null}
                  </>
                )}
              </SectionCard>
            ) : null}

            {activeTab === 'course' ? (
              <>
                {courseItems.length > 0 || courseConstraintLines.length > 0 ? (
                  <SectionCard title={t.catalog.racebookSectionCourseEssentials}>
                    {courseItems.length > 0 ? <LabeledInfoList items={courseItems} emphasis /> : null}
                    {courseItems.length > 0 && courseConstraintLines.length > 0 ? (
                      <View style={styles.sectionDivider} />
                    ) : null}
                    {courseConstraintLines.length > 0 ? (
                      <View style={styles.inlineBlock}>
                        <Text style={styles.inlineBlockTitle}>{t.catalog.racebookSectionCourseConstraints}</Text>
                        <InfoList values={courseConstraintLines} />
                      </View>
                    ) : null}
                  </SectionCard>
                ) : null}

                {routePreviewPoints.length >= 2 ? (
                  <CourseMapCard
                    title={t.catalog.racebookSectionCourseMap}
                    points={routePreviewPoints}
                    emptyMessage={t.catalog.racebookEmptyCourseMap}
                  />
                ) : null}

                {elevationProfile.length >= 2 ? (
                  <CourseProfileCard
                    title={t.catalog.racebookSectionCourseProfile}
                    points={elevationProfile}
                    emptyMessage={t.catalog.racebookEmptyCourseProfile}
                  />
                ) : null}

                {relaySegments.length > 0 ? (
                  <SectionCard title={t.catalog.racebookSectionRelay}>
                    <View style={styles.relaySegmentsList}>
                      {relaySegments.map((segment, index) => (
                        <View key={`${segment.start.name}-${segment.end.name}-${index}`} style={styles.relaySegmentCard}>
                          <View style={styles.relaySegmentHeader}>
                            <Text style={styles.relaySegmentKicker}>
                              {t.catalog.racebookRelayLeg.replace('{number}', String(index + 1))}
                            </Text>
                            <DataText style={styles.relaySegmentDistance}>{formatStationDistance(segment.distanceKm)}</DataText>
                          </View>
                          <Text style={styles.relaySegmentTitle}>{`${segment.start.name} → ${segment.end.name}`}</Text>
                          {segment.end.handoverTime ? (
                            <Text style={styles.relaySegmentMeta}>{`${t.catalog.racebookRelayHandoverTime} · ${segment.end.handoverTime}`}</Text>
                          ) : null}
                          {segment.end.cutoffTime ? (
                            <Text style={styles.relaySegmentMeta}>{`${t.catalog.racebookAidCutoffTime} · ${segment.end.cutoffTime}`}</Text>
                          ) : null}
                          {segment.end.notes ? <Text style={styles.noteText}>{segment.end.notes}</Text> : null}
                        </View>
                      ))}
                    </View>
                  </SectionCard>
                ) : null}

                {data.aidStations.length > 0 ? (
                  <SectionCard title={t.catalog.racebookSectionAidStations}>
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
                ) : null}

                {!hasCourseContent ? (
                  <SectionCard title={t.catalog.racebookTabCourse}>
                    <EmptyState message={t.catalog.racebookEmptyCourse} />
                  </SectionCard>
                ) : null}
              </>
            ) : null}

            {activeTab === 'access' ? (
              accessSections.length > 0 ? (
                accessSections.map((section) => (
                  <SectionCard key={section.title} title={section.title}>
                    {section.items && section.items.length > 0 ? <LabeledInfoList items={section.items} emphasis /> : null}
                    {section.linkUrl && section.lines?.[0]?.startsWith('http') ? (
                      <Pressable onPress={() => Linking.openURL(section.linkUrl!).catch(() => {})}>
                        <Text style={styles.linkText}>{section.lines[0]}</Text>
                      </Pressable>
                    ) : section.lines && section.lines.length > 0 ? (
                      <InfoList values={section.lines} />
                    ) : null}
                  </SectionCard>
                ))
              ) : (
                <SectionCard title={t.catalog.racebookTabAccess}>
                  <EmptyState message={t.catalog.racebookEmptyAccess} />
                </SectionCard>
              )
            ) : null}

            {activeTab === 'services' ? (
              serviceSections.map((section) => (
                <SectionCard key={section.title} title={section.title}>
                  <Text style={styles.serviceText}>{section.value}</Text>
                </SectionCard>
              ))
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
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },
  alertCard: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7C97A',
    backgroundColor: Colors.warningSurface,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertInlineText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  alertIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6DA',
  },
  alertTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  alertBody: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroQuickActions: {
    width: 116,
    alignSelf: 'stretch',
    gap: 8,
  },
  heroQuickAction: {
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  heroWebsiteAction: {
    flex: 1,
  },
  heroEmergencyAction: {
    width: '100%',
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    borderColor: '#EDB8B2',
    backgroundColor: Colors.dangerSurface,
  },
  heroQuickActionPressed: {
    opacity: 0.68,
  },
  heroQuickActionText: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  heroEmergencyLine: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroQuickActionLabel: {
    color: Colors.brandPrimary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroEmergencyLabel: {
    color: Colors.danger,
    textAlign: 'left',
  },
  heroEmergencySeparator: {
    flexShrink: 0,
    color: Colors.danger,
    fontSize: 11,
    lineHeight: 15,
  },
  heroEmergencyName: {
    flexShrink: 1,
    minWidth: 0,
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  heroEmergencyPhone: {
    flexShrink: 0,
    color: Colors.danger,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'left',
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
    fontSize: 14,
    lineHeight: 20,
  },
  heroMetaGroup: {
    gap: 2,
  },
  heroLocationAction: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  heroFormatDate: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  heroDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  heroDetailGroup: {
    gap: 8,
  },
  heroDetailTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
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
  tabButtonCompact: {
    minWidth: 0,
    paddingHorizontal: 4,
  },
  tabButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextCompact: {
    fontSize: 11,
  },
  tabButtonTextActive: {
    color: Colors.textOnBrand,
  },
  contentWrap: {
    gap: 12,
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  serviceText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
  listDotMuted: {
    backgroundColor: Colors.border,
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
  tableRowEmphasis: {
    minHeight: 44,
  },
  tableRowPositive: {
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.brandSurface,
  },
  tableRowCritical: {
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.dangerSurface,
  },
  tableLabel: {
    flexShrink: 0,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tableLabelEmphasis: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  tableDivider: {
    flex: 1,
    minWidth: 12,
    height: 1,
    backgroundColor: Colors.border,
  },
  tableValue: {
    flexShrink: 1,
    textAlign: 'right',
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  tableValueEmphasis: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  tableValuePositive: {
    color: Colors.brandPrimary,
  },
  tableValueCritical: {
    color: Colors.danger,
  },
  tableValueWrap: {
    flexShrink: 1,
    maxWidth: '62%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tableValueAction: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  tableValueLink: {
    color: Colors.brandPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: Colors.brandPrimary,
  },
  bibLocationList: {
    gap: 12,
  },
  bibLocationCard: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  bibLocationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bibLocationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  bibLocationTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  bibLocationAction: {
    alignSelf: 'stretch',
    minHeight: 36,
    justifyContent: 'center',
  },
  bibLocationValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  bibDayList: {
    marginLeft: 44,
    gap: 10,
  },
  bibDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bibDayLabel: {
    flex: 1,
    minWidth: 0,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  bibTimeList: {
    alignItems: 'flex-end',
    gap: 5,
  },
  bibTimeValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
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
  courseProfileWrap: {
    gap: 10,
  },
  courseProfileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  courseProfileMetaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineBlock: {
    gap: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
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
    alignItems: 'center',
    gap: 8,
  },
  gearLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  gearLabelMuted: {
    color: Colors.textSecondary,
    opacity: 0.5,
  },
  weatherIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  weatherIconBadgeCold: {
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D0FF',
  },
  weatherIconBadgeHeat: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F6D37A',
  },
  weatherIconBadgeMuted: {
    opacity: 0.45,
  },
  statusBadge: {
    marginLeft: 'auto',
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
  statusBadgeMuted: {
    opacity: 0.45,
  },
  linkText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  relaySegmentsList: {
    gap: 10,
  },
  relaySegmentCard: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  relaySegmentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  relaySegmentKicker: {
    color: Colors.brandPrimary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  relaySegmentDistance: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  relaySegmentTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  relaySegmentMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
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
    gap: 12,
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
    width: 104,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 5,
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
  serviceInfoGroup: {
    alignItems: 'flex-start',
    gap: 6,
  },
  serviceIconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  serviceIconButtonActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  serviceTooltip: {
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  serviceTooltipText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
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

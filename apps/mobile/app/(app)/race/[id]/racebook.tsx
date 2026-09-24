import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RACEBOOK_EDITION_LOGO_ENABLED,
  resolveRacebookTheme,
  type ResolvedRacebookTheme,
} from '@pace-yourself/design-system';

import { ProfileMiniChart } from '../../../../components/plan-form/ProfileMiniChart';
import { RacebookLeafletMap } from '../../../../components/race/RacebookLeafletMap';
import { Card } from '../../../../components/themed/Card';
import { DataText } from '../../../../components/themed/DataText';
import { Heading } from '../../../../components/themed/Heading';
import { Text } from '../../../../components/themed/Text';
import { OnboardingGuideCard } from '../../../../components/onboarding/OnboardingGuideCard';
import {
  RacebookLoadingScreen as SponsorLoadingScreen,
  SponsorBanner as RacebookSponsorBanner,
} from '../../../../components/racebook/RacebookSponsorExperience';
import {
  RACEBOOK_HERO_BODY_HEIGHT,
  RacebookCollapsibleHero,
} from '../../../../components/racebook/RacebookCollapsibleHero';
import {
  RacebookAccessSection,
  type RacebookAccessLocation,
  type RacebookAccessTransport,
} from '../../../../components/racebook/RacebookAccessSection';
import { RacebookAidStationsSection } from '../../../../components/racebook/RacebookAidStationsSection';
import {
  RacebookBibSection,
  type RacebookBibPickupDayGroup,
  type RacebookBibPickupLocationGroup,
} from '../../../../components/racebook/RacebookBibSection';
import { RacebookGearSection } from '../../../../components/racebook/RacebookGearSection';
import { RacebookServicesSection } from '../../../../components/racebook/RacebookServicesSection';
import { RacebookStructuredCourseSections } from '../../../../components/racebook/RacebookStructuredCourseSections';
import { RacebookTabBar } from '../../../../components/racebook/RacebookTabBar';
import { Colors } from '../../../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../../../lib/gpx';
import { useI18n } from '../../../../lib/i18n';
import { clearRaceProfileRequestCache, fetchRaceElevationProfile, fetchRaceRoutePreviewPoints } from '../../../../lib/raceProfile';
import { approximateDistanceKm, fetchRaceRacebookData, type RacebookScreenData } from '../../../../lib/racebook';
import {
  createRacebookSponsorViewId,
  EMPTY_RACEBOOK_SPONSORS,
  fetchRacebookSponsors,
  RACEBOOK_SPONSOR_MINIMUM_MS,
  reportRacebookSponsorImpression,
  type RacebookSponsorImpression,
  type RacebookSponsorPresentation,
} from '../../../../lib/racebookSponsors';
import type { ElevationPoint } from '../../../../components/plan-form/profile-utils';
import { completeOnboarding, skipOnboardingKind } from '../../../../lib/onboardingStatus';
import { captureAnalyticsEvent } from '../../../../lib/posthog';
import { loadRacebookGearChecks, saveRacebookGearCheck } from '../../../../lib/racebookGearChecklist';

type RacebookTabKey = 'gear' | 'bib' | 'course' | 'access' | 'services';
type CourseTabKey = 'route' | 'start-waves' | 'aid-stations' | 'relay' | 'awards';

type RacebookAnalyticsSession = {
  properties: ReturnType<typeof buildRacebookAnalyticsProperties>;
  activeStartedAt: number | null;
  activeDurationMs: number;
  visitedTabs: Set<RacebookTabKey>;
  visitedCourseTabs: Set<CourseTabKey>;
  actionCount: number;
};

type LabeledItem = {
  label: string;
  value: string;
  actionUrl: string | null;
  dataValue?: boolean;
  tone?: 'neutral' | 'positive' | 'critical';
};

type BibPickupSlot = RacebookScreenData['runnerDetails']['bibPickup']['locations'][number]['slots'][number];

const DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_RACEBOOK_THEME = resolveRacebookTheme(null);
const RacebookBrandThemeContext = createContext<ResolvedRacebookTheme>(DEFAULT_RACEBOOK_THEME);

function useRacebookBrandTheme() {
  return useContext(RacebookBrandThemeContext);
}

function getDaysBeforeRace(raceDate: string | null, now = new Date()) {
  const match = raceDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const raceDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((raceDay - currentDay) / DAY_MS);
}

function getRaceTimingWindow(daysBeforeRace: number | null) {
  if (daysBeforeRace === null) return 'unknown';
  if (daysBeforeRace < 0) return 'after_race';
  if (daysBeforeRace === 0) return 'race_day';
  if (daysBeforeRace <= 2) return 'd1_d2';
  if (daysBeforeRace <= 7) return 'd3_d7';
  if (daysBeforeRace <= 14) return 'd8_d14';
  if (daysBeforeRace <= 30) return 'd15_d30';
  return 'd31_plus';
}

function buildRacebookAnalyticsProperties(data: RacebookScreenData, entryPoint: 'onboarding' | 'standard') {
  const daysBeforeRace = getDaysBeforeRace(data.race.raceDate);

  return {
    race_id: data.race.id,
    event_id: data.event.id,
    race_name: data.race.name,
    event_name: data.event.name,
    race_date: data.race.raceDate,
    days_before_race: daysBeforeRace,
    race_timing_window: getRaceTimingWindow(daysBeforeRace),
    entry_point: entryPoint,
  };
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
): RacebookBibPickupDayGroup[] {
  const groups = new Map<string, RacebookBibPickupDayGroup>();

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

function formatElevation(elevationM: number, locale: 'fr' | 'en') {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 }).format(elevationM);
}

function SectionCard({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  const brandTheme = useRacebookBrandTheme();
  return (
    <Card
      style={[
        styles.sectionCard,
        accent ? { backgroundColor: brandTheme.accentSurfaceColor, borderColor: brandTheme.accentBorderColor } : null,
      ]}
    >
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
  const brandTheme = useRacebookBrandTheme();
  return (
    <SectionCard title={title} accent>
      {points.length >= 2 ? (
        <View style={styles.courseProfileWrap}>
          <ProfileMiniChart points={points} accentColor={brandTheme.accentGraphicColor} />
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
  const brandTheme = useRacebookBrandTheme();
  return (
    <SectionCard title={title} accent>
      {points.length >= 2 ? (
        <RacebookLeafletMap points={points} routeColor={brandTheme.accentGraphicColor} />
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
  const brandTheme = useRacebookBrandTheme();
  return (
    <View style={styles.listGroup}>
      {values.map((value) => (
        <View key={value} style={styles.listRow}>
          <View style={[styles.listDot, { backgroundColor: brandTheme.primaryGraphicColor }]} />
          <Text style={styles.listText}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function LabeledInfoList({ items, emphasis = false, onOpenUrl }: {
  items: LabeledItem[];
  emphasis?: boolean;
  onOpenUrl: (url: string) => void;
}) {
  const brandTheme = useRacebookBrandTheme();
  return (
    <View style={styles.listGroup}>
      {items.map((item) => (
        <View
          key={`${item.label}:${item.value}`}
          style={[
            styles.tableRow,
            emphasis ? styles.tableRowEmphasis : null,
            item.tone === 'positive' ? styles.tableRowPositive : null,
            item.tone === 'positive' ? { backgroundColor: brandTheme.accentSurfaceColor } : null,
            item.tone === 'critical' ? styles.tableRowCritical : null,
          ]}
        >
          <Text style={[styles.tableLabel, emphasis ? styles.tableLabelEmphasis : null]}>{item.label}</Text>
          <View style={styles.tableDivider} />
          <View style={styles.tableValueWrap}>
            {item.actionUrl ? (
              <Pressable
                style={styles.tableValueAction}
                onPress={() => onOpenUrl(item.actionUrl!)}
                accessibilityRole="link"
                accessibilityLabel={`Ouvrir ${item.label}`}
              >
                <Text style={[styles.tableValue, emphasis ? styles.tableValueEmphasis : null, styles.tableValueLink, { color: brandTheme.primaryForegroundColor, textDecorationColor: brandTheme.primaryForegroundColor }]}>
                  {item.value}
                </Text>
              </Pressable>
            ) : item.dataValue ? (
              <DataText
                tone={item.tone === 'critical' ? 'danger' : item.tone === 'positive' ? 'brand' : 'primary'}
                weight="semibold"
                style={[styles.tableValue, emphasis ? styles.tableValueEmphasis : null, item.tone === 'positive' ? { color: brandTheme.primaryForegroundColor } : null]}
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

function HeroDetailGroup({ title, values }: { title: string; values: string[] }) {
  return (
    <View style={styles.heroDetailGroup}>
      <Text style={styles.heroDetailTitle}>{title}</Text>
      <InfoList values={values} />
    </View>
  );
}

export default function RaceRacebookScreen() {
  const { id, onboarding } = useLocalSearchParams<{ id?: string; onboarding?: 'racebook' }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { locale, t } = useI18n();
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<RacebookTabKey>('gear');
  const [activeCourseTab, setActiveCourseTab] = useState<CourseTabKey>('route');
  const [expandedAidStationId, setExpandedAidStationId] = useState<string | null>(null);
  const [checkedGearItemKeys, setCheckedGearItemKeys] = useState<Set<string>>(new Set());
  const [pendingGearItemKeys, setPendingGearItemKeys] = useState<Set<string>>(new Set());
  const [courseConstraintsExpanded, setCourseConstraintsExpanded] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<RacebookScreenData | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [routePreviewPoints, setRoutePreviewPoints] = useState<MobileGpxPreviewPoint[]>([]);
  const [sponsorPresentation, setSponsorPresentation] = useState<RacebookSponsorPresentation>(EMPTY_RACEBOOK_SPONSORS);
  const [sponsorGateDone, setSponsorGateDone] = useState(false);
  const [sponsorSplashVisible, setSponsorSplashVisible] = useState(false);
  const [sponsorLookupDone, setSponsorLookupDone] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0.06);
  const [loadingExitDone, setLoadingExitDone] = useState(false);
  const [expandedAccessTransport, setExpandedAccessTransport] = useState<Record<RacebookAccessTransport['key'], boolean>>({
    parking: false,
    shuttles: false,
  });
  const analyticsSessionRef = useRef<RacebookAnalyticsSession | null>(null);
  const analyticsDataRef = useRef<RacebookScreenData | null>(null);
  const activeTabRef = useRef<RacebookTabKey>('gear');
  const activeCourseTabRef = useRef<CourseTabKey>('route');
  const unavailableTrackedRaceIdRef = useRef<string | null>(null);
  const sponsorViewRef = useRef<{ raceId: string | null; viewId: string } | null>(null);
  const exitingToCatalogRef = useRef(false);
  const activeRaceIdRef = useRef(id);
  activeRaceIdRef.current = id;

  if (!sponsorViewRef.current || sponsorViewRef.current.raceId !== (id ?? null)) {
    sponsorViewRef.current = { raceId: id ?? null, viewId: createRacebookSponsorViewId() };
  }
  const sponsorViewId = sponsorViewRef.current.viewId;

  analyticsDataRef.current = data;
  activeTabRef.current = activeTab;
  activeCourseTabRef.current = activeCourseTab;

  useEffect(() => {
    let cancelled = false;
    setCheckedGearItemKeys(new Set());
    setPendingGearItemKeys(new Set());

    if (!id) return () => { cancelled = true; };

    loadRacebookGearChecks(id)
      .then((itemKeys) => {
        if (!cancelled && activeRaceIdRef.current === id) setCheckedGearItemKeys(itemKeys);
      })
      .catch((error) => console.warn('Unable to load RaceBook gear checks.', error));

    return () => { cancelled = true; };
  }, [id]);

  async function toggleGearItem(itemKey: string, checked: boolean) {
    if (!id || pendingGearItemKeys.has(itemKey)) return;
    const targetRaceId = id;

    setCheckedGearItemKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(itemKey);
      else next.delete(itemKey);
      return next;
    });
    setPendingGearItemKeys((current) => new Set(current).add(itemKey));

    try {
      await saveRacebookGearCheck(targetRaceId, itemKey, checked);
    } catch (error) {
      console.warn('Unable to save RaceBook gear check.', error);
      if (activeRaceIdRef.current === targetRaceId) {
        setCheckedGearItemKeys((current) => {
          const next = new Set(current);
          if (checked) next.delete(itemKey);
          else next.add(itemKey);
          return next;
        });
        Alert.alert(t.common.error, t.catalog.racebookGearSaveError);
      }
    } finally {
      if (activeRaceIdRef.current === targetRaceId) {
        setPendingGearItemKeys((current) => {
          const next = new Set(current);
          next.delete(itemKey);
          return next;
        });
      }
    }
  }

  useEffect(() => {
    if (!sponsorLookupDone) {
      setLoadingExitDone(false);
      setLoadingProgress(0.06);
      return;
    }

    if (!loading && sponsorGateDone) {
      setLoadingProgress(1);
      const completionTimer = setTimeout(() => setLoadingExitDone(true), 300);
      return () => clearTimeout(completionTimer);
    }

    setLoadingExitDone(false);
    const progressTimer = setInterval(() => {
      setLoadingProgress((current) => Math.min(0.92, current + 0.055));
    }, 180);

    return () => clearInterval(progressTimer);
  }, [loading, sponsorGateDone, sponsorLookupDone]);

  useEffect(() => {
    let cancelled = false;
    let sponsorTimer: ReturnType<typeof setTimeout> | undefined;
    let sponsorFrame: ReturnType<typeof requestAnimationFrame> | undefined;

    if (!id) {
      setData(null);
      setLoading(false);
      setSponsorPresentation(EMPTY_RACEBOOK_SPONSORS);
      setSponsorSplashVisible(false);
      setSponsorLookupDone(true);
      setSponsorGateDone(true);
      setLoadingExitDone(false);
      return;
    }

    setLoading(true);
    setSponsorPresentation(EMPTY_RACEBOOK_SPONSORS);
    setSponsorSplashVisible(false);
    setSponsorLookupDone(false);
    setSponsorGateDone(false);
    setLoadingProgress(0.06);
    setLoadingExitDone(false);

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

    fetchRacebookSponsors(id)
      .then(async (presentation) => {
        if (cancelled) return;

        setSponsorPresentation(presentation);
        if (presentation.loadingSponsors.length === 0) {
          setSponsorLookupDone(true);
          setSponsorGateDone(true);
          return;
        }

        setSponsorSplashVisible(true);

        await Promise.allSettled(
          [...presentation.loadingSponsors.map((sponsor) => sponsor.logoUrl), presentation.branding.logoUrl]
            .filter((url): url is string => Boolean(url))
            .map((url) =>
            Promise.race([
              Image.prefetch(url),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1_500)),
            ]),
          ),
        );
        if (cancelled) return;
        setSponsorLookupDone(true);

        sponsorFrame = requestAnimationFrame(() => {
          sponsorTimer = setTimeout(() => {
            if (!cancelled) setSponsorGateDone(true);
          }, RACEBOOK_SPONSOR_MINIMUM_MS);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSponsorLookupDone(true);
          setSponsorGateDone(true);
        }
      });

    return () => {
      cancelled = true;
      if (sponsorFrame) cancelAnimationFrame(sponsorFrame);
      if (sponsorTimer) clearTimeout(sponsorTimer);
    };
  }, [id]);

  const handleRefresh = useCallback(async () => {
    if (!id) return;

    setRefreshing(true);
    clearRaceProfileRequestCache(id);

    try {
      const [result, profilePoints, routePoints] = await Promise.all([
        fetchRaceRacebookData(id),
        fetchRaceElevationProfile(id),
        fetchRaceRoutePreviewPoints(id),
      ]);

      setData(result);
      setElevationProfile(profilePoints);
      setRoutePreviewPoints(routePoints);

      const analyticsSession = analyticsSessionRef.current;
      if (result?.canOpen && analyticsSession) {
        analyticsSession.actionCount += 1;
        captureAnalyticsEvent('racebook refreshed', analyticsSession.properties);
      }
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
  const heroImageUrl = data?.race.thumbnailUrl ?? data?.event.thumbnailUrl ?? null;
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
  const instagramUrl = data?.event.organizerDetails.instagramUrl ?? null;
  const facebookUrl = data?.event.organizerDetails.facebookUrl ?? null;
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

    const structuredTypes = new Set(data.editionServices.map((service) => service.serviceType));

    return [
      { title: t.catalog.racebookServiceSupporters, value: data.runnerDetails.services.supporters },
      { title: t.catalog.racebookServiceAccommodations, value: structuredTypes.has('accommodation') ? null : data.runnerDetails.services.accommodations },
      { title: t.catalog.racebookServiceRestaurants, value: structuredTypes.has('restaurant') ? null : data.runnerDetails.services.restaurants },
      { title: t.catalog.racebookServiceRecovery, value: structuredTypes.has('recovery') ? null : data.runnerDetails.services.recovery },
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

  const structuredServices = useMemo(() => {
    if (!data) return [];
    const accessStart = data.runnerDetails.access.startLocation;
    const raceLocation = data.race.organizerDetails.raceLocation;
    const eventLocation = data.event.organizerDetails.eventLocation;
    const originLat = accessStart.lat ?? data.race.startLatitude ?? raceLocation.lat ?? eventLocation.lat;
    const originLng = accessStart.lng ?? data.race.startLongitude ?? raceLocation.lng ?? eventLocation.lng;
    return data.editionServices.map((service) => ({
      ...service,
      distanceKm: approximateDistanceKm(originLat, originLng, service.latitude, service.longitude),
      directionsUrl: service.googleMapsUrl ?? (service.latitude != null && service.longitude != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`
        : null),
    }));
  }, [data]);

  const awardsByTime = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof data>['awards']>();
    for (const award of data?.awards ?? []) groups.set(award.podiumTime, [...(groups.get(award.podiumTime) ?? []), award]);
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [data]);

  const tabs = useMemo(() => {
    const availableTabs: {
      key: RacebookTabKey;
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
    }[] = [];
    if (sponsorPresentation.modules.equipment) availableTabs.push({ key: 'gear', label: t.catalog.racebookTabGear, icon: 'bag-check' });
    if (sponsorPresentation.modules.bib_pickup) availableTabs.push({ key: 'bib', label: t.catalog.racebookTabBib, icon: 'ticket' });
    availableTabs.push({ key: 'course', label: t.catalog.racebookTabCourse, icon: 'map' });
    if (sponsorPresentation.modules.access) availableTabs.push({ key: 'access', label: t.catalog.racebookTabAccess, icon: 'navigate' });

    if (sponsorPresentation.modules.services && (serviceSections.length > 0 || structuredServices.length > 0)) {
      availableTabs.push({ key: 'services', label: t.catalog.racebookSectionServices, icon: 'grid' });
    }

    return availableTabs;
  }, [
    serviceSections.length,
    sponsorPresentation.modules,
    structuredServices.length,
    t.catalog.racebookSectionServices,
    t.catalog.racebookTabAccess,
    t.catalog.racebookTabBib,
    t.catalog.racebookTabCourse,
    t.catalog.racebookTabGear,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) setActiveTab(tabs[0]?.key ?? 'course');
  }, [activeTab, tabs]);

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
      .map((pickupLocation, locationIndex): RacebookBibPickupLocationGroup | null => {
        if (!pickupLocation.location) return null;

        return {
          key: `${pickupLocation.location}-${locationIndex}`,
          location: pickupLocation.location,
          actionUrl: pickupLocation.locationDetails.googleMapsUrl,
          days: groupBibPickupSlots(pickupLocation.slots, locale, t.catalog.racebookFieldBibWindow),
        };
      })
      .filter((value): value is RacebookBibPickupLocationGroup => Boolean(value));
  }, [data, locale, t.catalog.racebookFieldBibWindow]);

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

  const participationLabels = data?.race.participationMode === 'solo'
    ? [t.catalog.racebookParticipationSolo]
    : data?.race.participationMode === 'relay'
      ? [t.catalog.racebookParticipationRelay]
      : data?.race.participationMode === 'solo_and_relay'
        ? [t.catalog.racebookParticipationSolo, t.catalog.racebookParticipationRelay]
        : [];

  const courseTabs = useMemo(() => {
    const availableTabs: Array<{ key: CourseTabKey; label: string }> = [
      { key: 'route', label: t.catalog.racebookCourseTabRoute },
    ];
    if (sponsorPresentation.modules.aid_stations) availableTabs.push({ key: 'aid-stations', label: t.catalog.racebookCourseTabAidStations });

    if (sponsorPresentation.modules.relay && relaySegments.length > 0) {
      availableTabs.push({ key: 'relay', label: t.catalog.racebookSectionRelay });
    }
    if (sponsorPresentation.modules.start_waves && (data?.startWaves.length ?? 0) > 0) availableTabs.splice(1, 0, { key: 'start-waves', label: t.catalog.racebookCourseTabStartWaves });
    if (sponsorPresentation.modules.awards && (data?.awards.length ?? 0) > 0) availableTabs.push({ key: 'awards', label: t.catalog.racebookCourseTabAwards });

    return availableTabs;
  }, [
    relaySegments.length,
    data?.startWaves.length,
    data?.awards.length,
    sponsorPresentation.modules,
    t.catalog.racebookCourseTabAidStations,
    t.catalog.racebookCourseTabAwards,
    t.catalog.racebookCourseTabRoute,
    t.catalog.racebookCourseTabStartWaves,
    t.catalog.racebookSectionRelay,
  ]);

  useEffect(() => {
    if (!courseTabs.some((tab) => tab.key === activeCourseTab)) setActiveCourseTab('route');
  }, [activeCourseTab, courseTabs]);

  const accessPresentation = useMemo(() => {
    if (!data) return null;

    const access = data.runnerDetails.access;
    const normalizedStart = access.startAddress?.trim().toLocaleLowerCase().replace(/\s+/g, ' ') ?? '';
    const normalizedFinish = access.finishAddress?.trim().toLocaleLowerCase().replace(/\s+/g, ' ') ?? '';
    const sameLocation = Boolean(normalizedStart && normalizedStart === normalizedFinish);
    const locations: RacebookAccessLocation[] = sameLocation
      ? [{
          key: 'start-finish',
          label: t.catalog.racebookAccessSameLocation,
          value: access.startAddress!,
          actionUrl: access.startLocation.googleMapsUrl ?? access.finishLocation.googleMapsUrl,
        }]
      : [
          access.startAddress
            ? { key: 'start', label: t.catalog.racebookFieldStartLocation, value: access.startAddress, actionUrl: access.startLocation.googleMapsUrl }
            : null,
          access.finishAddress
            ? { key: 'finish', label: t.catalog.racebookFieldFinishLocation, value: access.finishAddress, actionUrl: access.finishLocation.googleMapsUrl }
            : null,
        ].filter((value): value is RacebookAccessLocation => Boolean(value));
    const priorityItems = [
      access.note ? { label: t.catalog.racebookAccessImportantInfo, value: access.note } : null,
      access.enabledSections.roadRestrictions && access.roadRestrictions
        ? { label: t.catalog.racebookAccessRestrictions, value: access.roadRestrictions }
        : null,
    ].filter((value): value is { label: string; value: string } => Boolean(value));
    const transportItems: RacebookAccessTransport[] = [];
    if (access.enabledSections.officialParkings && access.officialParkings) {
      transportItems.push({
        key: 'parking',
        icon: 'car-outline',
        title: t.catalog.racebookAccessParking,
        description: access.officialParkings,
      });
    }
    if (access.enabledSections.shuttles && (access.shuttles || access.shuttleSchedule)) {
      transportItems.push({
        key: 'shuttles',
        icon: 'bus-outline',
        title: t.catalog.racebookAccessShuttles,
        description: access.shuttles ?? access.shuttleSchedule!,
        schedule: access.shuttles ? access.shuttleSchedule : null,
      });
    }

    return {
      locations,
      priorityItems,
      transportItems,
      generalMapUrl: access.enabledSections.mapUrl ? access.mapUrl : null,
      hasContent: locations.length > 0 || priorityItems.length > 0 || transportItems.length > 0 || Boolean(access.enabledSections.mapUrl && access.mapUrl),
    };
  }, [
    data,
    t.catalog.racebookAccessImportantInfo,
    t.catalog.racebookAccessParking,
    t.catalog.racebookAccessRestrictions,
    t.catalog.racebookAccessSameLocation,
    t.catalog.racebookAccessShuttles,
    t.catalog.racebookFieldFinishLocation,
    t.catalog.racebookFieldStartLocation,
  ]);

  const equipmentItems = data?.runnerDetails.equipmentStatus.items ?? [];
  const requiredEquipment = equipmentItems.filter((item) => item.active && item.required);
  const recommendedEquipment = equipmentItems.filter((item) => item.active && !item.required);
  const conditionalEquipment = equipmentItems.filter((item) => !item.active);
  const equipmentNotes = [data?.runnerDetails.equipment.note].filter((value): value is string => Boolean(value));
  const brandTheme = useMemo(
    () => resolveRacebookTheme(sponsorPresentation.branding),
    [sponsorPresentation.branding],
  );
  const showLoading = loading || !sponsorGateDone || !loadingExitDone;
  const unavailable = !showLoading && (!data || !data.canOpen);
  const heroExpandedHeight = insets.top + RACEBOOK_HERO_BODY_HEIGHT;

  useFocusEffect(
    useCallback(() => {
      const analyticsData = analyticsDataRef.current;
      if (showLoading || !analyticsData?.canOpen) return undefined;

      const now = Date.now();
      const properties = buildRacebookAnalyticsProperties(
        analyticsData,
        onboarding === 'racebook' ? 'onboarding' : 'standard',
      );
      const session: RacebookAnalyticsSession = {
        properties,
        activeStartedAt: AppState.currentState === 'active' ? now : null,
        activeDurationMs: 0,
        visitedTabs: new Set([activeTabRef.current]),
        visitedCourseTabs: new Set(activeTabRef.current === 'course' ? [activeCourseTabRef.current] : []),
        actionCount: 0,
      };
      analyticsSessionRef.current = session;

      captureAnalyticsEvent('racebook opened', {
        ...properties,
        initial_tab: activeTabRef.current,
        available_tab_count: tabs.length,
        aid_station_count: analyticsData.aidStations.length,
        relay_point_count: analyticsData.relayPoints.length,
      });

      const appStateSubscription = AppState.addEventListener('change', (nextState) => {
        const currentSession = analyticsSessionRef.current;
        if (currentSession !== session) return;

        const changedAt = Date.now();
        if (nextState === 'active') {
          currentSession.activeStartedAt ??= changedAt;
        } else if (currentSession.activeStartedAt !== null) {
          currentSession.activeDurationMs += changedAt - currentSession.activeStartedAt;
          currentSession.activeStartedAt = null;
        }
      });

      return () => {
        appStateSubscription.remove();
        if (session.activeStartedAt !== null) {
          session.activeDurationMs += Date.now() - session.activeStartedAt;
          session.activeStartedAt = null;
        }

        captureAnalyticsEvent('racebook closed', {
          ...session.properties,
          active_duration_seconds: Math.round(session.activeDurationMs / 100) / 10,
          visited_tab_count: session.visitedTabs.size,
          visited_course_tab_count: session.visitedCourseTabs.size,
          action_count: session.actionCount,
          engaged: session.visitedTabs.size > 1 || session.visitedCourseTabs.size > 1 || session.actionCount > 0,
        });

        if (analyticsSessionRef.current === session) analyticsSessionRef.current = null;
      };
    }, [data?.canOpen, data?.race.id, onboarding, showLoading, tabs.length]),
  );

  useEffect(() => {
    if (!unavailable || !id || unavailableTrackedRaceIdRef.current === id) return;

    unavailableTrackedRaceIdRef.current = id;
    captureAnalyticsEvent('racebook unavailable viewed', {
      race_id: id,
      entry_point: onboarding === 'racebook' ? 'onboarding' : 'standard',
    });
  }, [id, onboarding, unavailable]);

  const captureRacebookInteraction = useCallback(
    (eventName: string, properties?: Record<string, string | number | boolean | null>) => {
      const session = analyticsSessionRef.current;
      if (!session) return;

      session.actionCount += 1;
      captureAnalyticsEvent(eventName, { ...session.properties, ...properties });
    },
    [],
  );

  const handleTabPress = useCallback((tab: RacebookTabKey) => {
    if (tab === activeTab) return;

    setActiveTab(tab);
    const session = analyticsSessionRef.current;
    if (!session) return;

    session.visitedTabs.add(tab);
    captureAnalyticsEvent('racebook tab viewed', { ...session.properties, tab });
  }, [activeTab]);

  const handleCourseTabPress = useCallback((courseTab: CourseTabKey) => {
    if (courseTab === activeCourseTab) return;

    setActiveCourseTab(courseTab);
    const session = analyticsSessionRef.current;
    if (!session) return;

    session.visitedTabs.add('course');
    session.visitedCourseTabs.add(courseTab);
    captureAnalyticsEvent('racebook tab viewed', {
      ...session.properties,
      tab: 'course',
      course_tab: courseTab,
    });
  }, [activeCourseTab]);

  const openExternalUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert(
        t.common.error,
        locale === 'fr' ? "Impossible d’ouvrir ce lien sur cet appareil." : 'This link cannot be opened on this device.',
      );
    });
  }, [locale, t.common.error]);

  const openTrackedUrl = useCallback((url: string, action: string, context?: string) => {
    captureRacebookInteraction('racebook action clicked', {
      action,
      action_context: context ?? null,
    });
    openExternalUrl(url);
  }, [captureRacebookInteraction, openExternalUrl]);

  const exitRacebookToCatalog = useCallback(() => {
    if (exitingToCatalogRef.current) return;
    exitingToCatalogRef.current = true;
    captureRacebookInteraction('racebook action clicked', { action: 'exit_to_catalog' });
    router.replace('/(app)/catalog');
  }, [captureRacebookInteraction, router]);

  const reportSponsorImpression = useCallback((impression: RacebookSponsorImpression) => {
    if (!id) return;
    void reportRacebookSponsorImpression(id, sponsorViewId, impression);
  }, [id, sponsorViewId]);

  useEffect(() => {
    navigation.setOptions({ headerRight: showLoading ? () => null : undefined });
    return () => navigation.setOptions({ headerRight: undefined });
  }, [navigation, showLoading]);

  useFocusEffect(useCallback(() => {
    exitingToCatalogRef.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.setValue(0);
    const tabsNavigation = navigation.getParent();
    tabsNavigation?.setOptions({ tabBarStyle: { display: 'none' } });
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (event) => {
      if (exitingToCatalogRef.current) return;
      event.preventDefault();
      exitRacebookToCatalog();
    });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exitRacebookToCatalog();
      return true;
    });
    return () => {
      backSubscription.remove();
      unsubscribeBeforeRemove();
      tabsNavigation?.setOptions({ tabBarStyle: undefined });
    };
  }, [exitRacebookToCatalog, navigation, scrollY]));

  async function finishRacebookOnboarding(completed: boolean) {
    setOnboardingBusy(true);
    try {
      if (completed) await completeOnboarding('racebook');
      else await skipOnboardingKind('racebook', 'racebook');
      router.replace(id ? `/(app)/race/${id}/racebook` : '/(app)/catalog');
    } catch (caught) {
      console.error('Unable to finish RaceBook onboarding:', caught);
      setOnboardingBusy(false);
    }
  }

  return (
    <RacebookBrandThemeContext.Provider value={brandTheme}>
    <View style={[styles.screen, { backgroundColor: brandTheme.primarySurfaceColor }]}>
      {!showLoading && !unavailable && data ? (
        <RacebookCollapsibleHero
          scrollY={scrollY}
          topInset={insets.top}
          eventName={data.event.name}
          raceName={data.race.name}
          imageUrl={heroImageUrl}
          logoUrl={RACEBOOK_EDITION_LOGO_ENABLED ? brandTheme.logoUrl : null}
          dateLabel={formattedRaceDate ?? eventDateRange}
          locationLabel={headerLocation}
          participationLabel={participationLabels.join(' + ') || null}
          participationIcon={data.race.participationMode === 'solo' ? 'person-outline' : 'people-outline'}
          distanceLabel={`${formatDistance(data.race.distanceKm)} km`}
          elevationGainLabel={`D+ ${formatElevation(data.race.elevationGainM, locale)} m`}
          elevationLossLabel={data.race.elevationLossM !== null ? `D- ${formatElevation(data.race.elevationLossM, locale)} m` : null}
          elevationCaption={locale === 'fr' ? 'Dénivelé' : 'Elevation gain'}
          descentCaption={locale === 'fr' ? 'Descente' : 'Elevation loss'}
          backLabel={t.common.back}
          theme={brandTheme}
          emergency={emergencyContact?.phone && emergencyTelephoneUrl ? {
            label: t.catalog.racebookEmergencyShort,
            name: emergencyContact.name,
            phone: emergencyContact.phone,
            callLabel: t.catalog.racebookCallAction,
            accessibilityLabel: t.catalog.racebookCallEmergency,
          } : null}
          socialLinks={[
            ...(officialWebsiteUrl ? [{ accessibilityLabel: t.catalog.racebookOfficialWebsite, action: 'official_website_opened', icon: 'globe-outline' as const, url: officialWebsiteUrl }] : []),
            ...(instagramUrl ? [{ accessibilityLabel: 'Instagram', action: 'instagram_opened', icon: 'logo-instagram' as const, url: instagramUrl }] : []),
            ...(facebookUrl ? [{ accessibilityLabel: 'Facebook', action: 'facebook_opened', icon: 'logo-facebook' as const, url: facebookUrl }] : []),
          ]}
          onBack={exitRacebookToCatalog}
          onCallEmergency={emergencyTelephoneUrl ? () => openTrackedUrl(emergencyTelephoneUrl, 'emergency_call_started') : undefined}
          onOpenLocation={headerLocationUrl ? () => openTrackedUrl(headerLocationUrl, 'map_opened', 'header_location') : undefined}
          onOpenSocial={(url, action) => openTrackedUrl(url, action)}
        />
      ) : null}
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: brandTheme.primarySurfaceColor },
          !showLoading && !unavailable && data ? { paddingTop: heroExpandedHeight + 16 } : null,
          showLoading || unavailable ? { paddingTop: insets.top + 16 } : null,
          showLoading && { minHeight: Math.max(520, viewportHeight - 120) },
        ]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brandTheme.primaryColor}
            colors={[brandTheme.primaryColor]}
          />
        }
      >
      {showLoading ? (
        <SponsorLoadingScreen
          key={id ?? 'missing-racebook'}
          progress={loadingProgress}
          sponsors={sponsorSplashVisible ? sponsorPresentation.loadingSponsors : []}
          sponsorLabel={t.catalog.racebookSponsorsSupportedBy}
          loadingLabel={t.catalog.racebookLoading}
          title={t.catalog.racebookLoadingTitle}
          viewportHeight={viewportHeight}
          sponsorLookupDone={sponsorLookupDone}
          theme={brandTheme}
          onSponsorImpression={reportSponsorImpression}
        />
      ) : unavailable ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="information-circle-outline" size={26} color={brandTheme.primaryGraphicColor} />
          </View>
          <Heading variant="h3" style={styles.unavailableTitle}>
            {t.catalog.racebookUnavailableTitle}
          </Heading>
          <Text style={styles.unavailableBody}>{t.catalog.racebookUnavailableBody}</Text>
          <Pressable style={[styles.backButton, { backgroundColor: brandTheme.primaryColor }]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: brandTheme.onPrimaryColor }]}>{t.common.back}</Text>
          </Pressable>
        </View>
      ) : data ? (
        <>
          <RacebookSponsorBanner
            key={`hero-${id ?? 'unknown'}`}
            sponsors={sponsorPresentation.bannerSponsors}
            label={t.catalog.racebookSponsorsBannerLabel}
            discoverLabel={t.catalog.racebookSponsorDiscover}
            theme={brandTheme}
            onSponsorImpression={reportSponsorImpression}
          />
          {runnerInfoLines.length > 0 ? (
            <Card style={styles.heroCard}>
              <HeroDetailGroup title={t.catalog.racebookSectionRunnerInfo} values={runnerInfoLines} />
            </Card>
          ) : null}

          {weatherAlertMessage ? <InlineAlertCard icon={weatherAlertIcon} title="Alerte météo" message={weatherAlertMessage} /> : null}

          {lastMinuteMessage ? (
            <InlineAlertCard icon="megaphone-outline" title={t.catalog.racebookLastMinuteTitle} message={lastMinuteMessage} />
          ) : null}

          <View style={styles.contentWrap}>
            {activeTab === 'gear' ? (
              <>
              <RacebookGearSection
                requiredItems={requiredEquipment}
                recommendedItems={recommendedEquipment}
                weatherItems={conditionalEquipment}
                notes={equipmentNotes}
                theme={brandTheme}
                checkedItemKeys={checkedGearItemKeys}
                pendingItemKeys={pendingGearItemKeys}
                onToggleItem={toggleGearItem}
                copy={{
                  requiredTitle: t.catalog.racebookSectionGearRequired,
                  recommendedTitle: t.catalog.racebookSectionGearRecommended,
                  weatherTitle: t.catalog.racebookSectionGearConditional,
                  emptyMessage: t.catalog.racebookEmptyGear,
                  coldWeather: t.catalog.racebookGearColdWeather,
                  hotWeather: t.catalog.racebookGearHotWeather,
                  checkedLabel: t.catalog.racebookGearChecked,
                  uncheckedLabel: t.catalog.racebookGearUnchecked,
                  progressLabel: t.catalog.racebookGearProgress,
                }}
              />
              <RacebookSponsorBanner
                key={`equipment-${id ?? 'unknown'}`}
                sponsors={sponsorPresentation.contextualSponsors}
                label={t.catalog.racebookSponsorsBannerLabel}
                discoverLabel={t.catalog.racebookSponsorDiscover}
                placement="equipment"
                theme={brandTheme}
                onSponsorImpression={reportSponsorImpression}
              />
              </>
            ) : null}

            {activeTab === 'bib' ? (
              <RacebookBibSection
                locationGroups={bibLocationGroups}
                fallbackSchedule={data.runnerDetails.bibPickup.schedule}
                requiredDocuments={data.runnerDetails.bibPickup.requiredDocuments}
                rules={bibLines}
                theme={brandTheme}
                onOpenUrl={openExternalUrl}
                onOpenMap={(location) => {
                  captureRacebookInteraction('racebook action clicked', {
                    action: 'map_opened',
                    action_context: `bib_${location}`,
                  });
                }}
                copy={{
                  whereAndWhenTitle: locale === 'fr' ? 'Où et quand' : 'Where and when',
                  documentsTitle: t.catalog.racebookFieldBibDocuments,
                  rulesTitle: t.catalog.racebookSectionAdditionalInfo,
                  emptyMessage: t.catalog.racebookEmptyBib,
                  openMapsLabel: t.catalog.racebookAccessOpenMaps,
                  scheduleLabel: t.catalog.racebookFieldBibWindow,
                }}
              />
            ) : null}

            {activeTab === 'course' ? (
              <>
                <View style={styles.courseTabsWrap} accessibilityRole="tablist">
                  {courseTabs.map((tab) => {
                    const active = activeCourseTab === tab.key;

                    return (
                      <Pressable
                        key={tab.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => handleCourseTabPress(tab.key)}
                        style={[styles.courseTabButton, active ? styles.courseTabButtonActive : null, active ? { borderColor: brandTheme.primaryBorderColor } : null]}
                      >
                        <Text style={[styles.courseTabButtonText, active ? styles.courseTabButtonTextActive : null, active ? { color: brandTheme.primaryForegroundColor } : null]}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {(['route', 'start-waves', 'aid-stations'] as CourseTabKey[]).includes(activeCourseTab) &&
                (courseItems.length > 0 || courseConstraintLines.length > 0) ? (
                  <View style={styles.courseEssentials}>
                    {courseItems.length > 0 ? (
                      <View style={styles.courseEssentialMetrics}>
                        {courseItems.map((item) => (
                          <View
                            accessible
                            accessibilityLabel={`${item.label}: ${item.value}`}
                            key={`${item.label}:${item.value}`}
                            style={styles.courseEssentialMetric}
                          >
                            <Text numberOfLines={1} style={styles.courseEssentialLabel}>
                              {item.label}
                            </Text>
                            <DataText
                              numberOfLines={1}
                              style={[
                                styles.courseEssentialValue,
                                item.tone === 'critical' ? styles.courseEssentialValueCritical : null,
                                item.tone === 'positive' ? { color: brandTheme.primaryForegroundColor } : null,
                              ]}
                            >
                              {item.value}
                            </DataText>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {courseConstraintLines.length > 0 ? (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: courseConstraintsExpanded }}
                          onPress={() => setCourseConstraintsExpanded((current) => !current)}
                          style={styles.courseConstraintsButton}
                        >
                          <Ionicons color={Colors.warning} name="alert-circle-outline" size={18} />
                          <Text style={styles.courseConstraintsLabel}>
                            {locale === 'fr'
                              ? `${courseConstraintLines.length} consigne${courseConstraintLines.length > 1 ? 's' : ''}`
                              : `${courseConstraintLines.length} instruction${courseConstraintLines.length > 1 ? 's' : ''}`}
                          </Text>
                          <Ionicons
                            color={Colors.textSecondary}
                            name={courseConstraintsExpanded ? 'chevron-up' : 'chevron-down'}
                            size={17}
                          />
                        </Pressable>
                        {courseConstraintsExpanded ? (
                          <View style={styles.courseConstraintsContent}>
                            <InfoList values={courseConstraintLines} />
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                ) : courseItems.length > 0 || courseConstraintLines.length > 0 ? (
                  <SectionCard title={t.catalog.racebookSectionCourseEssentials}>
                    {courseItems.length > 0 ? <LabeledInfoList items={courseItems} emphasis onOpenUrl={openExternalUrl} /> : null}
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

                {activeCourseTab === 'route' ? (
                  !data.race.organizerDetails.gpxDisplay.showRoute &&
                  !data.race.organizerDetails.gpxDisplay.showElevationProfile ? null :
                  (data.race.organizerDetails.gpxDisplay.showRoute && routePreviewPoints.length >= 2) ||
                  (data.race.organizerDetails.gpxDisplay.showElevationProfile && elevationProfile.length >= 2) ? (
                    <>
                      {data.race.organizerDetails.gpxDisplay.showRoute && routePreviewPoints.length >= 2 ? (
                        <CourseMapCard
                          title={t.catalog.racebookSectionCourseMap}
                          points={routePreviewPoints}
                          emptyMessage={t.catalog.racebookEmptyCourseMap}
                        />
                      ) : null}

                      {data.race.organizerDetails.gpxDisplay.showElevationProfile && elevationProfile.length >= 2 ? (
                        <CourseProfileCard
                          title={t.catalog.racebookSectionCourseProfile}
                          points={elevationProfile}
                          emptyMessage={t.catalog.racebookEmptyCourseProfile}
                        />
                      ) : null}
                    </>
                  ) : (
                    <SectionCard title={t.catalog.racebookCourseTabRoute}>
                      <EmptyState message={t.catalog.racebookEmptyCourse} />
                    </SectionCard>
                  )
                ) : null}

                <RacebookStructuredCourseSections
                  activeTab={activeCourseTab}
                  relaySegments={relaySegments}
                  startWaves={data.startWaves}
                  awardsByTime={awardsByTime}
                  theme={brandTheme}
                  copy={{
                    relayTitle: t.catalog.racebookSectionRelay,
                    relayLeg: t.catalog.racebookRelayLeg,
                    relayHandoverTime: t.catalog.racebookRelayHandoverTime,
                    aidCutoffTime: t.catalog.racebookAidCutoffTime,
                    waveBibNumbers: t.catalog.racebookWaveBibNumbers,
                    waveAll: t.catalog.racebookWaveAll,
                    awardsTitle: t.catalog.racebookSectionAwards,
                    awardWomen: t.catalog.racebookAwardWomen,
                    awardMen: t.catalog.racebookAwardMen,
                    awardMixed: t.catalog.racebookAwardMixed,
                  }}
                />

                {activeCourseTab === 'aid-stations' ? (
                  <>
                  <RacebookAidStationsSection
                    stations={data.aidStations}
                    finish={{
                      label: t.catalog.racebookMapFinish,
                      distanceKm: data.race.distanceKm,
                      elevationGainM: data.race.elevationGainM,
                      elevationLossM: data.race.elevationLossM,
                      cutoffTime: data.runnerDetails.schedule.finishCutoffTime,
                    }}
                    expandedStationId={expandedAidStationId}
                    showOfficialProducts={sponsorPresentation.modules.official_products}
                    theme={brandTheme}
                    onToggleStation={(station) => {
                      if (expandedAidStationId !== station.id) {
                        captureRacebookInteraction('racebook aid station opened', {
                          aid_station_id: station.id,
                          aid_station_name: station.name,
                          distance_km: station.km,
                        });
                      }
                      setExpandedAidStationId((current) => (current === station.id ? null : station.id));
                    }}
                    copy={{
                      sectionTitle: t.catalog.racebookSectionAidStations,
                      emptyMessage: t.catalog.racebookEmptyAidStations,
                      aidProducts: t.catalog.racebookAidProducts,
                      aidWater: t.catalog.racebookAidWater,
                      aidFood: t.catalog.racebookAidFood,
                      aidAssistance: t.catalog.racebookAidAssistance,
                      aidDropBag: t.catalog.racebookAidDropBag,
                      aidDistance: t.catalog.racebookAidDistance,
                      aidElevationGain: t.catalog.racebookAidElevationGain,
                      aidElevationLoss: t.catalog.racebookAidElevationLoss,
                      aidCutoffTime: t.catalog.racebookAidCutoffTime,
                      aidFromStart: locale === 'fr' ? 'Depuis le départ' : 'From the start',
                      aidFromPrevious: locale === 'fr' ? 'Depuis {name}' : 'From {name}',
                      startLabel: t.catalog.racebookMapStart,
                      finishLabel: t.catalog.racebookMapFinish,
                    }}
                  />
                  <RacebookSponsorBanner
                    key={`aid-stations-${id ?? 'unknown'}`}
                    sponsors={sponsorPresentation.contextualSponsors}
                    label={t.catalog.racebookSponsorsBannerLabel}
                    discoverLabel={t.catalog.racebookSponsorDiscover}
                    placement="aid_stations"
                    theme={brandTheme}
                    onSponsorImpression={reportSponsorImpression}
                  />
                  </>
                ) : null}

              </>
            ) : null}

            {activeTab === 'access' ? (
              <>
              <RacebookAccessSection
                presentation={accessPresentation}
                expanded={expandedAccessTransport}
                theme={brandTheme}
                onOpenUrl={openExternalUrl}
                onOpenMap={(location) => {
                  captureRacebookInteraction('racebook action clicked', {
                    action: 'map_opened',
                    action_context: `access_${location}`,
                  });
                }}
                onToggleTransport={(key) => {
                  if (!expandedAccessTransport[key]) {
                    captureRacebookInteraction('racebook access detail opened', { detail: key });
                  }
                  setExpandedAccessTransport((current) => ({ ...current, [key]: !current[key] }));
                }}
                copy={{
                  accessTitle: t.catalog.racebookTabAccess,
                  emptyMessage: t.catalog.racebookEmptyAccess,
                  essentialTitle: t.catalog.racebookAccessEssential,
                  locationsTitle: t.catalog.racebookAccessLocations,
                  gettingThereTitle: t.catalog.racebookAccessGettingThere,
                  openMapsLabel: t.catalog.racebookAccessOpenMaps,
                  openGeneralMapLabel: t.catalog.racebookAccessOpenGeneralMap,
                  showDetailsLabel: t.catalog.racebookAccessShowDetails,
                  hideDetailsLabel: t.catalog.racebookAccessHideDetails,
                  scheduleLabel: t.catalog.racebookAccessSchedule,
                }}
              />
              <RacebookSponsorBanner
                key={`access-${id ?? 'unknown'}`}
                sponsors={sponsorPresentation.contextualSponsors}
                label={t.catalog.racebookSponsorsBannerLabel}
                discoverLabel={t.catalog.racebookSponsorDiscover}
                placement="access"
                theme={brandTheme}
                onSponsorImpression={reportSponsorImpression}
              />
              </>
            ) : null}

            {activeTab === 'services' ? (
              <>
              <RacebookServicesSection
                services={structuredServices.map((service) => ({
                  id: service.id,
                  category: service.serviceType,
                  name: service.name,
                  description: service.description,
                  address: service.address,
                  distanceKm: service.distanceKm,
                  directionsUrl: service.directionsUrl,
                  websiteUrl: service.websiteUrl,
                  phoneUrl: service.phone ? buildTelephoneUrl(service.phone) : null,
                }))}
                legacySections={serviceSections.map((section) => ({
                  key: section.title,
                  title: section.title,
                  value: section.value,
                }))}
                theme={brandTheme}
                onOpenUrl={(url, action, service) => {
                  const trackedAction = action === 'directions'
                    ? 'service_directions'
                    : action === 'website'
                      ? 'service_website'
                      : 'service_phone';
                  openTrackedUrl(url, trackedAction, service.category);
                }}
                copy={{
                  emptyMessage: locale === 'fr'
                    ? 'Aucun service publié pour cette édition.'
                    : 'No services have been published for this edition.',
                  directionsLabel: t.catalog.racebookAccessOpenMaps,
                  websiteLabel: t.catalog.racebookServiceWebsite,
                  callLabel: t.catalog.racebookCallAction,
                  categoryTitles: {
                    restaurant: t.catalog.racebookServiceRestaurants,
                    accommodation: t.catalog.racebookServiceAccommodations,
                    recovery: t.catalog.racebookServiceRecovery,
                    other: locale === 'fr' ? 'Autres services' : 'Other services',
                  },
                }}
              />
              <RacebookSponsorBanner
                key={`services-${id ?? 'unknown'}`}
                sponsors={sponsorPresentation.contextualSponsors}
                label={t.catalog.racebookSponsorsBannerLabel}
                discoverLabel={t.catalog.racebookSponsorDiscover}
                placement="services"
                theme={brandTheme}
                onSponsorImpression={reportSponsorImpression}
              />
              </>
            ) : null}
          </View>
        </>
      ) : null}
      </Animated.ScrollView>
      {!showLoading && !unavailable && data ? (
        <RacebookTabBar
          tabs={tabs}
          activeTab={activeTab}
          onPress={handleTabPress}
          exitAction={{
            label: locale === 'fr' ? 'Courses' : 'Races',
            accessibilityLabel: locale === 'fr' ? 'Quitter le RaceBook et revenir aux courses' : 'Leave the RaceBook and return to races',
            onPress: exitRacebookToCatalog,
          }}
          theme={brandTheme}
        />
      ) : null}
      {onboarding === 'racebook' && !showLoading ? (
        <OnboardingGuideCard
          title={
            unavailable
              ? t.onboarding.tours.unavailableTitle
              : t.onboarding.tours.exploreRacebookTitle
          }
          body={
            unavailable
              ? t.onboarding.tours.unavailableBody
              : t.onboarding.tours.exploreRacebookBody
          }
          actionLabel={unavailable ? undefined : t.onboarding.tours.understood}
          onAction={unavailable ? undefined : () => void finishRacebookOnboarding(true)}
          skipLabel={t.onboarding.tours.skip}
          onSkip={() => void finishRacebookOnboarding(false)}
          busy={onboardingBusy}
        />
      ) : null}
    </View>
    </RacebookBrandThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
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
    fontSize: 12,
    lineHeight: 16,
  },
  heroMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaSeparator: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  heroParticipationBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroParticipationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroParticipationBadge: {
    paddingVertical: 2,
  },
  heroParticipationBadgeText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  heroLocationAction: {
    flexShrink: 1,
  },
  heroRaceDayRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  heroRaceDayText: {
    flexShrink: 1,
    color: Colors.brandPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroDetailGroup: {
    gap: 8,
  },
  heroDetailTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  contentWrap: {
    gap: 12,
  },
  courseTabsWrap: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    padding: 4,
    gap: 4,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  courseTabButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  courseTabButtonActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  courseTabButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  courseTabButtonTextActive: {
    color: Colors.brandPrimary,
  },
  courseEssentials: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  courseEssentialMetrics: {
    minHeight: 62,
    flexDirection: 'row',
  },
  courseEssentialMetric: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  courseEssentialLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  courseEssentialValue: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  courseEssentialValueCritical: {
    color: Colors.danger,
  },
  courseConstraintsButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  courseConstraintsLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  courseConstraintsContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
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
});

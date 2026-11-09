import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Image,
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RACEBOOK_EDITION_LOGO_ENABLED,
  resolveRacebookTheme,
  type ResolvedRacebookTheme,
} from '@pace-yourself/design-system';

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
  RACEBOOK_HERO_COMPACT_BODY_HEIGHT,
  RacebookCollapsibleHero,
} from '../../../../components/racebook/RacebookCollapsibleHero';
import {
  RACE_WORKSPACE_SWITCH_HEIGHT,
  RaceWorkspaceSwitch,
} from '../../../../components/race-workspace/RaceWorkspaceSwitch';
import {
  RacebookAccessSection,
  type RacebookAccessLocation,
  type RacebookAccessTransport,
} from '../../../../components/racebook/RacebookAccessSection';
import { RacebookAidStationsSection, type RacebookPersonalAidStationPlan } from '../../../../components/racebook/RacebookAidStationsSection';
import {
  RacebookBibSection,
  type RacebookBibPickupDayGroup,
  type RacebookBibPickupLocationGroup,
} from '../../../../components/racebook/RacebookBibSection';
import { RacebookGearSection } from '../../../../components/racebook/RacebookGearSection';
import { RacebookServicesSection } from '../../../../components/racebook/RacebookServicesSection';
import { RacebookSupporterPointsSection } from '../../../../components/racebook/RacebookSupporterPointsSection';
import { RacebookPersonalPlanCard, RacebookPlanInviteCard } from '../../../../components/racebook/RacebookPersonalPlanCard';
import { buildMapsSearchUrl } from '../../../../lib/racebookTextLinks';
import { RacebookStructuredCourseSections } from '../../../../components/racebook/RacebookStructuredCourseSections';
import { RacebookTabBar } from '../../../../components/racebook/RacebookTabBar';
import { RacebookElevationProfile } from '../../../../components/racebook/RacebookElevationProfile';
import { Colors } from '../../../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../../../lib/gpx';
import { useI18n } from '../../../../lib/i18n';
import {
  clearRaceProfileRequestCache,
  fetchPublishedRacebookElevationProfile,
  fetchPublishedRacebookRoutePreviewPoints,
  fetchRaceElevationProfile,
  pickBestElevationProfile,
} from '../../../../lib/raceProfile';
import { elevationProfileFromRoute } from '../../../../lib/racebookCourseVisuals';
import { approximateDistanceKm, fetchRaceRacebookData, type RacebookScreenData } from '../../../../lib/racebook';
import { fetchPartnerLinks, type ResolvedPartnerLink } from '../../../../lib/partnerLinks';
import {
  createRacebookSponsorViewId,
  EMPTY_RACEBOOK_SPONSORS,
  fetchRacebookSponsors,
  RACEBOOK_SPONSOR_MINIMUM_MS,
  reportRacebookPartnerSlotImpression,
  reportRacebookSponsorImpression,
  type RacebookSponsorImpression,
  type RacebookSponsorPresentation,
} from '../../../../lib/racebookSponsors';
import type { ElevationPoint } from '../../../../components/plan-form/profile-utils';
import { completeOnboarding, skipOnboardingKind } from '../../../../lib/onboardingStatus';
import { captureAnalyticsEvent } from '../../../../lib/posthog';
import {
  buildRacebookGearStateProperties,
  buildRacebookGearToggleProperties,
} from '../../../../lib/racebookGearAnalytics';
import {
  loadRacebookGearChecks,
  saveRacebookGearCheck,
} from '../../../../lib/racebookGearChecklist';
import { supabase } from '../../../../lib/supabase';
import { loadPlanProductsBootstrap } from '../../../../components/plan-form/usePlanProducts';
import { stagePlanWorkspaceWarmStart } from '../../../../lib/planEditSession';
import { buildPlanSummary, buildProductMap, buildStoredRacePlanFromRow, formatDuration, getPlanSummaryDepartureTimeStorageKey, type PlanSummary, type PlanSummaryRow } from '../../../../lib/planSummary';
import { normalizePlanClock, resolveMaximumRaceMinutes } from '../../../../lib/planDeparture';
import { createPlanPersistenceSnapshot } from '../../../../lib/planPersistence';
import {
  estimatePersonalPassageMinute,
  formatPersonalPassageClock,
  matchPersonalAidStation,
  normalizeSimpleClock,
  resolveDepartureOffsetMinutes,
  resolveOfficialCutoffSchedule,
} from '../../../../lib/racebookPlanReflection';
import { resolveRacebookFinishStation } from '../../../../lib/racebookAidStationPresentation';
import { hasVisibleRacebookSupporterPoints } from '../../../../lib/racebookSupporterPoints';
import { isPlanSourceRevisionPending } from '../../../../lib/planSourceRevision';
import { normalizeStoredPlanValues } from '../../../../lib/raceLivePlan';
import { formatAveragePace } from '../../../../lib/planWorkspace';
import { formatDistance, formatElevation, normalizeClockDisplay } from '../../../../lib/displayFormat';
import {
  getRacebookScreenSnapshot,
  getRacebookScrollOffset,
  setRacebookScreenSnapshot,
  setRacebookScrollOffset,
} from '../../../../lib/racebookScreenMemory';

type RacebookTabKey = 'gear' | 'bib' | 'course' | 'access' | 'services';
type CourseTabKey = 'route' | 'start-waves' | 'aid-stations' | 'supporters' | 'relay' | 'awards';

const OFFICIAL_FINISH_CUTOFF_ID = '__official-finish__';

type LinkedPlanSnapshot = {
  id: string;
  sourceRevisionAtLastReview: string | null;
  summary: PlanSummary;
};

function normalizeRacebookTab(value: string | undefined): RacebookTabKey {
  return value === 'gear' || value === 'bib' || value === 'course' || value === 'access' || value === 'services'
    ? value
    : 'gear';
}

function normalizeCourseTab(value: string | undefined): CourseTabKey {
  return value === 'route' || value === 'start-waves' || value === 'aid-stations' || value === 'supporters' || value === 'relay' || value === 'awards'
    ? value
    : 'route';
}

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
  void locale;
  return normalizeClockDisplay(value);
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
  aidStations,
  officialDistanceKm,
  locale,
}: {
  title: string;
  points: ElevationPoint[];
  emptyMessage: string;
  aidStations: RacebookScreenData['aidStations'];
  officialDistanceKm: number;
  locale: 'fr' | 'en';
}) {
  const brandTheme = useRacebookBrandTheme();
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const landscapeWidth = Math.max(viewportWidth, viewportHeight);
  const landscapeHeight = Math.min(viewportWidth, viewportHeight);
  return (
    <Card style={[styles.sectionCard, { backgroundColor: brandTheme.accentSurfaceColor, borderColor: brandTheme.accentBorderColor }]}>
      <View style={styles.courseVisualHeader}>
        <View style={styles.courseVisualTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.courseVisualHint}>{t.catalog.racebookProfileHint}</Text>
        </View>
        <Pressable
          style={[styles.expandButton, { borderColor: brandTheme.accentBorderColor }]}
          onPress={() => setFullscreen(true)}
          accessibilityRole="button"
          accessibilityLabel={t.catalog.racebookProfileExpand}
        >
          <Ionicons name="expand" size={18} color={brandTheme.accentGraphicColor} />
        </Pressable>
      </View>
      {points.length >= 2 ? (
        <RacebookElevationProfile
          points={points}
          aidStations={aidStations}
          accentColor={brandTheme.accentGraphicColor}
          officialDistanceKm={officialDistanceKm}
          locale={locale}
        />
      ) : (
        <EmptyState message={emptyMessage} />
      )}
      <Modal
        visible={fullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.fullscreenSurface}>
          <View
            style={[
              styles.landscapeCanvas,
              {
                width: landscapeWidth,
                height: landscapeHeight,
                left: (viewportWidth - landscapeWidth) / 2,
                top: (viewportHeight - landscapeHeight) / 2,
              },
            ]}
          >
            <View style={styles.fullscreenHeader}>
              <View style={styles.courseVisualTitleWrap}>
                <Text style={styles.fullscreenTitle}>{title}</Text>
                <Text style={styles.fullscreenSubtitle}>{t.catalog.racebookProfileFullscreenHint}</Text>
              </View>
              <Pressable
                style={styles.fullscreenClose}
                onPress={() => setFullscreen(false)}
                accessibilityRole="button"
                accessibilityLabel={t.catalog.racebookFullscreenClose}
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.fullscreenProfileBody}>
              <RacebookElevationProfile
                points={points}
                aidStations={aidStations}
                accentColor={brandTheme.accentGraphicColor}
                officialDistanceKm={officialDistanceKm}
                locale={locale}
                expanded
                profileHeight={Math.max(250, landscapeHeight - 155)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

function CourseMapCard({
  title,
  points,
  emptyMessage,
  aidStations,
  locale,
}: {
  title: string;
  points: MobileGpxPreviewPoint[];
  emptyMessage: string;
  aidStations: RacebookScreenData['aidStations'];
  locale: 'fr' | 'en';
}) {
  const brandTheme = useRacebookBrandTheme();
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);
  const { height: viewportHeight } = useWindowDimensions();
  const modalInsets = useSafeAreaInsets();
  return (
    <Card style={[styles.sectionCard, { backgroundColor: brandTheme.accentSurfaceColor, borderColor: brandTheme.accentBorderColor }]}>
      <View style={styles.courseVisualHeader}>
        <View style={styles.courseVisualTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.courseVisualHint}>{t.catalog.racebookMapHint}</Text>
        </View>
        <Pressable
          style={[styles.expandButton, { borderColor: brandTheme.accentBorderColor }]}
          onPress={() => setFullscreen(true)}
          accessibilityRole="button"
          accessibilityLabel={t.catalog.racebookMapExpand}
        >
          <Ionicons name="expand" size={18} color={brandTheme.accentGraphicColor} />
        </Pressable>
      </View>
      {points.length >= 2 ? (
        <RacebookLeafletMap points={points} aidStations={aidStations} routeColor={brandTheme.accentGraphicColor} locale={locale} />
      ) : (
        <EmptyState message={emptyMessage} />
      )}
      <Modal
        visible={fullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.fullscreenSurface}>
          <View style={[styles.fullscreenMapTopBar, { paddingTop: modalInsets.top + 8 }]}>
            <View style={styles.courseVisualTitleWrap}>
              <Text style={styles.fullscreenTitle}>{title}</Text>
              <Text style={styles.fullscreenSubtitle}>{t.catalog.racebookMapFullscreenHint}</Text>
            </View>
            <Pressable
              style={styles.fullscreenClose}
              onPress={() => setFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel={t.catalog.racebookFullscreenClose}
            >
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.fullscreenMapBody}>
            <RacebookLeafletMap
              points={points}
              aidStations={aidStations}
              routeColor={brandTheme.accentGraphicColor}
              locale={locale}
              height={Math.max(320, viewportHeight - modalInsets.top - 68)}
              fullscreen
            />
          </View>
        </View>
      </Modal>
    </Card>
  );
}

function InlineAlertCard({
  icon,
  title,
  message,
  collapsible = false,
  expandLabel,
  collapseLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  collapsible?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <View style={styles.alertIconWrap}>
          <Ionicons name={icon} size={14} color={Colors.warning} />
        </View>
        <Text numberOfLines={collapsible && !expanded ? 1 : undefined} style={styles.alertInlineText}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertBody}>{` - ${message}`}</Text>
        </Text>
        {collapsible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((current) => !current)}
            style={({ pressed }) => [styles.alertToggle, pressed && styles.alertTogglePressed]}
          >
            <Text style={styles.alertToggleText}>{expanded ? collapseLabel : expandLabel}</Text>
          </Pressable>
        ) : null}
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
  const { id, onboarding, tab, courseTab, targetAidStationId, planId, planWarmStartToken, returnTo } = useLocalSearchParams<{
    id?: string;
    onboarding?: 'racebook';
    tab?: string;
    courseTab?: string;
    targetAidStationId?: string;
    planId?: string;
    planWarmStartToken?: string;
    returnTo?: 'plans';
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { locale, t } = useI18n();
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const initialSnapshot = useMemo(() => getRacebookScreenSnapshot(id), [id]);
  const [activeTab, setActiveTab] = useState<RacebookTabKey>(() => normalizeRacebookTab(tab));
  const [activeCourseTab, setActiveCourseTab] = useState<CourseTabKey>(() => normalizeCourseTab(courseTab));
  const [expandedAidStationId, setExpandedAidStationId] = useState<string | null>(targetAidStationId ?? null);
  const [linkedPlanId, setLinkedPlanId] = useState<string | null>(planId ?? null);
  const [linkedPlanWarmStartToken, setLinkedPlanWarmStartToken] = useState<string | null>(planWarmStartToken ?? null);
  const [linkedPlan, setLinkedPlan] = useState<LinkedPlanSnapshot | null>(null);
  const [personalDepartureClock, setPersonalDepartureClock] = useState<string | null>(null);
  const [checkedGearItemKeys, setCheckedGearItemKeys] = useState<Set<string>>(new Set());
  const [pendingGearItemKeys, setPendingGearItemKeys] = useState<Set<string>>(new Set());
  const [gearChecksLoadedRaceId, setGearChecksLoadedRaceId] = useState<string | null>(null);
  const [courseConstraintsExpanded, setCourseConstraintsExpanded] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [loading, setLoading] = useState(() => !initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<RacebookScreenData | null>(() => initialSnapshot?.data ?? null);
  const [partnerLinks, setPartnerLinks] = useState<ResolvedPartnerLink[]>(() => initialSnapshot?.partnerLinks ?? []);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>(() => initialSnapshot?.elevationProfile ?? []);
  const [routePreviewPoints, setRoutePreviewPoints] = useState<MobileGpxPreviewPoint[]>(() => initialSnapshot?.routePreviewPoints ?? []);
  const [sponsorPresentation, setSponsorPresentation] = useState<RacebookSponsorPresentation>(() => initialSnapshot?.sponsorPresentation ?? EMPTY_RACEBOOK_SPONSORS);
  const [sponsorGateDone, setSponsorGateDone] = useState(() => Boolean(initialSnapshot));
  const [sponsorSplashVisible, setSponsorSplashVisible] = useState(false);
  const [sponsorLookupDone, setSponsorLookupDone] = useState(() => Boolean(initialSnapshot));
  const [loadingProgress, setLoadingProgress] = useState(() => initialSnapshot ? 1 : 0.06);
  const [loadingExitDone, setLoadingExitDone] = useState(() => Boolean(initialSnapshot));
  const [existingPlan, setExistingPlan] = useState<{ raceId: string; planId: string | null } | null>(null);
  const [planCtaBusy, setPlanCtaBusy] = useState(false);
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
  const gearChecklistInteractedRef = useRef(false);
  const lastGearStateSignatureRef = useRef<{ raceId: string; signature: string } | null>(null);
  const activeRaceIdRef = useRef(id);
  const currentScrollOffsetRef = useRef(0);
  const scrollRestoreFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  activeRaceIdRef.current = id;

  const findExistingPlanId = useCallback(async (raceId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;

    const { data: plan, error } = await supabase
      .from('race_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('race_id', raceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return typeof plan?.id === 'string' ? plan.id : null;
  }, []);

  const refreshExistingPlan = useCallback(async () => {
    if (!id) {
      setExistingPlan(null);
      return;
    }

    try {
      const planId = await findExistingPlanId(id);
      if (activeRaceIdRef.current === id) {
        setExistingPlan({ raceId: id, planId });
      }
    } catch (error) {
      console.warn('Unable to resolve the existing RaceBook plan.', error);
      if (activeRaceIdRef.current === id) setExistingPlan({ raceId: id, planId: null });
    }
  }, [findExistingPlanId, id]);

  useFocusEffect(
    useCallback(() => {
      void refreshExistingPlan();
      return undefined;
    }, [refreshExistingPlan]),
  );

  if (!sponsorViewRef.current || sponsorViewRef.current.raceId !== (id ?? null)) {
    sponsorViewRef.current = { raceId: id ?? null, viewId: createRacebookSponsorViewId() };
  }
  const sponsorViewId = sponsorViewRef.current.viewId;

  analyticsDataRef.current = data;
  activeTabRef.current = activeTab;
  activeCourseTabRef.current = activeCourseTab;

  const persistCurrentScrollPosition = useCallback(() => {
    if (!activeRaceIdRef.current) return;
    setRacebookScrollOffset(
      activeRaceIdRef.current,
      activeTabRef.current,
      activeCourseTabRef.current,
      currentScrollOffsetRef.current,
    );
  }, []);

  const restoreCurrentScrollPosition = useCallback(() => {
    if (!activeRaceIdRef.current) return;
    const offset = getRacebookScrollOffset(
      activeRaceIdRef.current,
      activeTabRef.current,
      activeCourseTabRef.current,
    );
    currentScrollOffsetRef.current = offset;
    if (scrollRestoreFrameRef.current !== null) cancelAnimationFrame(scrollRestoreFrameRef.current);
    scrollRestoreFrameRef.current = requestAnimationFrame(() => {
      scrollRestoreFrameRef.current = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: offset, animated: false });
        scrollY.setValue(offset);
        scrollRestoreFrameRef.current = null;
      });
    });
  }, [scrollY]);

  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: false,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          currentScrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
        },
      },
    ),
    [scrollY],
  );

  useEffect(() => {
    setActiveTab(normalizeRacebookTab(tab));
    setActiveCourseTab(normalizeCourseTab(courseTab));
    setExpandedAidStationId(targetAidStationId ?? null);
  }, [courseTab, id, tab, targetAidStationId]);

  useEffect(() => {
    setLinkedPlanId(planId ?? null);
    setLinkedPlanWarmStartToken(planWarmStartToken ?? null);
    setLinkedPlan(null);
    setPersonalDepartureClock(null);
  }, [id, planId, planWarmStartToken]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    if (!id) return () => { cancelled = true; };

    void (async () => {
      const sessionResult = await supabase.auth.getSession();
      const ownerId = sessionResult.data.session?.user?.id ?? null;
      if (cancelled) return;
      if (!ownerId) {
        setLinkedPlanId(null);
        setLinkedPlanWarmStartToken(null);
        setLinkedPlan(null);
        return;
      }
      const { data: plan, error: planError } = await supabase
        .from('race_plans')
        .select('id,name,updated_at,planner_values,elevation_profile,source_revision_at_last_review')
        .eq('race_id', id)
        .eq('user_id', ownerId)
        .maybeSingle();
      if (cancelled) return;
      if (planError) return;
      if (!plan) {
        setLinkedPlanId(null);
        setLinkedPlanWarmStartToken(null);
        setLinkedPlan(null);
        return;
      }
      const [productData, storedDepartureClock, fetchedRaceElevationProfile] = await Promise.all([
        loadPlanProductsBootstrap(ownerId),
        AsyncStorage.getItem(getPlanSummaryDepartureTimeStorageKey(plan.id)).catch(() => null),
        fetchRaceElevationProfile(id),
      ]);
      if (cancelled) return;
      const storedPlan = buildStoredRacePlanFromRow(plan as PlanSummaryRow);
      const planValues = normalizeStoredPlanValues(storedPlan);
      const storedElevationProfile = storedPlan.elevationProfile ?? [];
      const editElevationProfile = pickBestElevationProfile(
        [storedElevationProfile, fetchedRaceElevationProfile],
        planValues.raceDistanceKm,
      );
      const warmStartToken = stagePlanWorkspaceWarmStart(plan.id, {
        draft: {
          elevationProfile: editElevationProfile,
          lastSavedSnapshot: createPlanPersistenceSnapshot(planValues, storedElevationProfile),
          planName: plan.name,
          values: planValues,
        },
        products: productData,
      });
      const summary = buildPlanSummary(
        storedPlan,
        buildProductMap(productData.allProducts),
      );
      setLinkedPlanId(plan.id);
      setLinkedPlanWarmStartToken(warmStartToken);
      setPersonalDepartureClock(normalizePlanClock(storedDepartureClock));
      setLinkedPlan({
        id: plan.id,
        sourceRevisionAtLastReview: plan.source_revision_at_last_review ?? null,
        summary,
      });
    })();

    return () => { cancelled = true; };
  }, [id]));

  useEffect(() => {
    setActiveTab(normalizeRacebookTab(tab));
    setActiveCourseTab(normalizeCourseTab(courseTab));
    setExpandedAidStationId(targetAidStationId ?? null);
  }, [courseTab, tab, targetAidStationId]);

  useEffect(() => {
    let cancelled = false;
    setLinkedPlanId(null);
    if (!id) return () => { cancelled = true; };

    void (async () => {
      const { data: plan } = await supabase
        .from('race_plans')
        .select('id')
        .eq('race_id', id)
        .maybeSingle();
      if (!cancelled) setLinkedPlanId(plan?.id ?? null);
    })();

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setCheckedGearItemKeys(new Set());
    setPendingGearItemKeys(new Set());
    setGearChecksLoadedRaceId(null);
    gearChecklistInteractedRef.current = false;
    lastGearStateSignatureRef.current = null;

    if (!id) return () => { cancelled = true; };

    loadRacebookGearChecks(id)
      .then((itemKeys) => {
        if (!cancelled && activeRaceIdRef.current === id) {
          setCheckedGearItemKeys(itemKeys);
          setGearChecksLoadedRaceId(id);
        }
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
      const analyticsProperties = buildRacebookGearToggleProperties(
        data?.runnerDetails.equipmentStatus.items ?? [],
        itemKey,
        checked,
      );
      if (analyticsProperties) {
        captureRacebookInteraction('racebook gear item toggled', analyticsProperties);
      }
      gearChecklistInteractedRef.current = true;
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
      setPartnerLinks([]);
      setLoading(false);
      setSponsorPresentation(EMPTY_RACEBOOK_SPONSORS);
      setSponsorSplashVisible(false);
      setSponsorLookupDone(true);
      setSponsorGateDone(true);
      setLoadingExitDone(false);
      return;
    }

    const warmSnapshot = getRacebookScreenSnapshot(id);
    const hasWarmSnapshot = warmSnapshot?.data.race.id === id;
    if (hasWarmSnapshot && warmSnapshot) {
      setData(warmSnapshot.data);
      setPartnerLinks(warmSnapshot.partnerLinks);
      setElevationProfile(warmSnapshot.elevationProfile);
      setRoutePreviewPoints(warmSnapshot.routePreviewPoints);
      setSponsorPresentation(warmSnapshot.sponsorPresentation);
      setSponsorSplashVisible(false);
      setSponsorLookupDone(true);
      setSponsorGateDone(true);
      setLoadingProgress(1);
      setLoadingExitDone(true);
      setLoading(false);
    } else {
      setData(null);
      setPartnerLinks([]);
      setElevationProfile([]);
      setRoutePreviewPoints([]);
      setLoading(true);
      setSponsorPresentation(EMPTY_RACEBOOK_SPONSORS);
      setSponsorSplashVisible(false);
      setSponsorLookupDone(false);
      setSponsorGateDone(false);
      setLoadingProgress(0.06);
      setLoadingExitDone(false);
    }

    const racebookDataRequest = fetchRaceRacebookData(id);
    Promise.all([
      racebookDataRequest,
      fetchPublishedRacebookElevationProfile(id),
      fetchPublishedRacebookRoutePreviewPoints(id),
      fetchPartnerLinks(),
    ])
      .then(([
        result,
        profilePoints,
        routePoints,
        resolvedPartnerLinks,
      ]: [RacebookScreenData | null, ElevationPoint[], MobileGpxPreviewPoint[], ResolvedPartnerLink[]]) => {
        if (!cancelled) {
          setData(result);
          setPartnerLinks(resolvedPartnerLinks);
          setElevationProfile(pickBestElevationProfile(
            [profilePoints, elevationProfileFromRoute(routePoints)],
            result?.race.distanceKm,
          ));
          setRoutePreviewPoints(routePoints);
        }
      })
      .catch(() => {
        if (!cancelled && !hasWarmSnapshot) {
          setData(null);
          setPartnerLinks([]);
          setElevationProfile([]);
          setRoutePreviewPoints([]);
        }
      })
      .finally(() => {
        if (!cancelled && !hasWarmSnapshot) {
          setLoading(false);
        }
      });

    racebookDataRequest
      .then((result) => fetchRacebookSponsors(id, result?.publicationId))
      .then(async (presentation) => {
        if (cancelled) return;

        setSponsorPresentation(presentation);
        if (hasWarmSnapshot) {
          setSponsorSplashVisible(false);
          setSponsorLookupDone(true);
          setSponsorGateDone(true);
          return;
        }
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
      const [result, profilePoints, routePoints, resolvedPartnerLinks] = await Promise.all([
        fetchRaceRacebookData(id),
        fetchPublishedRacebookElevationProfile(id),
        fetchPublishedRacebookRoutePreviewPoints(id),
        fetchPartnerLinks(),
      ]);

      setData(result);
      setPartnerLinks(resolvedPartnerLinks);
      setElevationProfile(pickBestElevationProfile(
        [profilePoints, elevationProfileFromRoute(routePoints)],
        result?.race.distanceKm,
      ));
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
  const eventLocationDetails = data?.event.organizerDetails.eventLocation;
  const raceLocationDetails = data?.race.organizerDetails.raceLocation;
  const headerLocation =
    data?.event.location ??
    eventLocationDetails?.label ??
    data?.race.location ??
    raceLocationDetails?.label ??
    null;
  const weatherPlan = data?.runnerDetails.equipmentStatus.weatherPlan ?? 'normal';
  const weatherAlertMessage =
    weatherPlan === 'cold'
      ? t.catalog.racebookWeatherColdAlert
      : weatherPlan === 'heat'
        ? t.catalog.racebookWeatherHeatAlert
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
  // Partner slots: the Pace Yourself affiliate card by default, replaced by
  // the organizer's partner or hidden when the edition has the Signature option.
  const equipmentPartnerSlot = sponsorPresentation.partnerSlots.equipment;
  const lodgingPartnerSlot = sponsorPresentation.partnerSlots.lodging;
  const bookingPartnerLinks = useMemo(() => {
    if (lodgingPartnerSlot.mode === 'hidden') return [];
    if (lodgingPartnerSlot.mode === 'partner') {
      return [{ partnerKey: 'booking' as const, url: lodgingPartnerSlot.clickUrl ?? '', isAffiliate: false }];
    }
    return partnerLinks.filter((link) => link.partnerKey === 'booking');
  }, [lodgingPartnerSlot, partnerLinks]);
  const decathlonPartnerLink = useMemo(() => {
    if (equipmentPartnerSlot.mode === 'hidden') return null;
    if (equipmentPartnerSlot.mode === 'partner') {
      return { partnerKey: 'decathlon' as const, url: equipmentPartnerSlot.clickUrl ?? '', isAffiliate: false };
    }
    return partnerLinks.find((link) => link.partnerKey === 'decathlon') ?? null;
  }, [equipmentPartnerSlot, partnerLinks]);

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
    }[] = [
      { key: 'gear', label: t.catalog.racebookTabGear, icon: 'bag-check' },
      { key: 'bib', label: t.catalog.racebookTabBib, icon: 'ticket' },
      { key: 'course', label: t.catalog.racebookTabCourse, icon: 'map' },
      { key: 'access', label: t.catalog.racebookTabAccess, icon: 'navigate' },
      { key: 'services', label: t.catalog.racebookSectionServices, icon: 'grid' },
    ];
    return availableTabs;
  }, [
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
          // Organizers often type a plain pickup address: fall back to a maps
          // search so every pickup location offers directions like Accès does.
          actionUrl: pickupLocation.locationDetails.googleMapsUrl ?? buildMapsSearchUrl(pickupLocation.location),
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
      bibPickup.thirdPartyPickupAllowed === true ? bibPickup.thirdPartyPickupConditions : null,
      bibPickup.equipmentCheck === true ? t.catalog.racebookBibEquipmentCheck : null,
      bibPickup.note,
    ].filter((value): value is string => Boolean(value));
  }, [data, t.catalog.racebookBibEquipmentCheck, t.catalog.racebookBibThirdPartyPickupAllowed]);

  const courseItems: LabeledItem[] = [];

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

  // Solo is the default participation mode: only relay formats get a label,
  // which keeps the hero one line shorter for most races.
  const participationLabels = data?.race.participationMode === 'solo'
    ? []
    : data?.race.participationMode === 'relay'
      ? [t.catalog.racebookParticipationRelay]
      : data?.race.participationMode === 'solo_and_relay'
        ? [t.catalog.racebookParticipationSolo, t.catalog.racebookParticipationRelay]
        : [];

  const raceCountdownDays = getDaysBeforeRace(data?.race.raceDate ?? null);
  const raceCountdownLabel = raceCountdownDays === null || raceCountdownDays < 0
    ? null
    : raceCountdownDays === 0
      ? t.catalog.racebookCountdownToday
      : t.catalog.racebookCountdownDays.replace('{days}', String(raceCountdownDays));

  const courseTabs = useMemo(() => {
    const availableTabs: { key: CourseTabKey; label: string }[] = [
      { key: 'route', label: t.catalog.racebookCourseTabRoute },
    ];
    if (sponsorPresentation.modules.aid_stations) availableTabs.push({ key: 'aid-stations', label: t.catalog.racebookCourseTabAidStations });
    if (hasVisibleRacebookSupporterPoints(data?.supporterPoints ?? [])) {
      availableTabs.push({ key: 'supporters', label: t.catalog.racebookCourseTabSupporters });
    }

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
    data?.supporterPoints,
    sponsorPresentation.modules,
    t.catalog.racebookCourseTabAidStations,
    t.catalog.racebookCourseTabAwards,
    t.catalog.racebookCourseTabRoute,
    t.catalog.racebookCourseTabStartWaves,
    t.catalog.racebookCourseTabSupporters,
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

  const equipmentItems = useMemo(
    () => data?.runnerDetails.equipmentStatus.items ?? [],
    [data],
  );
  const requiredEquipment = equipmentItems.filter((item) => item.active && item.required);
  const recommendedEquipment = equipmentItems.filter((item) => item.active && !item.required);
  const conditionalEquipment = equipmentItems.filter((item) => !item.active);
  const officialRevisionPending = Boolean(linkedPlan) && isPlanSourceRevisionPending(
    data?.race.planSourceUpdatedAt,
    linkedPlan?.sourceRevisionAtLastReview,
  );
  const linkedPlanAveragePace = linkedPlan
    ? formatAveragePace(linkedPlan.summary.totalDurationMin, linkedPlan.summary.distanceKm)
    : null;
  const resolvedStartTime = personalDepartureClock
    ?? normalizePlanClock(data?.runnerDetails.schedule.startTime)
    ?? normalizePlanClock(data?.startWaves[0]?.startTime);
  const officialStartTime = normalizePlanClock(data?.runnerDetails.schedule.startTime)
    ?? normalizePlanClock(data?.startWaves[0]?.startTime);
  // Official cutoffs are resolved once, in course order, from the official
  // departure: multi-day clocks such as "01:00" after "12:00" land on J+2.
  const officialCutoffs = useMemo(() => {
    if (!data) return { byStationId: {} as Record<string, number>, finishMinute: null as number | null };
    const finishStation = resolveRacebookFinishStation(data.aidStations);
    const finishCutoffText = data.runnerDetails.schedule.finishCutoffTime
      ?? finishStation?.organizerDetails.cutoffTime
      ?? null;
    const schedule = resolveOfficialCutoffSchedule(officialStartTime, data.race.raceDate, [
      ...data.aidStations
        .filter((station) => station.id !== finishStation?.id)
        .map((station) => ({
          id: station.id,
          km: station.km,
          cutoff: Math.abs(station.km - data.race.distanceKm) <= 0.2
            ? finishCutoffText ?? station.organizerDetails.cutoffTime
            : station.organizerDetails.cutoffTime,
        })),
      { id: OFFICIAL_FINISH_CUTOFF_ID, km: Math.max(data.race.distanceKm, finishStation?.km ?? 0), cutoff: finishCutoffText },
    ]);
    const { [OFFICIAL_FINISH_CUTOFF_ID]: finishMinute = null, ...byStationId } = schedule;
    if (finishStation && finishMinute !== null) byStationId[finishStation.id] = finishMinute;
    return { byStationId, finishMinute };
  }, [data, officialStartTime]);
  const officialCutoffDisplayByStationId = useMemo(() => Object.fromEntries(
    Object.entries(officialCutoffs.byStationId).map(([stationId, minute]) => [
      stationId,
      formatPersonalPassageClock(officialStartTime, minute),
    ]).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ), [officialCutoffs, officialStartTime]);
  const officialFinishCutoffDisplay = officialCutoffs.finishMinute === null
    ? null
    : formatPersonalPassageClock(officialStartTime, officialCutoffs.finishMinute);
  const maximumRaceMinutes = officialCutoffs.finishMinute ?? resolveMaximumRaceMinutes(
    officialStartTime,
    data?.runnerDetails.schedule.finishCutoffTime,
  );
  const maximumRaceLabel = maximumRaceMinutes === null ? null : formatDuration(maximumRaceMinutes);
  const planBeyondCutoff = Boolean(linkedPlan && maximumRaceMinutes !== null && linkedPlan.summary.totalDurationMin > maximumRaceMinutes);
  const personalPlanReflection = useMemo<{
    byStationId: Record<string, RacebookPersonalAidStationPlan>;
    finish: RacebookPersonalAidStationPlan | null;
  }>(() => {
    if (!linkedPlan || !data) return { byStationId: {}, finish: null };
    const departureClock = personalDepartureClock
      ?? normalizePlanClock(data.runnerDetails.schedule.startTime)
      ?? normalizePlanClock(data.startWaves[0]?.startTime);
    // Passages are relative to the personal departure, cutoffs to the official one.
    const departureOffset = resolveDepartureOffsetMinutes(departureClock, officialStartTime);
    const result: Record<string, RacebookPersonalAidStationPlan> = {};
    const planCheckpoints = linkedPlan.summary.checkpoints;
    const personalAidStationCheckpoints = planCheckpoints.filter(
      (checkpoint) => !checkpoint.isStart && !checkpoint.isFinish,
    );
    data.aidStations.forEach((station) => {
      const match = matchPersonalAidStation(station, personalAidStationCheckpoints);
      const checkpoint = match?.checkpoint ?? null;
      const arrivalMinute = checkpoint?.arrivalMinute
        ?? estimatePersonalPassageMinute(station.km, planCheckpoints);
      if (arrivalMinute === null) return;
      const estimatedClock = formatPersonalPassageClock(departureClock, arrivalMinute);
      const stationCutoffTime = Math.abs(station.km - data.race.distanceKm) <= 0.2
        ? data.runnerDetails.schedule.finishCutoffTime ?? station.organizerDetails.cutoffTime
        : station.organizerDetails.cutoffTime;
      const cutoffMinute = officialCutoffs.byStationId[station.id];
      result[station.id] = {
        passageLabel: t.catalog.racebookExpectedPassage,
        estimatedClock,
        arrivalMinute,
        pauseMinutes: Math.max(0, checkpoint?.pauseMinutes ?? 0),
        cutoffDisplay: officialCutoffDisplayByStationId[station.id]
          ?? normalizeSimpleClock(stationCutoffTime)
          ?? stationCutoffTime?.trim()
          ?? null,
        isAfterCutoff: cutoffMinute !== undefined
          && Math.round(arrivalMinute) + departureOffset > cutoffMinute,
      };
    });
    const finishCheckpoint = planCheckpoints.find((checkpoint) => checkpoint.isFinish)
      ?? planCheckpoints.at(-1)
      ?? null;
    const finishArrivalMinute = finishCheckpoint?.arrivalMinute
      ?? estimatePersonalPassageMinute(data.race.distanceKm, planCheckpoints);
    const finish = finishArrivalMinute === null ? null : {
      passageLabel: t.catalog.racebookExpectedPassage,
      estimatedClock: formatPersonalPassageClock(departureClock, finishArrivalMinute),
      arrivalMinute: finishArrivalMinute,
      pauseMinutes: 0,
      cutoffDisplay: officialFinishCutoffDisplay
        ?? normalizeSimpleClock(data.runnerDetails.schedule.finishCutoffTime)
        ?? data.runnerDetails.schedule.finishCutoffTime,
      isAfterCutoff: officialCutoffs.finishMinute !== null
        && Math.round(finishArrivalMinute) + departureOffset > officialCutoffs.finishMinute,
    };
    return { byStationId: result, finish };
  }, [data, linkedPlan, officialCutoffDisplayByStationId, officialCutoffs, officialFinishCutoffDisplay, officialStartTime, personalDepartureClock, t.catalog.racebookExpectedPassage]);
  const personalPlanByStationId = personalPlanReflection.byStationId;
  const equipmentNotes = [data?.runnerDetails.equipment.note].filter((value): value is string => Boolean(value));
  const brandTheme = useMemo(
    () => resolveRacebookTheme(sponsorPresentation.branding),
    [sponsorPresentation.branding],
  );
  const showLoading = loading || !sponsorGateDone || !loadingExitDone;
  const unavailable = !showLoading && (!data || !data.canOpen);
  const loadedRaceId = data?.race.id ?? null;
  const hasEmergencyHeader = Boolean(emergencyContact?.phone && emergencyTelephoneUrl);
  const initialHeroBodyHeight = hasEmergencyHeader ? RACEBOOK_HERO_BODY_HEIGHT + 44 : RACEBOOK_HERO_BODY_HEIGHT;
  // The hero reports its measured content height; the switch and content offset follow it.
  // Until a measurement exists for this race, an estimate is used.
  const [measuredHeroBodyHeight, setMeasuredHeroBodyHeight] = useState<number | null>(null);
  const heroBodyHeight = measuredHeroBodyHeight ?? initialHeroBodyHeight;
  const heroExpandedHeight = insets.top + heroBodyHeight;

  useEffect(() => {
    setMeasuredHeroBodyHeight(null);
  }, [id]);

  const handleHeroBodyHeightChange = useCallback((measuredHeight: number) => {
    if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return;
    setMeasuredHeroBodyHeight((current) => current !== null && Math.abs(current - measuredHeight) < 1 ? current : measuredHeight);
  }, []);

  useEffect(() => {
    if (!id || showLoading || !data || data.race.id !== id) return;
    setRacebookScreenSnapshot(id, {
      data,
      elevationProfile,
      partnerLinks,
      routePreviewPoints,
      sponsorPresentation,
    });
  }, [data, elevationProfile, id, partnerLinks, routePreviewPoints, showLoading, sponsorPresentation]);

  useEffect(() => {
    if (
      !id ||
      gearChecksLoadedRaceId !== id ||
      pendingGearItemKeys.size > 0 ||
      !data?.canOpen ||
      data.race.id !== id ||
      equipmentItems.length === 0 ||
      (checkedGearItemKeys.size === 0 && !gearChecklistInteractedRef.current)
    ) {
      return;
    }

    const itemStates = buildRacebookGearStateProperties(equipmentItems, checkedGearItemKeys);
    const signature = itemStates
      .map((item) => `${item.item_analytics_id}:${item.checked ? '1' : '0'}`)
      .sort()
      .join('|');
    const previous = lastGearStateSignatureRef.current;
    if (previous?.raceId === id && previous.signature === signature) return;

    const context = buildRacebookAnalyticsProperties(
      data,
      onboarding === 'racebook' ? 'onboarding' : 'standard',
    );
    for (const itemState of itemStates) {
      captureAnalyticsEvent('racebook gear item state synced', {
        ...context,
        ...itemState,
        state_source: gearChecklistInteractedRef.current ? 'toggle' : 'checklist_load',
      });
    }
    lastGearStateSignatureRef.current = { raceId: id, signature };
  }, [
    checkedGearItemKeys,
    data,
    equipmentItems,
    gearChecksLoadedRaceId,
    id,
    onboarding,
    pendingGearItemKeys.size,
  ]);

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
    }, [onboarding, showLoading, tabs.length]),
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

  const existingPlanId = existingPlan && existingPlan.raceId === id ? existingPlan.planId : null;
  // The plan is optional: the Livret/Plan switch and plan metrics only exist
  // once the runner owns a plan, so runners without one read a pure RaceBook.
  const showPlanWorkspace = Boolean(existingPlanId);
  const planLookupResolved = Boolean(existingPlan && existingPlan.raceId === id);
  const raceDaysRemaining = raceCountdownDays;
  const showPlanInvite = planLookupResolved
    && !existingPlanId
    && onboarding !== 'racebook'
    && data?.race.elevationGainM !== null
    && data?.race.elevationGainM !== undefined
    && (raceDaysRemaining === null || raceDaysRemaining >= 0);
  const handlePlanCtaPress = useCallback(async () => {
    if (!id || planCtaBusy) return;

    const raceId = id;
    setPlanCtaBusy(true);
    try {
      // Re-check immediately before navigation: a plan may have been created in
      // another screen while the RaceBook remained mounted.
      const currentPlanId = await findExistingPlanId(raceId);
      if (activeRaceIdRef.current !== raceId) return;

      setExistingPlan({ raceId, planId: currentPlanId });
      captureRacebookInteraction('racebook action clicked', {
        action: currentPlanId ? 'refine_plan' : 'create_plan',
        entry_point: 'course_invite',
      });

      if (currentPlanId) {
        persistCurrentScrollPosition();
        exitingToCatalogRef.current = true;
        const params = new URLSearchParams({
          racebookTab: activeTab,
          racebookCourseTab: activeCourseTab,
        });
        if (expandedAidStationId) params.set('targetAidStationId', expandedAidStationId);
        if (currentPlanId === linkedPlanId && linkedPlanWarmStartToken) {
          params.set('planWarmStartToken', linkedPlanWarmStartToken);
        }
        router.replace(`/(app)/plan/${currentPlanId}/edit?${params.toString()}`);
        return;
      }

      // The creation route remains responsible for the identified-account and
      // profile-completion gates. A locked plan is intentionally opened in its
      // editor; the editor owns the upgrade prompts for paid modifications.
      router.replace({
        pathname: '/(app)/plan/new',
        params: {
          raceId,
          racebookTab: activeTab,
          racebookCourseTab: activeCourseTab,
          ...(expandedAidStationId ? { targetAidStationId: expandedAidStationId } : {}),
        },
      });
    } catch (error) {
      console.warn('Unable to open the RaceBook plan action.', error);
      Alert.alert(
        t.common.error,
        t.catalog.racebookPlanCheckFailed,
      );
    } finally {
      if (activeRaceIdRef.current === raceId) setPlanCtaBusy(false);
    }
  }, [activeCourseTab, activeTab, captureRacebookInteraction, expandedAidStationId, findExistingPlanId, id, linkedPlanId, linkedPlanWarmStartToken, persistCurrentScrollPosition, planCtaBusy, router, t.catalog.racebookPlanCheckFailed, t.common.error]);

  const handleTabPress = useCallback((tab: RacebookTabKey) => {
    if (tab === activeTab) return;

    persistCurrentScrollPosition();
    setActiveTab(tab);
    const session = analyticsSessionRef.current;
    if (!session) return;

    session.visitedTabs.add(tab);
    captureAnalyticsEvent('racebook tab viewed', { ...session.properties, tab });
  }, [activeTab, persistCurrentScrollPosition]);

  const handleCourseTabPress = useCallback((courseTab: CourseTabKey) => {
    if (courseTab === activeCourseTab) return;

    persistCurrentScrollPosition();
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
  }, [activeCourseTab, persistCurrentScrollPosition]);

  const openExternalUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert(
        t.common.error,
        t.catalog.racebookLinkOpenFailed,
      );
    });
  }, [t.catalog.racebookLinkOpenFailed, t.common.error]);

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
    captureRacebookInteraction('racebook action clicked', { action: returnTo === 'plans' ? 'exit_to_plans' : 'exit_to_catalog' });
    router.replace(returnTo === 'plans' ? '/(app)/plans' : '/(app)/catalog');
  }, [captureRacebookInteraction, returnTo, router]);

  const openLinkedPlan = useCallback(() => {
    if (!id) return;
    persistCurrentScrollPosition();
    exitingToCatalogRef.current = true;
    captureAnalyticsEvent('race workspace switched', {
      direction: 'racebook_to_plan',
      plan_action: linkedPlanId ? 'open' : 'create',
    });
    const params = new URLSearchParams({
      racebookTab: activeTab,
      racebookCourseTab: activeCourseTab,
    });
    if (expandedAidStationId) params.set('targetAidStationId', expandedAidStationId);
    if (linkedPlanWarmStartToken) params.set('planWarmStartToken', linkedPlanWarmStartToken);
    router.replace(
      linkedPlanId
        ? `/(app)/plan/${linkedPlanId}/edit?${params.toString()}`
        : `/(app)/plan/new?raceId=${id}&${params.toString()}`,
    );
  }, [activeCourseTab, activeTab, expandedAidStationId, id, linkedPlanId, linkedPlanWarmStartToken, persistCurrentScrollPosition, router]);

  const openLinkedPlanAtStation = useCallback((stationId: string) => {
    if (!linkedPlanId) return;
    persistCurrentScrollPosition();
    exitingToCatalogRef.current = true;
    captureAnalyticsEvent('race workspace switched', {
      direction: 'racebook_to_plan',
      plan_action: 'edit_aid_station',
    });
    const params = new URLSearchParams({
      racebookTab: 'course',
      racebookCourseTab: 'aid-stations',
      targetAidStationId: stationId,
    });
    if (linkedPlanWarmStartToken) params.set('planWarmStartToken', linkedPlanWarmStartToken);
    router.replace(`/(app)/plan/${linkedPlanId}/edit?${params.toString()}`);
  }, [linkedPlanId, linkedPlanWarmStartToken, persistCurrentScrollPosition, router]);

  const reportSponsorImpression = useCallback((impression: RacebookSponsorImpression) => {
    if (!id) return;
    void reportRacebookSponsorImpression(id, sponsorViewId, impression);
  }, [id, sponsorViewId]);

  // Organizer partner slots count one aggregate view per reader session once
  // their tab is shown; affiliate defaults are not counted here.
  const reportedPartnerSlotsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!id || showLoading) return;
    const visibleSlot = activeTab === 'gear' && equipmentPartnerSlot.mode === 'partner'
      ? 'equipment'
      : activeTab === 'services' && lodgingPartnerSlot.mode === 'partner'
        ? 'lodging'
        : null;
    if (!visibleSlot) return;
    const key = `${id}:${visibleSlot}`;
    if (reportedPartnerSlotsRef.current.has(key)) return;
    reportedPartnerSlotsRef.current.add(key);
    void reportRacebookPartnerSlotImpression(id, sponsorViewId, visibleSlot);
  }, [activeTab, equipmentPartnerSlot.mode, id, lodgingPartnerSlot.mode, showLoading, sponsorViewId]);

  useEffect(() => {
    navigation.setOptions({ headerRight: showLoading ? () => null : undefined });
    return () => navigation.setOptions({ headerRight: undefined });
  }, [navigation, showLoading]);

  useFocusEffect(useCallback(() => {
    exitingToCatalogRef.current = false;
    restoreCurrentScrollPosition();
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
      persistCurrentScrollPosition();
      if (scrollRestoreFrameRef.current !== null) {
        cancelAnimationFrame(scrollRestoreFrameRef.current);
        scrollRestoreFrameRef.current = null;
      }
      backSubscription.remove();
      unsubscribeBeforeRemove();
      tabsNavigation?.setOptions({ tabBarStyle: undefined });
    };
  }, [exitRacebookToCatalog, navigation, persistCurrentScrollPosition, restoreCurrentScrollPosition]));

  useEffect(() => {
    if (showLoading || unavailable || loadedRaceId !== id) return;
    restoreCurrentScrollPosition();
  }, [activeCourseTab, activeTab, id, loadedRaceId, restoreCurrentScrollPosition, showLoading, unavailable]);

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
          expandedBodyHeight={heroBodyHeight}
          eventName={data.event.name}
          raceName={data.race.name}
          logoUrl={RACEBOOK_EDITION_LOGO_ENABLED ? brandTheme.logoUrl : null}
          dateLabel={[formattedRaceDate ?? eventDateRange, raceCountdownLabel].filter(Boolean).join(' · ') || null}
          locationLabel={headerLocation}
          participationLabel={participationLabels.join(' + ') || null}
          participationIcon={data.race.participationMode === 'solo' ? 'person-outline' : 'people-outline'}
          startTimeLabel={t.catalog.racebookMapStart}
          startTimeValue={resolvedStartTime}
          maxTimeLabel={t.planWorkspace.maximumTime}
          maxTimeValue={maximumRaceLabel}
          distanceLabel={formatDistance(data.race.distanceKm, locale)}
          distanceCaption={t.planWorkspace.distance}
          elevationGainLabel={formatElevation(data.race.elevationGainM, locale)}
          elevationLossLabel={data.race.elevationLossM !== null ? formatElevation(data.race.elevationLossM, locale) : null}
          elevationCaption={t.planWorkspace.elevationGain}
          descentCaption={t.planWorkspace.elevationLoss}
          showPlanMetrics={showPlanWorkspace}
          planDurationLabel={linkedPlan ? `${formatDuration(linkedPlan.summary.totalDurationMin)}${planBeyondCutoff ? ` · ${t.planWorkspace.beyondCutoff}` : ''}` : null}
          planDurationCaption={t.catalog.racebookExpectedTime}
          planPaceLabel={linkedPlanAveragePace && linkedPlanAveragePace !== '—' ? `${linkedPlanAveragePace}/km` : linkedPlanAveragePace}
          planPaceCaption={t.catalog.racebookPace}
          backLabel={t.common.back}
          linksLabel={t.catalog.racebookOrganizerLinks}
          closeLabel={t.common.close}
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
          onOpenSocial={(url, action) => openTrackedUrl(url, action)}
          onExpandedBodyHeightChange={handleHeroBodyHeightChange}
          attachedBelow={showPlanWorkspace && !showLoading && !unavailable && Boolean(data)}
        />
      ) : null}
      {showPlanWorkspace && !showLoading && !unavailable && data ? (
        <RaceWorkspaceSwitch
          active="racebook"
          backgroundColor={brandTheme.primaryColor}
          foregroundColor={brandTheme.onPrimaryColor}
          compactHeaderHeight={RACEBOOK_HERO_COMPACT_BODY_HEIGHT}
          expandedHeaderHeight={heroBodyHeight}
          onOpenPlan={openLinkedPlan}
          onOpenRacebook={() => undefined}
          planExists
          planDisabled={planCtaBusy}
          scrollY={scrollY}
          topInset={insets.top}
        />
      ) : null}
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: brandTheme.primarySurfaceColor },
          !showLoading && !unavailable && data ? { paddingTop: heroExpandedHeight + (showPlanWorkspace ? RACE_WORKSPACE_SWITCH_HEIGHT : 0) + 16 } : null,
          showLoading || unavailable ? { paddingTop: insets.top + 16 } : null,
          showLoading && { minHeight: Math.max(520, viewportHeight - 120) },
        ]}
        onScroll={handleScroll}
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

          {weatherAlertMessage ? <InlineAlertCard icon={weatherAlertIcon} title={t.catalog.racebookWeatherAlertTitle} message={weatherAlertMessage} /> : null}

          {lastMinuteMessage ? (
            <InlineAlertCard
              collapseLabel={t.catalog.racebookAlertCollapse}
              collapsible
              expandLabel={t.catalog.racebookAlertExpand}
              icon="megaphone-outline"
              message={lastMinuteMessage}
              title={t.catalog.racebookLastMinuteTitle}
            />
          ) : null}

          <View style={styles.contentWrap}>
            {activeTab === 'gear' ? (
              <>
              <RacebookGearSection
                requiredItems={sponsorPresentation.modules.equipment ? requiredEquipment : []}
                recommendedItems={sponsorPresentation.modules.equipment ? recommendedEquipment : []}
                weatherItems={sponsorPresentation.modules.equipment ? conditionalEquipment : []}
                notes={sponsorPresentation.modules.equipment ? equipmentNotes : []}
                checkedItemKeys={checkedGearItemKeys}
                pendingItemKeys={pendingGearItemKeys}
                onToggleItem={toggleGearItem}
                decathlonLink={decathlonPartnerLink}
                decathlonLogoUrl={equipmentPartnerSlot.mode === 'partner' ? equipmentPartnerSlot.logoUrl : null}
                onOpenDecathlonLink={() => {
                  if (equipmentPartnerSlot.mode === 'partner') {
                    // Organizer partner presses stay out of identified analytics; the
                    // counted redirect records the aggregate click.
                    if (equipmentPartnerSlot.clickUrl) openExternalUrl(equipmentPartnerSlot.clickUrl);
                  } else if (decathlonPartnerLink) {
                    openTrackedUrl(decathlonPartnerLink.url, 'partner_decathlon', 'equipment');
                  }
                }}
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
                  decathlonTitle: equipmentPartnerSlot.mode === 'partner' ? equipmentPartnerSlot.name : t.catalog.racebookDecathlonTitle,
                  decathlonDescription: equipmentPartnerSlot.mode === 'partner' ? equipmentPartnerSlot.headline ?? '' : t.catalog.racebookDecathlonDescription,
                  decathlonAction: equipmentPartnerSlot.mode === 'partner' ? t.catalog.racebookSponsorDiscover : t.catalog.racebookDecathlonAction,
                  affiliateDisclosure: t.catalog.racebookAffiliateDisclosure,
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
                locationGroups={sponsorPresentation.modules.bib_pickup ? bibLocationGroups : []}
                fallbackSchedule={sponsorPresentation.modules.bib_pickup ? data.runnerDetails.bibPickup.schedule : null}
                requiredDocuments={sponsorPresentation.modules.bib_pickup ? data.runnerDetails.bibPickup.requiredDocuments : null}
                rules={sponsorPresentation.modules.bib_pickup ? bibLines : []}
                onOpenUrl={openExternalUrl}
                onOpenMap={(location) => {
                  captureRacebookInteraction('racebook action clicked', {
                    action: 'map_opened',
                    action_context: `bib_${location}`,
                  });
                }}
                copy={{
                  whereAndWhenTitle: t.catalog.racebookBibWhereAndWhen,
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
                  <ScrollView
                    contentContainerStyle={styles.courseTabsContent}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    {courseTabs.map((tab) => {
                      const active = activeCourseTab === tab.key;

                      return (
                        <Pressable
                          key={tab.key}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: active }}
                          onPress={() => handleCourseTabPress(tab.key)}
                          style={[styles.courseTabButton, active ? styles.courseTabButtonActive : null]}
                        >
                          <Text style={[styles.courseTabButtonText, active ? styles.courseTabButtonTextActive : null]}>
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <RacebookPersonalPlanCard
                  hasPlan={Boolean(linkedPlanId)}
                  revisionPending={officialRevisionPending}
                  onOpenPlan={openLinkedPlan}
                />

                {(['route', 'start-waves', 'aid-stations'] as CourseTabKey[]).includes(activeCourseTab) &&
                ((activeCourseTab !== 'aid-stations' && courseItems.length > 0) || courseConstraintLines.length > 0) ? (
                  <View style={styles.courseEssentials}>
                    {courseItems.length > 0 && activeCourseTab !== 'aid-stations' ? (
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
                            {(courseConstraintLines.length > 1
                              ? t.catalog.racebookInstructionsMany
                              : t.catalog.racebookInstructionsOne
                            ).replace('{count}', String(courseConstraintLines.length))}
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
                ) : !(['route', 'start-waves', 'aid-stations'] as CourseTabKey[]).includes(activeCourseTab) &&
                  (courseItems.length > 0 || courseConstraintLines.length > 0) ? (
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
                          aidStations={data.aidStations}
                          locale={locale}
                        />
                      ) : null}

                      {data.race.organizerDetails.gpxDisplay.showElevationProfile && elevationProfile.length >= 2 ? (
                        <CourseProfileCard
                          title={t.catalog.racebookSectionCourseProfile}
                          points={elevationProfile}
                          emptyMessage={t.catalog.racebookEmptyCourseProfile}
                          aidStations={data.aidStations}
                          officialDistanceKm={data.race.distanceKm}
                          locale={locale}
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
                    locale={locale}
                    stations={data.aidStations}
                    finish={{
                      label: t.catalog.racebookMapFinish,
                      distanceKm: data.race.distanceKm,
                      elevationGainM: data.race.elevationGainM,
                      elevationLossM: data.race.elevationLossM,
                      cutoffTime: data.runnerDetails.schedule.finishCutoffTime,
                    }}
                    startTime={resolvedStartTime}
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
                    personalPlanByStationId={personalPlanByStationId}
                    officialCutoffDisplayByStationId={officialCutoffDisplayByStationId}
                    officialFinishCutoffDisplay={officialFinishCutoffDisplay}
                    finishPersonalPlan={personalPlanReflection.finish}
                    onEditPersonalPlanStation={(station) => openLinkedPlanAtStation(station.id)}
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
                      aidFromStart: t.catalog.racebookAidFromStart,
                      aidFromPrevious: t.catalog.racebookAidFromPrevious,
                      startLabel: t.catalog.racebookMapStart,
                      finishLabel: t.catalog.racebookMapFinish,
                      plannedDuration: t.catalog.racebookExpectedTime,
                      cutoffExceededWarning: t.catalog.racebookCutoffExceeded,
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
                {activeCourseTab === 'supporters' ? (
                  <RacebookSupporterPointsSection
                    locale={locale}
                    points={data.supporterPoints}
                    onOpenUrl={(url, action) => openTrackedUrl(url, action === 'directions' ? 'supporter_directions_opened' : 'supporter_plan_opened')}
                  />
                ) : null}
                {showPlanInvite && activeCourseTab !== 'supporters' ? (
                  <RacebookPlanInviteCard
                    accentColor={brandTheme.primaryForegroundColor}
                    disabled={planCtaBusy}
                    onCreatePlan={() => { void handlePlanCtaPress(); }}
                  />
                ) : null}

              </>
            ) : null}

            {activeTab === 'access' ? (
              <>
              <RacebookAccessSection
                presentation={sponsorPresentation.modules.access ? accessPresentation : null}
                expanded={expandedAccessTransport}
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
                  bookShuttleLabel: t.catalog.racebookAccessBookShuttle,
                  openLinkLabel: t.catalog.racebookAccessOpenLink,
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
                services={(sponsorPresentation.modules.services ? structuredServices : []).map((service) => ({
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
                legacySections={(sponsorPresentation.modules.services ? serviceSections : []).map((section) => ({
                  key: section.title,
                  title: section.title,
                  value: section.value,
                }))}
                partnerLinks={bookingPartnerLinks}
                partnerLogoUrls={lodgingPartnerSlot.mode === 'partner' ? { booking: lodgingPartnerSlot.logoUrl } : undefined}
                onOpenUrl={(url, action, service) => {
                  const trackedAction = action === 'directions'
                    ? 'service_directions'
                    : action === 'website'
                      ? 'service_website'
                      : 'service_phone';
                  openTrackedUrl(url, trackedAction, service.category);
                }}
                onOpenPartnerLink={(link) => {
                  if (link.partnerKey === 'booking' && lodgingPartnerSlot.mode === 'partner') {
                    if (lodgingPartnerSlot.clickUrl) openExternalUrl(lodgingPartnerSlot.clickUrl);
                    return;
                  }
                  openTrackedUrl(link.url, `partner_${link.partnerKey}`, 'services');
                }}
                copy={{
                  emptyMessage: t.catalog.racebookEmptyServices,
                  directionsLabel: t.catalog.racebookAccessOpenMaps,
                  websiteLabel: t.catalog.racebookServiceWebsite,
                  callLabel: t.catalog.racebookCallAction,
                  partnerLinksTitle: t.catalog.racebookPartnerLinksTitle,
                  affiliateDisclosure: t.catalog.racebookAffiliateDisclosure,
                  partnerLinks: {
                    booking: lodgingPartnerSlot.mode === 'partner' ? {
                      title: lodgingPartnerSlot.name,
                      description: lodgingPartnerSlot.headline ?? '',
                      actionLabel: t.catalog.racebookSponsorDiscover,
                    } : {
                      title: t.catalog.racebookBookingTitle,
                      description: t.catalog.racebookBookingDescription,
                      actionLabel: t.catalog.racebookBookingAction,
                    },
                    decathlon: {
                      title: t.catalog.racebookDecathlonTitle,
                      description: t.catalog.racebookDecathlonDescription,
                      actionLabel: t.catalog.racebookDecathlonAction,
                    },
                  },
                  categoryTitles: {
                    restaurant: t.catalog.racebookServiceRestaurants,
                    accommodation: t.catalog.racebookServiceAccommodations,
                    recovery: t.catalog.racebookServiceRecovery,
                    other: t.catalog.racebookServiceOther,
                  },
                }}
              />
              {sponsorPresentation.modules.services ? (
                <RacebookSponsorBanner
                  key={`services-${id ?? 'unknown'}`}
                  sponsors={sponsorPresentation.contextualSponsors}
                  label={t.catalog.racebookSponsorsBannerLabel}
                  discoverLabel={t.catalog.racebookSponsorDiscover}
                  placement="services"
                  theme={brandTheme}
                  onSponsorImpression={reportSponsorImpression}
                />
              ) : null}
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
  alertToggle: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  alertToggleText: {
    color: Colors.warning,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  alertTogglePressed: { opacity: 0.64 },
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
    alignSelf: 'stretch',
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  courseTabsContent: {
    flexGrow: 1,
    padding: 4,
    gap: 4,
  },
  courseTabButton: {
    flexGrow: 1,
    minWidth: 104,
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
  courseVisualHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  courseVisualTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  courseVisualHint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  expandButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  fullscreenSurface: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  fullscreenMapTopBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
  },
  fullscreenMapBody: {
    flex: 1,
    overflow: 'hidden',
  },
  fullscreenClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fullscreenTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  fullscreenSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  landscapeCanvas: {
    position: 'absolute',
    paddingHorizontal: 54,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    transform: [{ rotate: '90deg' }],
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullscreenProfileBody: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 6,
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

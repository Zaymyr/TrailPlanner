import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
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
import { Ionicons } from '@expo/vector-icons';
import { countVisiblePrimaryTabs, RacebookLoadingView, RacebookView, type RacebookInteraction, type RacebookViewModel } from '@pace-yourself/racebook-ui';
import {
  RACEBOOK_EDITION_LOGO_ENABLED,
  resolveRacebookTheme,
  type ResolvedRacebookTheme,
} from '@pace-yourself/design-system';

import { ProfileMiniChart } from '../../../../components/plan-form/ProfileMiniChart';
import { RacebookLeafletMap } from '../../../../components/race/RacebookLeafletMap';
import { Heading } from '../../../../components/themed/Heading';
import { Text } from '../../../../components/themed/Text';
import { OnboardingGuideCard } from '../../../../components/onboarding/OnboardingGuideCard';
import { Colors } from '../../../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../../../lib/gpx';
import { useI18n } from '../../../../lib/i18n';
import { clearRaceProfileRequestCache, fetchRaceElevationProfile, fetchRaceRoutePreviewPoints } from '../../../../lib/raceProfile';
import { fetchRaceRacebookData, type RacebookScreenData } from '../../../../lib/racebook';
import {
  EMPTY_RACEBOOK_SPONSORS,
  fetchRacebookSponsors,
  RACEBOOK_SPONSOR_MINIMUM_MS,
  type RacebookSponsor,
  type RacebookSponsorPresentation,
} from '../../../../lib/racebookSponsors';
import type { ElevationPoint } from '../../../../components/plan-form/profile-utils';
import { completeOnboarding, skipOnboardingKind } from '../../../../lib/onboardingStatus';
import { captureAnalyticsEvent } from '../../../../lib/posthog';

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

const DAY_MS = 24 * 60 * 60 * 1_000;

function buildSharedRacebookModel(
  data: RacebookScreenData,
  sponsors: RacebookSponsorPresentation,
  branding: ResolvedRacebookTheme,
  elevationProfile: ElevationPoint[],
  routePreviewPoints: MobileGpxPreviewPoint[],
): RacebookViewModel {
  const effectiveBranding = sponsors.modules.branding ? branding : resolveRacebookTheme(null);
  const modules = {
    equipment: sponsors.modules.equipment,
    bibPickup: sponsors.modules.bib_pickup,
    access: sponsors.modules.access,
    services: sponsors.modules.services,
    branding: sponsors.modules.branding,
    sponsors: sponsors.modules.sponsors,
    aidStations: sponsors.modules.aid_stations,
    startWaves: sponsors.modules.start_waves,
    awards: sponsors.modules.awards,
    relay: sponsors.modules.relay,
    officialProducts: sponsors.modules.official_products,
  };
  const moduleStatus = Object.fromEntries(
    Object.keys(modules).map((key) => [key, modules[key as keyof typeof modules] ? 'active' : 'inactive']),
  ) as RacebookViewModel['moduleStatus'];
  const mapSponsor = (sponsor: RacebookSponsor) => ({
    id: sponsor.id,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl,
    websiteUrl: sponsor.clickUrl,
    showOnLoading: sponsors.loadingSponsors.some((item) => item.id === sponsor.id),
    showInBanner: sponsors.bannerSponsors.some((item) => item.id === sponsor.id),
    position: 0,
  });

  return {
    data: {
      race: {
        id: data.race.id,
        name: data.race.name,
        distanceKm: data.race.distanceKm,
        elevationGainM: data.race.elevationGainM,
        elevationLossM: data.race.elevationLossM,
        raceDate: data.race.raceDate,
        thumbnailUrl: data.race.thumbnailUrl,
        location: data.race.location,
        startLatitude: data.race.startLatitude,
        startLongitude: data.race.startLongitude,
        participationMode: data.race.participationMode,
        locationDetails: data.race.organizerDetails.raceLocation,
        schedule: {
          startTime: data.runnerDetails.schedule.startTime,
          finishCutoffTime: data.runnerDetails.schedule.finishCutoffTime,
          cutoffNote: data.runnerDetails.schedule.cutoffNote,
          note: data.runnerDetails.schedule.note,
        },
        runnerInfo: data.runnerDetails.runnerInfo,
      },
      event: {
        id: data.event.id,
        name: data.event.name,
        location: data.event.location,
        raceDate: data.event.raceDate,
        endDate: data.event.organizerDetails.dateRange.endDate,
        thumbnailUrl: data.event.thumbnailUrl,
        locationDetails: data.event.organizerDetails.eventLocation,
        officialWebsiteUrl: data.event.organizerDetails.officialWebsiteUrl,
        instagramUrl: data.event.organizerDetails.instagramUrl,
        facebookUrl: data.event.organizerDetails.facebookUrl,
        emergencyContact: data.event.organizerDetails.emergencyContact,
      },
      equipment: {
        weatherPlan: data.runnerDetails.equipmentStatus.weatherPlan,
        items: data.runnerDetails.equipmentStatus.items.map((item, index) => ({
          ...item,
          id: item.id ?? `equipment-${index}`,
        })),
        note: data.runnerDetails.equipment.note,
      },
      bibPickup: {
        locations: data.runnerDetails.bibPickup.locations.length > 0
          ? data.runnerDetails.bibPickup.locations
          : data.runnerDetails.bibPickup.location
            ? [{
                location: data.runnerDetails.bibPickup.location,
                locationDetails: data.runnerDetails.bibPickup.locationDetails,
                slots: [],
              }]
            : [],
        requiredDocuments: data.runnerDetails.bibPickup.requiredDocuments,
        schedule: data.runnerDetails.bibPickup.schedule,
        thirdPartyPickupAllowed: data.runnerDetails.bibPickup.thirdPartyPickupAllowed,
        equipmentCheck: data.runnerDetails.bibPickup.equipmentCheck,
        note: data.runnerDetails.bibPickup.note ?? data.runnerDetails.bibPickup.schedule,
      },
      access: data.runnerDetails.access,
      legacyServices: data.runnerDetails.services,
      aidStations: data.aidStations.map((station) => ({
        ...station,
        organizerDetails: { ...station.organizerDetails, altitudeM: null },
      })),
      relayPoints: data.relayPoints,
      startWaves: data.startWaves,
      awards: data.awards,
      editionServices: data.editionServices,
    },
    branding: {
      logoUrl: sponsors.modules.branding && RACEBOOK_EDITION_LOGO_ENABLED ? effectiveBranding.logoUrl : null,
      primaryColor: effectiveBranding.primaryColor,
      accentColor: effectiveBranding.accentColor,
      onPrimaryColor: effectiveBranding.onPrimaryColor,
      primarySurfaceColor: effectiveBranding.primarySurfaceColor,
      primaryBorderColor: effectiveBranding.primaryBorderColor,
      accentSurfaceColor: effectiveBranding.accentSurfaceColor,
      accentBorderColor: effectiveBranding.accentBorderColor,
    },
    modules,
    moduleStatus,
    sponsors: {
      loading: sponsors.modules.sponsors ? sponsors.loadingSponsors.map(mapSponsor) : [],
      banner: sponsors.modules.sponsors ? sponsors.bannerSponsors.map(mapSponsor) : [],
    },
    route: {
      elevationProfile,
      previewPoints: routePreviewPoints.map((point) => ({
        latitude: point.lat,
        longitude: point.lng,
      })),
      distanceKm: data.race.distanceKm,
      gainM: data.race.elevationGainM,
      lossM: data.race.elevationLossM,
    },
  };
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

export default function RaceRacebookScreen() {
  const { id, onboarding } = useLocalSearchParams<{ id?: string; onboarding?: 'racebook' }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { locale, t } = useI18n();
  const { height: viewportHeight } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<RacebookTabKey>('gear');
  const [activeCourseTab, setActiveCourseTab] = useState<CourseTabKey>('route');
  const [expandedAidStationId, setExpandedAidStationId] = useState<string | null>(null);
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const analyticsSessionRef = useRef<RacebookAnalyticsSession | null>(null);
  const analyticsDataRef = useRef<RacebookScreenData | null>(null);
  const activeTabRef = useRef<RacebookTabKey>('gear');
  const activeCourseTabRef = useRef<CourseTabKey>('route');
  const unavailableTrackedRaceIdRef = useRef<string | null>(null);

  analyticsDataRef.current = data;
  activeTabRef.current = activeTab;
  activeCourseTabRef.current = activeCourseTab;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);

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

  const brandTheme = useMemo(
    () => resolveRacebookTheme(sponsorPresentation.branding),
    [sponsorPresentation.branding],
  );
  const sharedRacebookModel = useMemo(
    () => data
      ? buildSharedRacebookModel(data, sponsorPresentation, brandTheme, elevationProfile, routePreviewPoints)
      : null,
    [brandTheme, data, elevationProfile, routePreviewPoints, sponsorPresentation],
  );
  const showLoading = loading || !sponsorGateDone || !loadingExitDone;
  const unavailable = !showLoading && (!data || !data.canOpen);

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
        available_tab_count: sharedRacebookModel ? countVisiblePrimaryTabs(sharedRacebookModel) : 0,
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
    }, [data?.canOpen, data?.race.id, onboarding, showLoading, sharedRacebookModel]),
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

  const openTrackedUrl = useCallback((url: string, action: string, context?: string) => {
    captureRacebookInteraction('racebook action clicked', {
      action,
      action_context: context ?? null,
    });
    Linking.openURL(url).catch(() => {});
  }, [captureRacebookInteraction]);

  const handleSharedInteraction = useCallback((interaction: RacebookInteraction) => {
    // Sponsor redirects intentionally remain outside person-level RaceBook analytics.
    if (interaction.action === 'sponsor') return;
    if (interaction.type === 'aid-station-opened') {
      captureRacebookInteraction('racebook aid station opened', { aid_station_id: interaction.context ?? null });
      return;
    }
    if (interaction.type === 'access-detail-opened') {
      captureRacebookInteraction('racebook access detail opened', { detail: interaction.context ?? null });
      return;
    }
    captureRacebookInteraction('racebook action clicked', {
      action: interaction.action ?? 'open_url',
      action_context: interaction.context ?? null,
    });
  }, [captureRacebookInteraction]);

  useEffect(() => {
    const tabsNavigation = navigation.getParent();
    navigation.setOptions({ headerRight: showLoading ? () => null : undefined });
    tabsNavigation?.setOptions({ tabBarStyle: showLoading ? { display: 'none' } : undefined });

    return () => {
      navigation.setOptions({ headerRight: undefined });
      tabsNavigation?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, showLoading]);

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
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, showLoading && { minHeight: Math.max(520, viewportHeight - 120) }]}
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
        <RacebookLoadingView
          key={id ?? 'missing-racebook'}
          progress={loadingProgress}
          sponsors={(sponsorSplashVisible ? sponsorPresentation.loadingSponsors : []).map((sponsor) => ({
            id: sponsor.id,
            name: sponsor.name,
            logoUrl: sponsor.logoUrl,
            websiteUrl: sponsor.clickUrl,
          }))}
          sponsorLabel={t.catalog.racebookSponsorsSupportedBy}
          loadingLabel={t.catalog.racebookLoading}
          title={t.catalog.racebookLoadingTitle}
          viewportHeight={viewportHeight}
          sponsorLookupDone={sponsorLookupDone}
          branding={brandTheme}
          logoEnabled={RACEBOOK_EDITION_LOGO_ENABLED && sponsorPresentation.modules.branding}
          renderIcon={(name, color, size) => (
            <Ionicons name={name as keyof typeof Ionicons.glyphMap} color={color} size={size} />
          )}
          openUrl={(url) => { Linking.openURL(url).catch(() => {}); }}
        />
      ) : unavailable ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="information-circle-outline" size={26} color={brandTheme.primaryColor} />
          </View>
          <Heading variant="h3" style={styles.unavailableTitle}>
            {t.catalog.racebookUnavailableTitle}
          </Heading>
          <Text style={styles.unavailableBody}>{t.catalog.racebookUnavailableBody}</Text>
          <Pressable style={[styles.backButton, { backgroundColor: brandTheme.primaryColor }]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: brandTheme.onPrimaryColor }]}>{t.common.back}</Text>
          </Pressable>
        </View>
      ) : data && sharedRacebookModel ? (
            <RacebookView
              model={sharedRacebookModel}
              locale={locale}
              activeTab={activeTab}
              activeCourseTab={activeCourseTab}
              onTabChange={handleTabPress}
              onCourseTabChange={handleCourseTabPress}
              onInteraction={handleSharedInteraction}
              adapters={{
                openUrl: (url) => { Linking.openURL(url).catch(() => {}); },
                renderIcon: (name, color, size) => (
                  <Ionicons name={name as keyof typeof Ionicons.glyphMap} color={color} size={size} />
                ),
                renderRouteMap: (points, color) => (
                  <RacebookLeafletMap
                    points={points.map((point, index) => ({
                      lat: point.latitude,
                      lng: point.longitude,
                      elevationM: null,
                      distanceKm: index,
                    }))}
                    routeColor={color}
                  />
                ),
                renderElevationProfile: (points, color) => (
                  <ProfileMiniChart points={points} accentColor={color} />
                ),
                typography: {
                  bodyFontFamily: 'Bricolage Grotesque',
                  boldFontFamily: 'BricolageGrotesque_700Bold',
                  dataFontFamily: 'JetBrains Mono',
                },
                reducedMotion,
              }}
            />
      ) : null}
      </ScrollView>
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
});

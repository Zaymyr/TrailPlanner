import Ionicons from '@expo/vector-icons/Ionicons';
import { resolveRacebookTheme } from '@pace-yourself/design-system';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Linking, RefreshControl, type ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RacebookAccessSection, type RacebookAccessTransport } from '../../../../components/racebook/RacebookAccessSection';
import {
  RACEBOOK_HERO_BODY_HEIGHT,
  RACEBOOK_HERO_COMPACT_BODY_HEIGHT,
  RacebookCollapsibleHero,
} from '../../../../components/racebook/RacebookCollapsibleHero';
import { RacebookServicesSection, type RacebookServicesCopy } from '../../../../components/racebook/RacebookServicesSection';
import { RacebookSupporterPointsSection, type RacebookSupporterStation } from '../../../../components/racebook/RacebookSupporterPointsSection';
import { RacebookTabBar } from '../../../../components/racebook/RacebookTabBar';
import { DataText } from '../../../../components/themed/DataText';
import { EmptyState } from '../../../../components/themed/EmptyState';
import { ErrorState } from '../../../../components/themed/ErrorState';
import { LoadingState } from '../../../../components/themed/LoadingState';
import { SectionHeading } from '../../../../components/themed/SectionHeading';
import { Text } from '../../../../components/themed/Text';
import { TopoCard } from '../../../../components/themed/TopoCard';
import { TrailTabs } from '../../../../components/themed/TrailTabs';
import { Colors } from '../../../../constants/colors';
import { formatDistance, formatDistanceRange, formatElevation } from '../../../../lib/displayFormat';
import { fetchWithTimeout } from '../../../../lib/fetchWithTimeout';
import { useI18n } from '../../../../lib/i18n';
import {
  buildGuideAccessPresentation,
  buildTelephoneUrl,
  countGuideDays,
  formatGuideClock,
  formatGuideDateRange,
  formatGuideDay,
  groupGuideTimelineByDay,
  hasFollowContent,
  resolveGuideTimeline,
  resolveVisibleGuideSections,
  toRacebookServiceItems,
  toRacebookSupporterPoints,
  type SupporterGuidePayload,
  type SupporterGuideSection,
  type SupporterGuideTimelineEntry,
} from '../../../../lib/supporterGuide';
import { WEB_API_BASE_URL } from '../../../../lib/webApi';

// The Supporter Guide uses the Pace Yourself theme (no organizer branding).
const GUIDE_THEME = resolveRacebookTheme(null);
const ALL_RACES = 'all';

const SECTION_ICONS: Record<SupporterGuideSection, keyof typeof Ionicons.glyphMap> = {
  programme: 'calendar',
  follow: 'people',
  onsite: 'location',
  stay: 'bed',
  practical: 'navigate',
};

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

export default function SupporterGuideScreen() {
  const { raceId, returnTo, eventId } = useLocalSearchParams<{ raceId: string; returnTo?: string; eventId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const { locale, t } = useI18n();
  const copy = t.supporterGuide;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const [guide, setGuide] = useState<SupporterGuidePayload | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<SupporterGuideSection>('programme');
  const [programmeRace, setProgrammeRace] = useState<string>(ALL_RACES);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(raceId ?? null);
  const [expandedTransport, setExpandedTransport] = useState<Record<RacebookAccessTransport['key'], boolean>>({ parking: false, shuttles: false });
  const [heroBodyHeight, setHeroBodyHeight] = useState<number | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!raceId) {
      setState('unavailable');
      return;
    }
    if (mode === 'initial') setState('loading');
    else setRefreshing(true);
    try {
      const response = await fetchWithTimeout(`${WEB_API_BASE_URL}/api/supporter-guide?raceId=${encodeURIComponent(raceId)}`);
      if (response.status === 404) {
        setState('unavailable');
        return;
      }
      if (!response.ok) throw new Error(`Supporter Guide request failed: ${response.status}`);
      setGuide(await response.json() as SupporterGuidePayload);
      setState('ready');
    } catch {
      if (mode === 'initial') setState('error');
    } finally {
      setRefreshing(false);
    }
  }, [raceId]);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const exit = useCallback(() => {
    if (returnTo === 'catalog' && eventId) {
      // Reopen the event sheet the guide was opened from.
      router.replace({ pathname: '/(app)/catalog', params: { eventId, sheet: String(Date.now()) } });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/catalog');
  }, [eventId, returnTo, router]);

  useFocusEffect(useCallback(() => {
    const tabsNavigation = navigation.getParent();
    tabsNavigation?.setOptions({ tabBarStyle: { display: 'none' } });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => {
      backSubscription.remove();
      tabsNavigation?.setOptions({ tabBarStyle: undefined });
    };
  }, [exit, navigation]));

  const timeline = useMemo(() => (guide ? resolveGuideTimeline(guide) : []), [guide]);
  const sections = useMemo(() => (guide ? resolveVisibleGuideSections(guide) : []), [guide]);
  const followFormats = useMemo(() => guide?.formats.filter(hasFollowContent) ?? [], [guide]);
  const practicalRaceIds = useMemo(() => new Set([
    ...(guide?.practical.access.map((item) => item.raceId) ?? []),
    ...(guide?.practical.thirdPartyBibPickup.map((item) => item.raceId) ?? []),
  ]), [guide]);
  const practicalFormats = useMemo(() => guide?.formats.filter((format) => practicalRaceIds.has(format.raceId)) ?? [], [guide, practicalRaceIds]);

  useEffect(() => {
    if (sections.length > 0 && !sections.includes(activeSection)) setActiveSection(sections[0]!);
  }, [activeSection, sections]);

  // One race at a time on Suivre / Pratique: the race the guide was opened from, else the first one.
  const raceChoices = activeSection === 'practical' ? practicalFormats : followFormats;
  const currentRaceId = raceChoices.some((format) => format.raceId === selectedRaceId)
    ? selectedRaceId
    : raceChoices[0]?.raceId ?? null;
  const currentFormat = guide?.formats.find((format) => format.raceId === currentRaceId) ?? null;

  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  ), [scrollY]);

  const selectSection = useCallback((section: SupporterGuideSection) => {
    setActiveSection(section);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.setValue(0);
  }, [scrollY]);

  const openUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  }, []);

  const emergencyUrl = guide?.practical.emergencyPhone ? buildTelephoneUrl(guide.practical.emergencyPhone) : null;
  const resolvedHeroBodyHeight = heroBodyHeight ?? (emergencyUrl ? RACEBOOK_HERO_BODY_HEIGHT + 44 : RACEBOOK_HERO_BODY_HEIGHT);
  const heroExpandedHeight = insets.top + resolvedHeroBodyHeight;

  if (state !== 'ready' || !guide) {
    return (
      <View style={[styles.screen, styles.stateScreen, { paddingTop: insets.top + 24 }]}>
        {state === 'loading' ? <LoadingState label={copy.loading} /> : null}
        {state === 'unavailable' ? (
          <EmptyState title={copy.unavailableTitle} description={copy.unavailableBody} actionLabel={t.common.back} onActionPress={exit} />
        ) : null}
        {state === 'error' ? (
          <ErrorState title={copy.loadingErrorTitle} description={copy.loadingErrorBody} retryLabel={t.common.retry} onRetry={() => { void load('initial'); }} />
        ) : null}
      </View>
    );
  }

  const distances = guide.formats.map((format) => format.distanceKm).filter((value) => value > 0);
  const days = countGuideDays(guide.edition.startDate, guide.edition.endDate);
  const firstStart = timeline.find((entry) => entry.kind === 'start') ?? null;
  const tabs = sections.map((section) => ({ key: section, label: sectionLabel(section, copy), icon: SECTION_ICONS[section] }));
  const servicesCopy: RacebookServicesCopy = {
    emptyMessage: t.catalog.racebookEmptyServices,
    directionsLabel: t.catalog.racebookAccessOpenMaps,
    websiteLabel: t.catalog.racebookServiceWebsite,
    callLabel: t.catalog.racebookCallAction,
    partnerLinksTitle: copy.stayPartnerTitle,
    affiliateDisclosure: t.catalog.racebookAffiliateDisclosure,
    partnerLinks: {
      booking: guide.lodgingPartner?.mode === 'partner' ? {
        title: guide.lodgingPartner.name,
        description: guide.lodgingPartner.headline ?? '',
        actionLabel: t.catalog.racebookSponsorDiscover,
      } : {
        title: t.catalog.racebookBookingTitle,
        description: copy.bookingDescription,
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
  };
  const lodgingLinks = guide.lodgingPartner?.clickUrl
    ? [{ partnerKey: 'booking' as const, url: guide.lodgingPartner.clickUrl, isAffiliate: guide.lodgingPartner.mode === 'affiliate' }]
    : [];

  // Wrapped like RaceBook › Course: a bare horizontal ScrollView would grow in the column.
  const raceTabs = (
    <View style={styles.tabsWrap}>
      <TrailTabs
        activeKey={currentRaceId ?? ''}
        onChange={setSelectedRaceId}
        scrollable
        stretch
        style={styles.tabsScroller}
        tabs={raceChoices.map((format) => ({ key: format.raceId, label: format.name }))}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <RacebookCollapsibleHero
        scrollY={scrollY}
        topInset={insets.top}
        expandedBodyHeight={resolvedHeroBodyHeight}
        eventName={copy.title}
        raceName={guide.edition.name}
        imageUrl={guide.edition.imageUrl}
        logoUrl={null}
        dateLabel={formatGuideDateRange(guide.edition.startDate, guide.edition.endDate, locale)}
        locationLabel={guide.edition.location}
        participationLabel={null}
        participationIcon="people-outline"
        startTimeLabel={copy.firstStart}
        startTimeValue={firstStart ? formatGuideClock({ date: firstStart.date, time: firstStart.time, dayOffset: days && days > 1 ? 1 : 0 }, null, locale) : null}
        maxTimeLabel=""
        maxTimeValue={null}
        distanceLabel=""
        distanceCaption=""
        elevationGainLabel=""
        elevationLossLabel={null}
        elevationCaption=""
        descentCaption=""
        showPlanMetrics={false}
        planDurationLabel={null}
        planDurationCaption=""
        planPaceLabel={null}
        planPaceCaption=""
        metricsOverride={[
          { label: copy.racesMetric, value: String(guide.formats.length) },
          ...(distances.length > 0 ? [{
            label: copy.distancesMetric,
            value: distances.length === 1
              ? formatDistance(distances[0]!, locale)
              : formatDistanceRange(Math.min(...distances), Math.max(...distances), locale),
          }] : []),
          ...(days ? [{ label: copy.daysMetric, value: String(days) }] : []),
        ]}
        backLabel={t.common.back}
        linksLabel={t.catalog.racebookOrganizerLinks}
        closeLabel={t.common.close}
        theme={GUIDE_THEME}
        socialLinks={guide.practical.links.map((link) => ({
          accessibilityLabel: link.kind === 'official' ? t.catalog.racebookOfficialWebsite : link.kind === 'instagram' ? 'Instagram' : 'Facebook',
          action: `${link.kind}_opened`,
          icon: link.kind === 'official' ? 'globe-outline' : link.kind === 'instagram' ? 'logo-instagram' : 'logo-facebook',
          url: link.url,
        }))}
        emergency={guide.practical.emergencyPhone && emergencyUrl ? {
          label: t.catalog.racebookEmergencyShort,
          name: null,
          phone: guide.practical.emergencyPhone,
          callLabel: t.catalog.racebookCallAction,
          accessibilityLabel: t.catalog.racebookCallEmergency,
        } : null}
        onBack={exit}
        onCallEmergency={emergencyUrl ? () => openUrl(emergencyUrl) : undefined}
        onOpenSocial={(url) => openUrl(url)}
        onExpandedBodyHeightChange={(height) => {
          if (!Number.isFinite(height) || height <= 0) return;
          setHeroBodyHeight((current) => (current !== null && Math.abs(current - height) < 1 ? current : height));
        }}
      />
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: heroExpandedHeight + 16,
            // A short section must still scroll far enough to fully collapse the hero.
            minHeight: viewportHeight + Math.max(0, resolvedHeroBodyHeight - RACEBOOK_HERO_COMPACT_BODY_HEIGHT),
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        alwaysBounceVertical
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void load('refresh'); }}
            progressViewOffset={heroExpandedHeight}
            tintColor={Colors.brandPrimary}
            colors={[Colors.brandPrimary]}
          />
        )}
      >
        {guide.organizerPreview ? (
          <TopoCard blazeTone="warning" variant="signature">
            <Text style={styles.previewText}>{locale === 'fr' ? 'Aperçu organisateur · contenu publié uniquement' : 'Organizer preview · published content only'}</Text>
          </TopoCard>
        ) : null}

        {activeSection === 'programme' ? (
          <ProgrammeSection
            timeline={timeline}
            formats={guide.formats}
            selectedRace={programmeRace}
            onSelectRace={setProgrammeRace}
            locale={locale}
            copy={copy}
          />
        ) : null}

        {activeSection === 'follow' ? (
          <>
            {raceTabs}
            {currentFormat && hasFollowContent(currentFormat) ? (
              <>
                <SectionHeading
                  title={currentFormat.name}
                  subtitle={[
                    formatDistance(currentFormat.distanceKm, locale),
                    typeof currentFormat.elevationGainM === 'number' ? `D+ ${formatElevation(currentFormat.elevationGainM, locale)}` : null,
                    currentFormat.startTime ? `${copy.kindStart} ${currentFormat.startTime}` : null,
                  ].filter(Boolean).join(' · ')}
                />
                <Text style={styles.sectionLead}>{copy.followSubtitle}</Text>
                <RacebookSupporterPointsSection
                  locale={locale}
                  points={toRacebookSupporterPoints(currentFormat.supporterPoints)}
                  stations={currentFormat.aidStations.map((station): RacebookSupporterStation => ({
                    id: station.id,
                    name: station.name,
                    km: station.km,
                    isFinish: station.isFinish === true,
                    supportersAccess: station.supportersAccess,
                    cutoffLabel: formatGuideClock(
                      station.cutoff ?? (station.cutoffTime ? { date: null, time: station.cutoffTime, dayOffset: 0 } : null),
                      currentFormat.date,
                      locale,
                    ),
                    maxStopMinutes: station.maxStopMinutes,
                    services: [
                      station.waterAvailable ? t.catalog.racebookAidWater : null,
                      station.solidAvailable ? t.catalog.racebookAidFood : null,
                      station.assistanceAllowed ? t.catalog.racebookAidAssistance : null,
                      ...station.amenities,
                    ].filter((value): value is string => Boolean(value)),
                  }))}
                  onOpenUrl={(url) => openUrl(url)}
                />
              </>
            ) : (
              <EmptyState title={copy.emptyFollow} />
            )}
          </>
        ) : null}

        {activeSection === 'onsite' ? (
          <RacebookServicesSection
            services={toRacebookServiceItems(guide.onSiteServices)}
            copy={servicesCopy}
            onOpenUrl={(url) => openUrl(url)}
            onOpenPartnerLink={(link) => openUrl(link.url)}
          />
        ) : null}

        {activeSection === 'stay' ? (
          <RacebookServicesSection
            services={toRacebookServiceItems(guide.stayServices)}
            partnerLinks={lodgingLinks}
            partnerLogoUrls={guide.lodgingPartner?.mode === 'partner' && guide.lodgingPartner.logoUrl ? { booking: guide.lodgingPartner.logoUrl } : undefined}
            copy={servicesCopy}
            onOpenUrl={(url) => openUrl(url)}
            onOpenPartnerLink={(link) => openUrl(link.url)}
          />
        ) : null}

        {activeSection === 'practical' ? (
          <>
            {raceTabs}
            {currentFormat ? (
              <>
                <RacebookAccessSection
                  presentation={buildGuideAccessPresentation(
                    guide.practical.access.find((item) => item.raceId === currentFormat.raceId),
                    {
                      sameLocation: t.catalog.racebookAccessSameLocation,
                      start: t.catalog.racebookFieldStartLocation,
                      finish: t.catalog.racebookFieldFinishLocation,
                      importantInfo: t.catalog.racebookAccessImportantInfo,
                      restrictions: t.catalog.racebookAccessRestrictions,
                      parking: t.catalog.racebookAccessParking,
                      shuttles: t.catalog.racebookAccessShuttles,
                    },
                  )}
                  expanded={expandedTransport}
                  onOpenUrl={openUrl}
                  onOpenMap={() => undefined}
                  onToggleTransport={(key) => setExpandedTransport((current) => ({ ...current, [key]: !current[key] }))}
                  copy={{
                    accessTitle: t.catalog.racebookTabAccess,
                    emptyMessage: copy.emptyPractical,
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
                {guide.practical.thirdPartyBibPickup
                  .filter((item) => item.raceId === currentFormat.raceId)
                  .map((item) => (
                    <TopoCard key={item.raceId} variant="signature">
                      <View style={styles.cardHeader}>
                        <Ionicons name="ticket-outline" size={18} color={Colors.brandPrimary} />
                        <Text style={styles.cardTitle}>{copy.thirdPartyBibTitle}</Text>
                      </View>
                      <Text style={styles.cardBody}>{item.conditions ?? copy.thirdPartyBibAllowed}</Text>
                    </TopoCard>
                  ))}
              </>
            ) : (
              <EmptyState title={copy.emptyPractical} />
            )}
          </>
        ) : null}
      </Animated.ScrollView>
      <RacebookTabBar tabs={tabs} activeTab={activeSection} onPress={selectSection} />
    </View>
  );
}

function sectionLabel(section: SupporterGuideSection, copy: ReturnType<typeof useI18n>['t']['supporterGuide']) {
  switch (section) {
    case 'programme': return copy.sectionProgramme;
    case 'follow': return copy.sectionFollow;
    case 'onsite': return copy.sectionOnSite;
    case 'stay': return copy.sectionStay;
    case 'practical': return copy.sectionPractical;
  }
}

function ProgrammeSection({
  timeline,
  formats,
  selectedRace,
  onSelectRace,
  locale,
  copy,
}: {
  timeline: SupporterGuideTimelineEntry[];
  formats: SupporterGuidePayload['formats'];
  selectedRace: string;
  onSelectRace: (raceId: string) => void;
  locale: 'fr' | 'en';
  copy: ReturnType<typeof useI18n>['t']['supporterGuide'];
}) {
  const days = groupGuideTimelineByDay(timeline, selectedRace === ALL_RACES ? null : selectedRace);
  const kindLabel = { start: copy.kindStart, finish_cutoff: copy.kindFinishCutoff, awards: copy.kindAwards } as const;
  const kindIcon = { start: 'flag-outline', finish_cutoff: 'time-outline', awards: 'trophy-outline' } as const;
  const showRaceName = selectedRace === ALL_RACES;

  return (
    <>
      {formats.length > 1 ? (
        <View style={styles.tabsWrap}>
          <TrailTabs
            activeKey={selectedRace}
            onChange={onSelectRace}
            scrollable
            stretch
            style={styles.tabsScroller}
            tabs={[{ key: ALL_RACES, label: copy.allRaces }, ...formats.map((format) => ({ key: format.raceId, label: format.name }))]}
          />
        </View>
      ) : null}
      {days.length === 0 ? <EmptyState title={copy.emptyProgramme} /> : null}
      {days.map((day) => (
        <View key={day.date ?? 'undated'} style={styles.day}>
          <SectionHeading title={formatGuideDay(day.date, locale) ?? copy.sectionProgramme} />
          <TopoCard>
            {day.entries.map((entry, index) => (
              <View key={entry.id} style={[styles.timelineRow, index > 0 ? styles.timelineRowBorder : null]}>
                <DataText style={styles.timelineTime}>{entry.time}</DataText>
                <View style={styles.timelineCopy}>
                  <View style={styles.timelineKind}>
                    <Ionicons name={kindIcon[entry.kind]} size={15} color={Colors.brandPrimary} />
                    <Text style={styles.timelineKindText}>{kindLabel[entry.kind]}{entry.label ? ` · ${entry.label}` : ''}</Text>
                  </View>
                  {showRaceName ? <Text style={styles.timelineRace}>{entry.raceName}</Text> : null}
                  {entry.location ? <Text style={styles.timelineMeta}>{entry.location}</Text> : null}
                </View>
              </View>
            ))}
          </TopoCard>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  stateScreen: { paddingHorizontal: 16, gap: 16 },
  container: { padding: 16, paddingBottom: 32, gap: 14, backgroundColor: Colors.background },
  tabsWrap: { alignSelf: 'stretch' },
  // A horizontal ScrollView grows by default; keep the trail at its own height on short sections.
  tabsScroller: { flexGrow: 0 },
  previewText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  sectionLead: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: -6 },
  day: { gap: 10 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10 },
  timelineRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  timelineTime: { width: 56, color: Colors.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  timelineCopy: { flex: 1, minWidth: 0, gap: 2 },
  timelineKind: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineKindText: { flexShrink: 1, color: Colors.brandPrimary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  timelineRace: { color: Colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  timelineMeta: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  cardBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
});

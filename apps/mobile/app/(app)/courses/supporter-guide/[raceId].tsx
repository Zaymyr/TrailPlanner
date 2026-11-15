import Ionicons from '@expo/vector-icons/Ionicons';
import { resolveRacebookTheme } from '@pace-yourself/design-system';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Animated, BackHandler, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RacebookAccessSection, type RacebookAccessTransport } from '../../../../components/racebook/RacebookAccessSection';
import {
  RACEBOOK_HERO_BODY_HEIGHT,
  RACEBOOK_HERO_COMPACT_BODY_HEIGHT,
  RacebookCollapsibleHero,
} from '../../../../components/racebook/RacebookCollapsibleHero';
import { RacebookServicesSection, type RacebookServicesCopy } from '../../../../components/racebook/RacebookServicesSection';
import { RacebookSupporterPointsSection, type RacebookSupporterStop } from '../../../../components/racebook/RacebookSupporterPointsSection';
import { RacebookTabBar } from '../../../../components/racebook/RacebookTabBar';
import { AccordionHeader } from '../../../../components/themed/AccordionHeader';
import { ActionButton } from '../../../../components/themed/ActionButton';
import { DataText } from '../../../../components/themed/DataText';
import { EmptyState } from '../../../../components/themed/EmptyState';
import { ErrorState } from '../../../../components/themed/ErrorState';
import { LoadingState } from '../../../../components/themed/LoadingState';
import { SectionHeading } from '../../../../components/themed/SectionHeading';
import { StatusPill } from '../../../../components/themed/StatusPill';
import { Text } from '../../../../components/themed/Text';
import { TopoCard } from '../../../../components/themed/TopoCard';
import { TrailTabs } from '../../../../components/themed/TrailTabs';
import { Colors } from '../../../../constants/colors';
import { formatDistance, formatDistanceRange, formatElevation } from '../../../../lib/displayFormat';
import { fetchWithTimeout } from '../../../../lib/fetchWithTimeout';
import { useI18n } from '../../../../lib/i18n';
import {
  availableGuideKinds,
  buildGuideAccessPresentation,
  buildTelephoneUrl,
  countGuideDays,
  filterGuideTimeline,
  formatClockNow,
  formatCountdown,
  formatGuideClock,
  formatGuideDateRange,
  formatGuideDay,
  groupGuideTimelineByDay,
  hasFollowContent,
  isStopClosed,
  localIsoDay,
  resolveDayLiveState,
  resolveGuideStops,
  resolveGuideTimeline,
  resolveVisibleGuideSections,
  toLocalDate,
  toRacebookServiceItems,
  type GuideTimelineKind,
  type SupporterGuidePayload,
  type SupporterGuideSection,
  type SupporterGuideTimelineEntry,
} from '../../../../lib/supporterGuide';
import {
  addReminders,
  ensureReminderPermission,
  loadReminderIds,
  removeReminder,
  syncReminders,
  type ReminderCopy,
} from '../../../../lib/supporterGuideReminders';
import { WEB_API_BASE_URL } from '../../../../lib/webApi';

// The Supporter Guide uses the Pace Yourself theme (no organizer branding).
const GUIDE_THEME = resolveRacebookTheme(null);
const followedStorageKey = (editionId: string) => `supporterGuide:followed:${editionId}`;

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
  const [timelineKind, setTimelineKind] = useState<GuideTimelineKind>('all');
  const [followedRaceIds, setFollowedRaceIds] = useState<Set<string> | null>(null);
  const [reminderIds, setReminderIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const scrollOffsetRef = useRef(0);
  const autoScrolledDayRef = useRef<string | null>(null);
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

  // Live clock for the race-day mode (minute precision is enough).
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => { scrollOffsetRef.current = value; });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  // "Je suis" selection, remembered per edition; defaults to every race.
  const editionId = guide?.edition.id ?? null;
  useEffect(() => {
    if (!guide) return;
    let cancelled = false;
    const known = new Set(guide.formats.map((format) => format.raceId));
    void AsyncStorage.getItem(followedStorageKey(guide.edition.id)).then((raw) => {
      if (cancelled) return;
      const stored = raw ? (JSON.parse(raw) as string[]).filter((id) => known.has(id)) : [];
      setFollowedRaceIds(new Set(stored.length > 0 ? stored : known));
    }).catch(() => { if (!cancelled) setFollowedRaceIds(known); });
    return () => { cancelled = true; };
  }, [guide]);

  const toggleFollowedRace = useCallback((targetRaceId: string) => {
    setFollowedRaceIds((current) => {
      const next = new Set(current ?? []);
      if (next.has(targetRaceId)) {
        if (next.size === 1) return current; // keep at least one race
        next.delete(targetRaceId);
      } else {
        next.add(targetRaceId);
      }
      if (editionId) void AsyncStorage.setItem(followedStorageKey(editionId), JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  }, [editionId]);

  const reminderCopy = useMemo<ReminderCopy>(() => {
    const kindText = { start: copy.kindStart, finish_cutoff: copy.kindFinishCutoff, awards: copy.kindAwards, arrival_estimate: copy.kindArrivalEstimate, animation: copy.kindAnimation } as const;
    return {
      title: (entry) => copy.reminderTitle.replace('{kind}', kindText[entry.kind]).replace('{race}', entry.eventWide ? entry.label ?? '' : entry.raceName),
      body: (entry) => copy.reminderBody.replace('{time}', entry.time),
    };
  }, [copy]);
  const reminderHref = raceId ? `/courses/supporter-guide/${raceId}` : '/(app)/catalog';

  // Re-time or drop reminders after a republication.
  useEffect(() => {
    if (!guide) return;
    void syncReminders(guide.edition.id, resolveGuideTimeline(guide), reminderHref, reminderCopy)
      .then(setReminderIds)
      .catch(() => { void loadReminderIds(guide.edition.id).then(setReminderIds); });
  }, [guide, reminderCopy, reminderHref]);

  const toggleReminder = useCallback(async (entry: SupporterGuideTimelineEntry) => {
    if (!editionId) return;
    if (reminderIds.has(entry.id)) {
      await removeReminder(editionId, entry.id);
      setReminderIds(await loadReminderIds(editionId));
      return;
    }
    if (!(await ensureReminderPermission())) {
      Alert.alert(copy.title, copy.reminderPermissionDenied);
      return;
    }
    await addReminders(editionId, [entry], reminderHref, reminderCopy);
    setReminderIds(await loadReminderIds(editionId));
  }, [copy, editionId, reminderCopy, reminderHref, reminderIds]);

  const remindMyRunners = useCallback(async (entries: SupporterGuideTimelineEntry[]) => {
    if (!editionId) return;
    if (!(await ensureReminderPermission())) {
      Alert.alert(copy.title, copy.reminderPermissionDenied);
      return;
    }
    const added = await addReminders(editionId, entries, reminderHref, reminderCopy);
    setReminderIds(await loadReminderIds(editionId));
    Alert.alert(copy.title, added > 0 ? copy.remindersAdded.replace('{count}', String(added)) : copy.remindersAllSet);
  }, [copy, editionId, reminderCopy, reminderHref]);

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

        {guide.formats.length > 1 && activeSection === 'programme' ? (
          <View style={styles.followedRow}>
            <Text style={styles.followedLabel}>{copy.iAmFollowing}</Text>
            <View style={styles.followedChecks}>
              {guide.formats.map((format) => {
                const checked = followedRaceIds?.has(format.raceId) ?? true;
                return (
                  <Pressable
                    key={format.raceId}
                    accessibilityLabel={format.name}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    hitSlop={6}
                    onPress={() => toggleFollowedRace(format.raceId)}
                    style={({ pressed }) => [styles.followedCheck, pressed && styles.roundActionPressed]}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? Colors.brandPrimary : Colors.textMuted} />
                    <DataText style={[styles.followedCheckText, !checked && styles.followedCheckTextOff]}>{`${Math.round(format.distanceKm)} km`}</DataText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeSection === 'programme' ? (
          <ProgrammeSection
            timeline={timeline}
            kind={timelineKind}
            onSelectKind={setTimelineKind}
            followedRaceIds={followedRaceIds}
            now={now}
            reminderIds={reminderIds}
            onToggleReminder={(entry) => { void toggleReminder(entry); }}
            onRemindMyRunners={(entries) => { void remindMyRunners(entries); }}
            onOpenUrl={openUrl}
            onNowMarkerLayout={(day, windowY) => {
              if (autoScrolledDayRef.current === day) return;
              autoScrolledDayRef.current = day;
              const target = scrollOffsetRef.current + windowY - (insets.top + RACEBOOK_HERO_COMPACT_BODY_HEIGHT + 96);
              if (target > 0) scrollRef.current?.scrollTo({ y: target, animated: true });
            }}
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
                  stops={resolveGuideStops(currentFormat).map((stop): RacebookSupporterStop => ({
                    ...stop,
                    cutoffLabel: formatGuideClock(stop.cutoff, currentFormat.date, locale),
                    closed: stop.endpoint === 'start' ? false : isStopClosed(stop, currentFormat.date, now),
                    startTimesLabel: stop.startTimes?.map((item) => (item.label ? `${item.label} ${item.time}` : item.time)).join(' · ') || null,
                    expectedMenLabel: formatGuideClock(stop.expectedArrivals?.men, currentFormat.date, locale),
                    expectedWomenLabel: formatGuideClock(stop.expectedArrivals?.women, currentFormat.date, locale),
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
  kind,
  onSelectKind,
  followedRaceIds,
  now,
  reminderIds,
  onToggleReminder,
  onRemindMyRunners,
  onOpenUrl,
  onNowMarkerLayout,
  locale,
  copy,
}: {
  timeline: SupporterGuideTimelineEntry[];
  kind: GuideTimelineKind;
  onSelectKind: (kind: GuideTimelineKind) => void;
  followedRaceIds: ReadonlySet<string> | null;
  now: Date;
  reminderIds: ReadonlySet<string>;
  onToggleReminder: (entry: SupporterGuideTimelineEntry) => void;
  onRemindMyRunners: (entries: SupporterGuideTimelineEntry[]) => void;
  onOpenUrl: (url: string) => void;
  onNowMarkerLayout: (day: string, windowY: number) => void;
  locale: 'fr' | 'en';
  copy: ReturnType<typeof useI18n>['t']['supporterGuide'];
}) {
  const followedTimeline = filterGuideTimeline(timeline, 'all', followedRaceIds);
  const kinds = availableGuideKinds(followedTimeline);
  const days = groupGuideTimelineByDay(filterGuideTimeline(followedTimeline, kind, null));
  const kindLabel = { start: copy.kindStart, finish_cutoff: copy.kindFinishCutoff, awards: copy.kindAwards, arrival_estimate: copy.kindArrivalEstimate, animation: copy.kindAnimation } as const;
  const kindIcon = { start: 'flag-outline', finish_cutoff: 'time-outline', awards: 'trophy-outline', arrival_estimate: 'stopwatch-outline', animation: 'musical-notes-outline' } as const;
  const entryDetail = (entry: SupporterGuideTimelineEntry) => {
    if (entry.kind === 'arrival_estimate') return entry.audience === 'women' ? copy.firstWoman : copy.firstMan;
    if (entry.eventWide) return null;
    return entry.label;
  };
  const showRaceName = !followedRaceIds || followedRaceIds.size > 1;
  const isLive = days.some((day) => day.date === localIsoDay(now));

  // "Me prévenir pour toutes les courses": every upcoming moment, whatever the « Je suis » selection.
  const remindable = timeline.filter((entry) => {
    const at = toLocalDate(entry.date, entry.time);
    return Boolean(at && at.getTime() - 30 * 60_000 > now.getTime());
  });
  const today = localIsoDay(now);
  const [openPastDays, setOpenPastDays] = useState<Set<string>>(new Set());
  const togglePastDay = (date: string) => setOpenPastDays((current) => {
    const next = new Set(current);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });
  const kindTabs: { key: GuideTimelineKind; label: string }[] = [
    { key: 'all', label: copy.typeAll },
    ...kinds.map((value) => ({
      key: value as GuideTimelineKind,
      label: value === 'start' ? copy.typeStarts : value === 'arrival' ? copy.typeArrivals : value === 'awards' ? copy.typeAwards : copy.typeAnimations,
    })),
  ];

  return (
    <>
      {kindTabs.length > 2 ? (
        <View style={styles.tabsWrap}>
          <TrailTabs activeKey={kind} onChange={onSelectKind} scrollable stretch style={styles.tabsScroller} tabs={kindTabs} />
        </View>
      ) : null}
      {isLive ? (
        <View style={styles.liveRow}>
          <StatusPill label={copy.live} tone="success" />
          <DataText style={styles.liveClock}>{formatClockNow(now)}</DataText>
        </View>
      ) : null}
      {remindable.length > 0 ? (
        <ActionButton
          leading={<Ionicons name="notifications-outline" size={16} color={Colors.brandPrimary} />}
          onPress={() => onRemindMyRunners(remindable)}
          size="sm"
          variant="secondary"
        >
          {copy.remindMyRunners}
        </ActionButton>
      ) : null}
      {days.length === 0 ? <EmptyState title={timeline.length === 0 ? copy.emptyProgramme : copy.emptyFiltered} /> : null}
      {days.map((day) => {
        const live = resolveDayLiveState(day.entries, day.date, now);
        const dayPast = Boolean(day.date && day.date < today);
        const dayLabel = formatGuideDay(day.date, locale) ?? copy.sectionProgramme;
        if (dayPast && !openPastDays.has(day.date!)) {
          return (
            <View key={day.date ?? 'undated'} style={[styles.day, styles.pastDay]}>
              <AccordionHeader
                count={day.entries.length}
                expanded={false}
                onToggle={() => togglePastDay(day.date!)}
                subtitle={copy.dayDone}
                title={dayLabel}
              />
            </View>
          );
        }
        return (
          <View key={day.date ?? 'undated'} style={styles.day}>
            {dayPast ? (
              <AccordionHeader
                count={day.entries.length}
                expanded
                onToggle={() => togglePastDay(day.date!)}
                subtitle={copy.dayDone}
                title={dayLabel}
              />
            ) : (
              <SectionHeading title={dayLabel} />
            )}
            <TopoCard style={dayPast ? styles.pastDay : undefined}>
              {day.entries.map((entry, index) => {
                const status = dayPast ? 'past' : live?.statusById[entry.id] ?? null;
                const at = toLocalDate(entry.date, entry.time);
                const reminderOn = reminderIds.has(entry.id);
                const canRemind = Boolean(at && at.getTime() - 30 * 60_000 > now.getTime());
                return (
                  <View key={entry.id}>
                    {live && live.nowIndex === index ? (
                      <View
                        collapsable={false}
                        onLayout={(event) => {
                          const target = event.currentTarget as unknown as { measureInWindow?: (callback: (x: number, y: number) => void) => void };
                          target.measureInWindow?.((_x, y) => onNowMarkerLayout(day.date ?? '', y));
                        }}
                        style={styles.nowMarker}
                      >
                        <View style={styles.nowLine} />
                        <Text style={styles.nowText}>{`${formatClockNow(now)} · ${copy.nowLabel}`}</Text>
                        <View style={styles.nowLine} />
                      </View>
                    ) : null}
                    <View style={[styles.timelineRow, index > 0 ? styles.timelineRowBorder : null, status === 'past' && styles.pastRow]}>
                      <DataText style={styles.timelineTime}>{entry.time}</DataText>
                      <View style={styles.timelineCopy}>
                        <View style={styles.timelineKind}>
                          <Ionicons name={status === 'past' ? 'checkmark-circle' : kindIcon[entry.kind]} size={15} color={Colors.brandPrimary} />
                          <Text style={styles.timelineKindText}>{kindLabel[entry.kind]}{entryDetail(entry) ? ` · ${entryDetail(entry)}` : ''}{entry.endTime ? ` → ${entry.endTime}` : ''}</Text>
                        </View>
                        {entry.eventWide ? <Text style={styles.timelineRace}>{entry.label}</Text> : showRaceName ? <Text style={styles.timelineRace}>{entry.raceName}</Text> : null}
                        {entry.location ? <Text style={styles.timelineMeta}>{entry.location}</Text> : null}
                        {status === 'next' && at ? <StatusPill label={formatCountdown(at, now, locale)} tone="brand" style={styles.countdown} /> : null}
                      </View>
                      <View style={styles.rowActions}>
                        {entry.kind === 'start' && entry.mapsUrl && status !== 'past' ? (
                          <Pressable
                            accessibilityLabel={`${copy.directions} - ${entry.raceName}`}
                            accessibilityRole="link"
                            onPress={() => onOpenUrl(entry.mapsUrl!)}
                            style={({ pressed }) => [styles.roundAction, styles.roundActionSolid, pressed && styles.roundActionPressed]}
                          >
                            <Ionicons name="navigate-outline" size={18} color={Colors.textOnBrand} />
                          </Pressable>
                        ) : null}
                        {canRemind || reminderOn ? (
                          <Pressable
                            accessibilityLabel={reminderOn ? copy.reminderOn : copy.remindMe}
                            accessibilityRole="switch"
                            accessibilityState={{ checked: reminderOn }}
                            onPress={() => onToggleReminder(entry)}
                            style={({ pressed }) => [styles.roundAction, reminderOn && styles.roundActionSolid, pressed && styles.roundActionPressed]}
                          >
                            <Ionicons name={reminderOn ? 'notifications' : 'notifications-outline'} size={18} color={reminderOn ? Colors.textOnBrand : Colors.brandPrimary} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </TopoCard>
          </View>
        );
      })}
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
  followedRow: { gap: 6 },
  followedLabel: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  followedChecks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  followedCheck: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  followedCheckText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  followedCheckTextOff: { color: Colors.textMuted },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveClock: { color: Colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  pastRow: { opacity: 0.45 },
  pastDay: { opacity: 0.6 },
  countdown: { alignSelf: 'flex-start', marginTop: 4 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roundAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.surface },
  roundActionSolid: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimary },
  roundActionPressed: { opacity: 0.64 },
  nowMarker: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  nowLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: Colors.warning },
  nowText: { color: Colors.warning, fontSize: 12, lineHeight: 16, fontWeight: '800' },
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

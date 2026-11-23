import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FollowedRacesSection } from '../../components/plans/FollowedRacesSection';
import { PlansList } from '../../components/plans/PlansList';
import { FollowedPlansList } from '../../components/plans/FollowedPlansList';
import { Colors } from '../../constants/colors';
import {
  ROOT_HEADER_COMPACT_BODY_HEIGHT,
  ROOT_HEADER_EXPANDED_BODY_HEIGHT,
  RootCollapsibleHeader,
} from '../../components/navigation/RootCollapsibleHeader';
import { RootScreenActionMenu } from '../../components/navigation/RootScreenActionMenu';
import { Button } from '../../components/themed/Button';
import { Card } from '../../components/themed/Card';
import { ErrorState } from '../../components/themed/ErrorState';
import { LoadingState } from '../../components/themed/LoadingState';
import { Screen } from '../../components/themed/Screen';
import { Text } from '../../components/themed/Text';
import { TrailTabs } from '../../components/themed/TrailTabs';
import { TapeAlertBanner } from '../../components/racebook/TapeAlertBanner';
import { formatOfflineSavedAt } from '../../lib/offlineCacheFormat';
import { useFollowedRaces } from '../../hooks/useFollowedRaces';
import { usePlansScreen } from '../../hooks/usePlansScreen';

/**
 * "Mes courses": upcoming followed races first (RaceBook-led), then the
 * optional personal plans grouped by event. The route stays `plans`.
 */
export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const followedEvents = useFollowedRaces();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeList, setActiveList] = useState<'owned' | 'following'>('owned');
  const [selectorHeight, setSelectorHeight] = useState(60);
  useFocusEffect(useCallback(() => {
    scrollY.stopAnimation();
    scrollY.setValue(0);
  }, [scrollY]));
  const {
    locale,
    t,
    loading,
    error,
    offlineSavedAt,
    refreshing,
    sections,
    collapsedSections,
    activePlanId,
    sharingPlanId,
    isAnonymous,
    handleRetry,
    handleRefresh,
    handleDelete,
    toggleSection,
    handleBrowseRaces,
    handleOpenGuestAccountUpgrade,
    handleOpenEditPlan,
    handleRenamePlan,
    handleOpenRacePlan,
    handleOpenPlanSummary,
    handleSharePlan,
  } = usePlansScreen();
  // Events that already carry a plan are listed in their plan section instead.
  const { followedEventsWithoutPlan, pastFollowedEventsWithoutPlan } = useMemo(() => {
    const plannedEventIds = new Set(
      sections.flatMap((section) => section.data.map((plan) => plan.races?.race_events?.id).filter(Boolean)),
    );
    return {
      followedEventsWithoutPlan: followedEvents.upcoming.filter((event) => !plannedEventIds.has(event.id)),
      pastFollowedEventsWithoutPlan: followedEvents.past.filter((event) => !plannedEventIds.has(event.id)),
    };
  }, [followedEvents, sections]);
  const hasFollowedRaces = followedEventsWithoutPlan.length > 0;
  const handleOpenFollowedEvent = useCallback((eventId: string) => {
    router.push({ pathname: '/(app)/catalog', params: { eventId } });
  }, [router]);
  const handleOpenRacebook = useCallback((raceId: string) => {
    router.push({ pathname: '/(app)/race/[id]/racebook', params: { id: raceId, returnTo: 'plans' } });
  }, [router]);
  const rootHelpAction = (
    <RootScreenActionMenu
      contextLabel={t.plans.title}
      help={{
        type: 'message',
        title: t.rootActionMenu.plansHelpTitle,
        body: t.rootActionMenu.plansHelpBody,
      }}
      topInset={insets.top}
    />
  );
  // The tabs follow the header while it contracts (76 → 60 pt) and reach up
  // behind its rounded lower corners, so no gap lets the list show through.
  const selectorTop = scrollY.interpolate({
    inputRange: [0, ROOT_HEADER_EXPANDED_BODY_HEIGHT - ROOT_HEADER_COMPACT_BODY_HEIGHT],
    outputRange: [
      insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT - SELECTOR_HEADER_OVERLAP,
      insets.top + ROOT_HEADER_COMPACT_BODY_HEIGHT - SELECTOR_HEADER_OVERLAP,
    ],
    extrapolate: 'clamp',
  });
  // Same in-page tabs as RaceBook › Course (TrailTabs planks); the list starts right below them.
  const listSelector = (
    <Animated.View
      onLayout={(event) => {
        const height = Math.round(event.nativeEvent.layout.height);
        setSelectorHeight((current) => (current === height ? current : height));
      }}
      style={[styles.selector, { top: selectorTop }]}
    >
      <TrailTabs
        activeKey={activeList}
        onChange={(value) => { setActiveList(value); scrollY.setValue(0); }}
        stretch
        tabs={[
          { key: 'owned' as const, label: t.planFollow.myPlansTab },
          { key: 'following' as const, label: t.planFollow.assistantTab },
        ]}
      />
    </Animated.View>
  );
  const listTopInset = insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT + Math.max(0, selectorHeight - SELECTOR_HEADER_OVERLAP);
  if (loading) {
    return (
      <Screen style={styles.screen}>
        <LoadingState
          label={t.planLoading.listTitle}
          style={[styles.screen, { paddingTop: insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT }]}
        />
        <RootCollapsibleHeader
          helpAction={rootHelpAction}
          icon="map-outline"
          scrollY={scrollY}
          title={t.plans.title}
          topInset={insets.top}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.screen}>
        <ErrorState
          title={t.common.error}
          retryLabel={t.common.retry}
          onRetry={handleRetry}
          style={[styles.screen, { paddingTop: insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT }]}
        />
        <RootCollapsibleHeader
          helpAction={rootHelpAction}
          icon="map-outline"
          scrollY={scrollY}
          title={t.plans.title}
          topInset={insets.top}
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      {activeList === 'following' ? (
        <FollowedPlansList
          contentTopInset={listTopInset}
          onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
          t={t}
        />
      ) : <PlansList
        contentTopInset={listTopInset}
        activePlanId={activePlanId}
        collapsedSections={collapsedSections}
        browseRacesLabel={t.plans.browseRaces}
        departureCountdownCopy={{
          notSet: t.plans.departureNotSet,
          passed: t.plans.departurePassed,
          inDays: (days) => t.plans.departureInDays.replace('{days}', String(days)),
          inHoursAndMinutes: (hours, minutes) => t.plans.departureInHoursAndMinutes
            .replace('{hours}', String(hours))
            .replace('{minutes}', String(minutes).padStart(2, '0')),
          inMinutesAndSeconds: (minutes, seconds) => t.plans.departureInMinutesAndSeconds
            .replace('{minutes}', String(minutes).padStart(2, '0'))
            .replace('{seconds}', String(seconds).padStart(2, '0')),
        }}
        departureLabel={t.plans.departureLabel}
        emptySubtitle={hasFollowedRaces ? t.plans.emptyPlansOptionalSubtitle : t.plans.emptySubtitle}
        emptyTitle={hasFollowedRaces ? t.plans.emptyPlansOptionalTitle : t.plans.empty}
        inProgressLabel={t.plans.inProgress}
        liveLabel={t.plans.live}
        locale={locale}
        noRaceWarningLabel={t.plans.noRaceWarning}
        onBrowseRaces={handleBrowseRaces}
        onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
        onDeletePlan={handleDelete}
        onRenamePlan={handleRenamePlan}
        onOpenEditPlan={handleOpenEditPlan}
        onOpenRacePlan={handleOpenRacePlan}
        onOpenSummary={handleOpenPlanSummary}
        onSharePlan={handleSharePlan}
        onRefresh={handleRefresh}
        onToggleSection={toggleSection}
        refreshing={refreshing}
        sharingPlanId={sharingPlanId}
        sections={sections}
        onOpenRacebook={handleOpenRacebook}
        racebookButtonLabel={t.catalog.racebookCta}
        listHeaderComponent={
          <>
            {offlineSavedAt ? (
              <TapeAlertBanner
                icon="cloud-offline-outline"
                message={t.common.offlineCopy.replace('{time}', formatOfflineSavedAt(offlineSavedAt, locale))}
                title={t.common.offlineTitle}
                variationKey="plans-offline"
              />
            ) : null}
            <FollowedRacesSection
              events={followedEventsWithoutPlan}
              locale={locale}
              title={t.plans.followedTitle}
              subtitle={t.plans.followedSubtitle}
              racebookLabel={t.catalog.racebookCta}
              noRacebookLabel={t.catalog.viewFormats}
              onOpenEvent={handleOpenFollowedEvent}
            />

            {isAnonymous ? (
              <Card surface="cream" style={styles.guestBanner}>
                <View style={styles.guestBannerCopy}>
                  <Text tone="brand" size="base" weight="bold">
                    {t.plans.guestModeBannerTitle}
                  </Text>
                  <Text tone="secondary" size="sm" lineHeight="normal">
                    {t.plans.guestModeBannerBody}
                  </Text>
                </View>
                <Button onPress={handleOpenGuestAccountUpgrade} style={styles.guestBannerButton}>
                  {t.plans.guestModeBannerCta}
                </Button>
              </Card>
            ) : null}
          </>
        }
        listFooterComponent={pastFollowedEventsWithoutPlan.length > 0 ? (
          <FollowedRacesSection
            events={pastFollowedEventsWithoutPlan}
            locale={locale}
            title={t.plans.pastRaces}
            subtitle={t.plans.followedPastSubtitle}
            racebookLabel={t.catalog.racebookCta}
            noRacebookLabel={t.catalog.viewFormats}
            onOpenEvent={handleOpenFollowedEvent}
          />
        ) : undefined}
        startButtonLabel={t.plans.startButton}
        editButtonLabel={t.plans.editButton}
        recapButtonLabel={t.planSummary.openRecap}
        shareButtonLabel={t.planSummary.share}
        saveButtonLabel={t.common.save}
        savingLabel={t.common.saving}
        deleteButtonLabel={t.common.delete}
      />}

      <RootCollapsibleHeader
        helpAction={rootHelpAction}
        icon="map-outline"
        scrollY={scrollY}
        title={t.plans.title}
        topInset={insets.top}
      />
      {listSelector}

    </Screen>
  );
}

/** Matches the root header's 22 pt lower radius: the selector background fills behind the corners. */
const SELECTOR_HEADER_OVERLAP = 22;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  guestBanner: {
    gap: 14,
  },
  guestBannerCopy: {
    gap: 6,
  },
  guestBannerButton: {
    alignSelf: 'flex-start',
  },
  selector: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 12,
    paddingHorizontal: 16,
    paddingTop: 8 + SELECTOR_HEADER_OVERLAP,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
});

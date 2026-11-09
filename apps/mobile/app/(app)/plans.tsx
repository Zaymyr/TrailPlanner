import { useCallback, useMemo, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FollowedRacesSection } from '../../components/plans/FollowedRacesSection';
import { PlansList } from '../../components/plans/PlansList';
import {
  ROOT_HEADER_EXPANDED_BODY_HEIGHT,
  RootCollapsibleHeader,
} from '../../components/navigation/RootCollapsibleHeader';
import { RootScreenActionMenu } from '../../components/navigation/RootScreenActionMenu';
import { PremiumUpsellModal } from '../../components/premium/PremiumUpsellModal';
import { Button } from '../../components/themed/Button';
import { Card } from '../../components/themed/Card';
import { ErrorState } from '../../components/themed/ErrorState';
import { LoadingState } from '../../components/themed/LoadingState';
import { Screen } from '../../components/themed/Screen';
import { Text } from '../../components/themed/Text';
import { useFollowedRaces } from '../../hooks/useFollowedRaces';
import { usePlansScreen } from '../../hooks/usePlansScreen';
import { FREE_PLAN_LIMIT } from '../../lib/planAccess';

/**
 * "Mes courses": upcoming followed races first (RaceBook-led), then the
 * optional personal plans grouped by event. The route stays `plans`.
 */
export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const followedEvents = useFollowedRaces();
  const scrollY = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    scrollY.stopAnimation();
    scrollY.setValue(0);
  }, [scrollY]));
  const {
    locale,
    t,
    isPremium,
    loading,
    premiumLoading,
    error,
    refreshing,
    sections,
    collapsedSections,
    activePlanId,
    sharingPlanId,
    isAnonymous,
    accessiblePlanIds,
    premiumModalCopy,
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
    handleOpenLockedPlan,
    closePremiumModal,
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
  if (loading || premiumLoading) {
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
      <PlansList
        contentTopInset={insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT}
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
        isPremium={isPremium}
        accessiblePlanIds={accessiblePlanIds}
        liveLabel={t.plans.live}
        locale={locale}
        noRaceWarningLabel={t.plans.noRaceWarning}
        onBrowseRaces={handleBrowseRaces}
        onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
        onDeletePlan={handleDelete}
        onRenamePlan={handleRenamePlan}
        onOpenEditPlan={handleOpenEditPlan}
        onOpenLockedPlan={handleOpenLockedPlan}
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
      />

      <RootCollapsibleHeader
        helpAction={rootHelpAction}
        icon="map-outline"
        scrollY={scrollY}
        title={t.plans.title}
        topInset={insets.top}
      />

      <PremiumUpsellModal
        message={premiumModalCopy?.message ?? t.plans.freeAccessMessage.replace('{count}', String(FREE_PLAN_LIMIT))}
        onClose={closePremiumModal}
        placement="plan_limit"
        title={premiumModalCopy?.title ?? t.plans.freeAccessTitle}
        visible={premiumModalCopy !== null}
      />
    </Screen>
  );
}

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
});

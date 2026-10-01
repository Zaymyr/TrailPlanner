import { useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@pace-yourself/design-system';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlansList } from '../../components/plans/PlansList';
import {
  ROOT_HEADER_EXPANDED_BODY_HEIGHT,
  RootCollapsibleHeader,
} from '../../components/navigation/RootCollapsibleHeader';
import { PremiumUpsellModal } from '../../components/premium/PremiumUpsellModal';
import { Button } from '../../components/themed/Button';
import { Card } from '../../components/themed/Card';
import { ErrorState } from '../../components/themed/ErrorState';
import { LoadingState } from '../../components/themed/LoadingState';
import { Screen } from '../../components/themed/Screen';
import { Text } from '../../components/themed/Text';
import { usePlansScreen } from '../../hooks/usePlansScreen';
import { FREE_PLAN_LIMIT } from '../../lib/planAccess';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
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
    handleStartFreeTraining,
    handleOpenGuestAccountUpgrade,
    handleOpenEditPlan,
    handleRenamePlan,
    handleOpenRacePlan,
    handleOpenPlanSummary,
    handleSharePlan,
    handleOpenLockedPlan,
    closePremiumModal,
  } = usePlansScreen();
  if (loading || premiumLoading) {
    return (
      <Screen style={styles.screen}>
        <LoadingState
          label={t.planLoading.listTitle}
          style={[styles.screen, { paddingTop: insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT }]}
        />
        <RootCollapsibleHeader
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
        emptySubtitle={t.plans.emptySubtitle}
        emptyTitle={t.plans.empty}
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
        listHeaderComponent={
          <>
            <TouchableOpacity activeOpacity={0.86} onPress={handleStartFreeTraining} style={styles.trainingCta}>
              <View style={styles.trainingCtaIcon}>
                <Ionicons color={colors.text.inverse} name="walk-outline" size={20} />
              </View>
              <View style={styles.trainingCtaCopy}>
                <Text tone="brand" size="base" weight="bold">
                  {t.trainingLive.menuLabel}
                </Text>
                <Text tone="secondary" size="sm" lineHeight="normal">
                  {t.trainingLive.introTitle}
                </Text>
              </View>
              <Ionicons color={colors.brand.forest} name="chevron-forward" size={20} />
            </TouchableOpacity>

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
        startButtonLabel={t.plans.startButton}
        recapButtonLabel={t.planSummary.openRecap}
        shareButtonLabel={t.planSummary.share}
        saveButtonLabel={t.common.save}
        savingLabel={t.common.saving}
        deleteButtonLabel={t.common.delete}
      />

      <RootCollapsibleHeader
        action={{
          accessibilityLabel: t.trainingLive.menuLabel,
          icon: 'walk-outline',
          onPress: handleStartFreeTraining,
        }}
        icon="map-outline"
        scrollY={scrollY}
        title={t.plans.title}
        topInset={insets.top}
      />

      <PremiumUpsellModal
        message={premiumModalCopy?.message ?? t.plans.freeAccessMessage.replace('{count}', String(FREE_PLAN_LIMIT))}
        onClose={closePremiumModal}
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
  trainingCta: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.brand,
    backgroundColor: colors.surface.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trainingCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.forest,
  },
  trainingCtaCopy: {
    flex: 1,
    gap: 3,
  },
  guestBannerCopy: {
    gap: 6,
  },
  guestBannerButton: {
    alignSelf: 'flex-start',
  },
});

import { colors } from '@pace-yourself/design-system';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PlansList } from '../../components/plans/PlansList';
import { PremiumUpsellModal } from '../../components/premium/PremiumUpsellModal';
import { Button } from '../../components/themed/Button';
import { Card } from '../../components/themed/Card';
import { Screen } from '../../components/themed/Screen';
import { Text } from '../../components/themed/Text';
import { usePlansScreen } from '../../hooks/usePlansScreen';
import { FREE_PLAN_LIMIT } from '../../lib/planAccess';

export default function PlansScreen() {
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
    isAnonymous,
    accessiblePlanIds,
    premiumModalCopy,
    handleRetry,
    handleRefresh,
    handleDelete,
    toggleSection,
    handleCreateFirstPlan,
    handleOpenGuestAccountUpgrade,
    handleEditRace,
    handleOpenCatalog,
    handleOpenEditPlan,
    handleOpenRacePlan,
    handleOpenLockedPlan,
    closePremiumModal,
  } = usePlansScreen();

  if (loading || premiumLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.brand.forest} size="large" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.center}>
        <Text tone="brand" size="base" weight="semibold" style={styles.errorText}>
          {error}
        </Text>
        <Button onPress={handleRetry} variant="secondary">
          {t.common.retry}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
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

      <PlansList
        activePlanId={activePlanId}
        collapsedSections={collapsedSections}
        createFirstLabel={t.plans.createFirst}
        editRaceLabel={t.races.editRace}
        emptySubtitle={t.plans.emptySubtitle}
        emptyTitle={t.plans.empty}
        inProgressLabel={t.plans.inProgress}
        isPremium={isPremium}
        accessiblePlanIds={accessiblePlanIds}
        liveLabel={t.plans.live}
        locale={locale}
        noRaceWarningLabel={t.plans.noRaceWarning}
        onCreateFirstPlan={handleCreateFirstPlan}
        onDeletePlan={handleDelete}
        onEditRace={handleEditRace}
        onOpenCatalog={handleOpenCatalog}
        onOpenEditPlan={handleOpenEditPlan}
        onOpenLockedPlan={handleOpenLockedPlan}
        onOpenRacePlan={handleOpenRacePlan}
        onRefresh={handleRefresh}
        onToggleSection={toggleSection}
        refreshing={refreshing}
        sections={sections}
        startButtonLabel={t.plans.startButton}
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
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    gap: 14,
  },
  guestBannerCopy: {
    gap: 6,
  },
  guestBannerButton: {
    alignSelf: 'flex-start',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 16,
  },
});

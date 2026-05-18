import { useMemo } from 'react';
import { colors } from '@pace-yourself/design-system';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootScreenActionMenu } from '../../components/navigation/RootScreenActionMenu';
import { PlansList } from '../../components/plans/PlansList';
import { PremiumUpsellModal } from '../../components/premium/PremiumUpsellModal';
import { Button } from '../../components/themed/Button';
import { Card } from '../../components/themed/Card';
import { Screen } from '../../components/themed/Screen';
import { Text } from '../../components/themed/Text';
import { usePlansScreen } from '../../hooks/usePlansScreen';
import { FREE_PLAN_LIMIT } from '../../lib/planAccess';
import type { FloatingActionMenuItem } from '../../components/navigation/FloatingActionMenu';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
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
    handleOpenEditPlan,
    handleOpenRacePlan,
    handleOpenLockedPlan,
    closePremiumModal,
  } = usePlansScreen();
  const screenStyle = useMemo(
    () => [
      styles.screen,
      {
        paddingTop: Math.max(0, insets.top),
      },
    ],
    [insets.top],
  );
  const actionItems = useMemo<FloatingActionMenuItem[]>(
    () => [
      {
        key: 'new-plan',
        label: t.plans.newPlan,
        icon: 'add-circle-outline',
        onPress: handleCreateFirstPlan,
      },
    ],
    [handleCreateFirstPlan, t.plans.newPlan],
  );
  const helpCopy = useMemo(
    () =>
      locale === 'fr'
        ? {
            title: t.plans.title,
            body: "Retrouve tes plans par course, relance un plan en cours, ou cr\u00e9e un nouveau plan depuis le menu. Les ic\u00f4nes de carte ouvrent l'\u00e9dition, le live ou les actions de suppression.",
          }
        : {
            title: t.plans.title,
            body: 'Find your plans grouped by race, resume an active plan, or create a new plan from the menu. The card icons open editing, live mode, or delete actions.',
          },
    [locale, t.plans.title],
  );

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
    <Screen style={screenStyle}>
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

      <RootScreenActionMenu
        actions={actionItems}
        contextLabel={t.plans.title}
        help={{ type: 'message', title: helpCopy.title, body: helpCopy.body }}
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

import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@pace-yourself/design-system';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootScreenActionMenu } from '../../components/navigation/RootScreenActionMenu';
import { PlanLoadingScreen } from '../../components/PlanLoadingScreen';
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
    sharingPlanId,
    isAnonymous,
    accessiblePlanIds,
    premiumModalCopy,
    handleRetry,
    handleRefresh,
    handleDelete,
    toggleSection,
    handleCreateFirstPlan,
    handleStartFreeTraining,
    handleOpenGuestAccountUpgrade,
    handleEditRace,
    handleOpenEditPlan,
    handleRenamePlan,
    handleOpenRacePlan,
    handleOpenPlanSummary,
    handleSharePlan,
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
            body: "Retrouve tes plans par course avec leur temps prévu et le compte à rebours avant le départ. Touche une carte pour l'ouvrir et maintiens-la appuyée pour modifier son nom ou la supprimer. À droite, les icônes ouvrent le récapitulatif, partagent directement le plan et lancent le live.",
          }
        : {
            title: t.plans.title,
            body: 'Find plans grouped by race with their expected time and start countdown. Tap a card to open it and hold it to edit its name or delete it. The icons on the right open the recap, share the plan directly, and start live mode.',
          },
    [locale, t.plans.title],
  );

  if (loading || premiumLoading) {
    return <PlanLoadingScreen progress={0.2} variant="list" />;
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
        onRenamePlan={handleRenamePlan}
        onEditRace={handleEditRace}
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
        startButtonLabel={t.plans.startButton}
        recapButtonLabel={t.planSummary.openRecap}
        shareButtonLabel={t.planSummary.share}
        saveButtonLabel={t.common.save}
        savingLabel={t.common.saving}
        deleteButtonLabel={t.common.delete}
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
  trainingCta: {
    minHeight: 58,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
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

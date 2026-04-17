import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PlansList } from '../../components/plans/PlansList';
import { PremiumUpsellModal } from '../../components/premium/PremiumUpsellModal';
import { Colors } from '../../constants/colors';
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
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{t.common.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {isAnonymous ? (
        <View style={styles.guestBanner}>
          <View style={styles.guestBannerCopy}>
            <Text style={styles.guestBannerTitle}>{t.plans.guestModeBannerTitle}</Text>
            <Text style={styles.guestBannerBody}>{t.plans.guestModeBannerBody}</Text>
          </View>
          <TouchableOpacity onPress={handleOpenGuestAccountUpgrade} style={styles.guestBannerButton}>
            <Text style={styles.guestBannerButtonText}>{t.plans.guestModeBannerCta}</Text>
          </TouchableOpacity>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  guestBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    gap: 14,
  },
  guestBannerCopy: {
    gap: 6,
  },
  guestBannerTitle: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  guestBannerBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  guestBannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  guestBannerButtonText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
  },
});

import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { SpotlightTutorial, TutorialTarget } from '../../components/help/SpotlightTutorial';
import { ProfileAccountSection } from '../../components/profile/ProfileAccountSection';
import { ProfileChangelogModal } from '../../components/profile/ProfileChangelogModal';
import { ProfileEstimatorModal } from '../../components/profile/ProfileEstimatorModal';
import { ProfileLanguageSection } from '../../components/profile/ProfileLanguageSection';
import { ProfilePerformanceSection } from '../../components/profile/ProfilePerformanceSection';
import { ProfilePersonalSection } from '../../components/profile/ProfilePersonalSection';
import { ProfilePremiumSection } from '../../components/profile/ProfilePremiumSection';
import { ProfileSaveButton } from '../../components/profile/ProfileSaveButton';
import { ProfileTabs } from '../../components/profile/ProfileTabs';
import { ProfileUpdatesSection } from '../../components/profile/ProfileUpdatesSection';
import { normalizeBirthDateInput, WATER_BAG_OPTIONS } from '../../components/profile/profileHelpers';
import { type ProfileTutorialTargetKey, useProfileTutorial } from '../../hooks/useProfileTutorial';
import { useProfileScreen } from '../../hooks/useProfileScreen';
import { type TutorialStep } from '../../lib/helpTutorial';

export default function ProfileScreen() {
  const {
    locale,
    setLocale,
    t,
    isAnonymousAccount,
    loading,
    saving,
    error,
    activeProfileTab,
    setActiveProfileTab,
    fullName,
    setFullName,
    birthDateInput,
    weightKg,
    heightCm,
    waterBagLiters,
    setWaterBagLiters,
    utmbIndex,
    comfortableFlatPaceMinutes,
    comfortableFlatPaceSeconds,
    defaultCarbsPerHour,
    defaultWaterPerHour,
    defaultSodiumPerHour,
    showEstimatorModal,
    estimatorWeightKg,
    estimatorHeightCm,
    estimatorCarbLevel,
    estimatorHydrationLevel,
    estimatorSodiumLevel,
    setEstimatorCarbLevel,
    setEstimatorHydrationLevel,
    setEstimatorSodiumLevel,
    estimatedTargets,
    showChangelog,
    changelogLoading,
    changelogError,
    changelogEntries,
    checkingUpdates,
    updateCheckMessage,
    deletingAccount,
    profileTabs,
    birthDateHelpText,
    saveButtonLabel,
    carbEstimatorOptions,
    hydrationEstimatorOptions,
    sodiumEstimatorOptions,
    premiumBadges,
    premiumInfoCards,
    premiumBenefits,
    showUpgradeAction,
    upgradeLabel,
    billingActionBusy,
    isPurchasing,
    subscriptionHint,
    canManagePaidSubscription,
    showRestorePurchases,
    isRestoring,
    appVersion,
    appBuild,
    updatesAdminRows,
    updatesRows,
    emergencyLaunchMessage,
    handleChangeBirthDate,
    handleChangeWeightKg,
    handleChangeHeightCm,
    handleChangeUtmbIndex,
    handleChangePaceMinutes,
    handleChangePaceSeconds,
    handleChangeDefaultCarbs,
    handleChangeDefaultWater,
    handleChangeDefaultSodium,
    handleChangeEstimatorWeightKg,
    handleChangeEstimatorHeightCm,
    handleOpenEstimator,
    handleCloseEstimator,
    handleApplyEstimator,
    handleSave,
    handleLogout,
    handleOpenCreateAccount,
    handleOpenExistingAccountLogin,
    handleUpgrade,
    handleManageSubscription,
    handleRestorePurchases,
    handleOpenPrivacyPolicy,
    handleDeleteAccount,
    handleCheckForUpdates,
    handleOpenChangelog,
    handleCloseChangelog,
    resolveChangelogDetail,
    formatChangelogVersionMeta,
    loadingSpinnerColor,
  } = useProfileScreen();

  const tutorialSteps = useMemo<TutorialStep<ProfileTutorialTargetKey>[]>(
    () => [
      {
        screenKey: 'profile',
        targetKey: 'personal',
        title: t.helpTutorial.profile.personalTitle,
        body: t.helpTutorial.profile.personalBody,
        highlightPadding: 8,
        highlightRadius: 16,
        placement: 'bottom',
      },
      {
        screenKey: 'profile',
        targetKey: 'settings',
        title: t.helpTutorial.profile.settingsTitle,
        body: t.helpTutorial.profile.settingsBody,
        highlightPadding: 8,
        highlightRadius: 16,
      },
      {
        screenKey: 'profile',
        targetKey: 'save',
        title: t.helpTutorial.profile.saveTitle,
        body: t.helpTutorial.profile.saveBody,
        highlightPadding: 6,
        highlightRadius: 16,
      },
      {
        screenKey: 'profile',
        targetKey: 'premium',
        title: t.helpTutorial.profile.premiumTitle,
        body: t.helpTutorial.profile.premiumBody,
        highlightPadding: 10,
        highlightRadius: 22,
      },
      {
        screenKey: 'profile',
        targetKey: 'language',
        title: t.helpTutorial.profile.languageTitle,
        body: t.helpTutorial.profile.languageBody,
        highlightPadding: 8,
        highlightRadius: 16,
      },
    ],
    [t.helpTutorial],
  );

  const {
    handleProfileTabChange,
    handleTutorialClose,
    handleTutorialNext,
    handleTutorialPrevious,
    handleTutorialScrollEvent,
    handleTutorialScrollSettled,
    registerTutorialTarget,
    scrollRef,
    setTutorialContentHeight,
    setTutorialViewport,
    tutorialStepIndex,
    tutorialTargetRect,
    tutorialViewport,
    tutorialVisible,
  } = useProfileTutorial({
    activeTab: activeProfileTab,
    onActiveTabChange: setActiveProfileTab,
    steps: tutorialSteps,
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={loadingSpinnerColor} size="large" />
      </View>
    );
  }

  return (
    <View
      onLayout={(event) =>
        setTutorialViewport({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        onContentSizeChange={(_, height) => setTutorialContentHeight(height)}
        onMomentumScrollEnd={handleTutorialScrollSettled}
        onScroll={handleTutorialScrollEvent}
        onScrollEndDrag={handleTutorialScrollSettled}
        ref={scrollRef}
        scrollEventThrottle={16}
        style={styles.container}
      >
        <ProfileTabs activeTab={activeProfileTab} tabs={profileTabs} onChange={handleProfileTabChange} />

        {activeProfileTab === 'personal' ? (
          <TutorialTarget onMeasure={registerTutorialTarget} targetKey="personal">
            <ProfilePersonalSection
              title={t.profile.personalSectionTitle}
              subtitle={t.profile.personalSectionSubtitle}
              firstNameLabel={t.profile.firstNameLabel}
              firstNamePlaceholder={t.profile.namePlaceholder}
              birthDateLabel={t.profile.birthDateLabel}
              birthDatePlaceholder={t.profile.birthDatePlaceholder}
              birthDateHelpText={birthDateHelpText}
              weightLabel={t.profile.weightLabel}
              weightPlaceholder={t.profile.weightPlaceholder}
              heightLabel={t.profile.heightLabel}
              heightPlaceholder={t.profile.heightPlaceholder}
              fullName={fullName}
              birthDateInput={birthDateInput}
              weightKg={weightKg}
              heightCm={heightCm}
              onChangeFullName={setFullName}
              onChangeBirthDate={(value) => handleChangeBirthDate(normalizeBirthDateInput(value))}
              onChangeWeightKg={handleChangeWeightKg}
              onChangeHeightCm={handleChangeHeightCm}
            />
          </TutorialTarget>
        ) : null}

        {activeProfileTab === 'performance' ? (
          <TutorialTarget onMeasure={registerTutorialTarget} targetKey="settings">
            <ProfilePerformanceSection
              title={t.profile.performanceSectionTitle}
              subtitle={t.profile.performanceSectionSubtitle}
              effortTitle={t.profile.performanceEffortSectionTitle}
              effortHint={t.profile.performanceEffortSectionSubtitle}
              waterBagLabel={t.profile.waterBagLabel}
              utmbIndexLabel={t.profile.utmbIndexLabel}
              comfortableFlatPaceLabel={t.profile.comfortableFlatPaceLabel}
              paceMinutesLabel={t.profile.comfortableFlatPaceMinutesLabel}
              paceSecondsLabel={t.profile.comfortableFlatPaceSecondsLabel}
              planDefaultsTitle={t.profile.planDefaultsSectionTitle}
              planDefaultsHint={t.profile.planDefaultsSectionSubtitle}
              estimatorInlineHint={t.profile.estimatorInlineHint}
              estimatorButtonLabel={t.profile.estimatorButton}
              defaultCarbsLabel={t.profile.defaultCarbsPerHourLabel}
              defaultWaterLabel={t.profile.defaultWaterPerHourLabel}
              defaultSodiumLabel={t.profile.defaultSodiumPerHourLabel}
              waterBagOptions={WATER_BAG_OPTIONS}
              waterBagLiters={waterBagLiters}
              utmbIndex={utmbIndex}
              paceMinutes={comfortableFlatPaceMinutes}
              paceSeconds={comfortableFlatPaceSeconds}
              defaultCarbsPerHour={defaultCarbsPerHour}
              defaultWaterPerHour={defaultWaterPerHour}
              defaultSodiumPerHour={defaultSodiumPerHour}
              onSelectWaterBag={setWaterBagLiters}
              onChangeUtmbIndex={handleChangeUtmbIndex}
              onChangePaceMinutes={handleChangePaceMinutes}
              onChangePaceSeconds={handleChangePaceSeconds}
              onChangeDefaultCarbs={handleChangeDefaultCarbs}
              onChangeDefaultWater={handleChangeDefaultWater}
              onChangeDefaultSodium={handleChangeDefaultSodium}
              onOpenEstimator={handleOpenEstimator}
            />
          </TutorialTarget>
        ) : null}

        {activeProfileTab === 'settings' ? (
          <>
            <TutorialTarget onMeasure={registerTutorialTarget} targetKey="premium">
              <ProfilePremiumSection
                subscriptionLabel={t.profile.subscriptionLabel}
                badges={premiumBadges}
                infoCards={premiumInfoCards}
                premiumBenefitsTitle={t.profile.premiumBenefitsTitle}
                premiumBenefits={premiumBenefits}
                showPremiumBenefits={showUpgradeAction}
                showUpgradeAction={showUpgradeAction}
                upgradeLabel={upgradeLabel}
                billingActionBusy={billingActionBusy}
                isPurchasing={isPurchasing}
                onUpgrade={() => void handleUpgrade()}
                subscriptionHint={subscriptionHint}
                canManageSubscription={canManagePaidSubscription}
                manageSubscriptionLabel={t.profile.manageSubscription}
                onManageSubscription={() => void handleManageSubscription()}
                showRestorePurchases={showRestorePurchases}
                restorePurchasesLabel={t.profile.restorePurchases}
                isRestoring={isRestoring}
                onRestorePurchases={() => void handleRestorePurchases()}
              />
            </TutorialTarget>

            <TutorialTarget onMeasure={registerTutorialTarget} targetKey="language">
              <ProfileLanguageSection
                title={t.profile.languageLabel}
                selectedLocale={locale}
                languageFrLabel={t.profile.languageFr}
                languageEnLabel={t.profile.languageEn}
                onSelectLocale={setLocale}
                privacyPolicyLabel={t.profile.privacyPolicyButton}
                onOpenPrivacyPolicy={() => void handleOpenPrivacyPolicy()}
              />
            </TutorialTarget>

            <TutorialTarget onMeasure={registerTutorialTarget} targetKey="updates">
              <ProfileUpdatesSection
                title={t.profile.updatesSectionTitle}
                versionText={t.profile.versionLabel.replace(
                  '{version}',
                  updatesAdminRows.length ? `${appVersion} (${appBuild})` : appVersion,
                )}
                adminRows={updatesAdminRows}
                rows={updatesRows}
                emergencyLaunchMessage={emergencyLaunchMessage}
                updateCheckButtonLabel={t.profile.updateCheckButton}
                checkingUpdates={checkingUpdates}
                updateCheckMessage={updateCheckMessage}
                changelogButtonLabel={t.profile.changelogButton}
                onCheckForUpdates={() => void handleCheckForUpdates()}
                onOpenChangelog={handleOpenChangelog}
              />
            </TutorialTarget>

            <ProfileAccountSection
              title={
                isAnonymousAccount ? t.profile.guestAccountSectionTitle : t.profile.accountSectionTitle
              }
              body={isAnonymousAccount ? t.profile.guestAccountSectionBody : undefined}
              primaryLabel={
                isAnonymousAccount ? t.profile.guestCreateAccountCta : t.profile.logoutCta
              }
              primaryTone={isAnonymousAccount ? 'brand' : 'neutral'}
              onPrimaryPress={isAnonymousAccount ? handleOpenCreateAccount : handleLogout}
              secondaryLabel={
                isAnonymousAccount ? t.profile.guestExistingAccountCta : undefined
              }
              onSecondaryPress={
                isAnonymousAccount ? handleOpenExistingAccountLogin : undefined
              }
              dangerLabel={isAnonymousAccount ? undefined : t.profile.deleteAccountButton}
              dangerLoading={deletingAccount}
              onDangerPress={isAnonymousAccount ? undefined : handleDeleteAccount}
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TutorialTarget onMeasure={registerTutorialTarget} targetKey="save">
          <ProfileSaveButton label={saveButtonLabel} loading={saving} onPress={handleSave} />
        </TutorialTarget>
      </ScrollView>

      <SpotlightTutorial
        activeStepIndex={tutorialStepIndex}
        closeLabel={t.helpTutorial.close}
        doneLabel={t.helpTutorial.done}
        loadingLabel={t.helpTutorial.loadingTarget}
        nextLabel={t.helpTutorial.next}
        onClose={handleTutorialClose}
        onNext={handleTutorialNext}
        onPrevious={handleTutorialPrevious}
        previousLabel={t.helpTutorial.previous}
        steps={tutorialSteps}
        targetRect={tutorialTargetRect}
        viewportHeight={tutorialViewport.height}
        viewportWidth={tutorialViewport.width}
        visible={tutorialVisible}
      />

      <ProfileEstimatorModal
        visible={showEstimatorModal}
        closeLabel={t.common.close}
        title={t.profile.estimatorTitle}
        subtitle={t.profile.estimatorSubtitle}
        bodyMetricsTitle={t.profile.estimatorBodyMetricsTitle}
        weightLabel={t.profile.weightLabel}
        weightPlaceholder={t.profile.weightPlaceholder}
        heightLabel={t.profile.heightLabel}
        heightPlaceholder={t.profile.heightPlaceholder}
        carbQuestion={t.profile.estimatorCarbQuestion}
        hydrationQuestion={t.profile.estimatorHydrationQuestion}
        sodiumQuestion={t.profile.estimatorSodiumQuestion}
        carbOptions={carbEstimatorOptions}
        hydrationOptions={hydrationEstimatorOptions}
        sodiumOptions={sodiumEstimatorOptions}
        selectedCarbLevel={estimatorCarbLevel}
        selectedHydrationLevel={estimatorHydrationLevel}
        selectedSodiumLevel={estimatorSodiumLevel}
        estimatorWeightKg={estimatorWeightKg}
        estimatorHeightCm={estimatorHeightCm}
        onChangeEstimatorWeightKg={handleChangeEstimatorWeightKg}
        onChangeEstimatorHeightCm={handleChangeEstimatorHeightCm}
        onSelectCarbLevel={setEstimatorCarbLevel}
        onSelectHydrationLevel={setEstimatorHydrationLevel}
        onSelectSodiumLevel={setEstimatorSodiumLevel}
        resultTitle={t.profile.estimatorResultTitle}
        carbsLabel={t.profile.defaultCarbsPerHourLabel}
        waterLabel={t.profile.defaultWaterPerHourLabel}
        sodiumLabel={t.profile.defaultSodiumPerHourLabel}
        estimatedTargets={estimatedTargets}
        missingBodyMetricsLabel={t.profile.estimatorMissingBodyMetrics}
        disclaimer={t.profile.estimatorDisclaimer}
        applyLabel={t.profile.estimatorApply}
        onApply={handleApplyEstimator}
        onClose={handleCloseEstimator}
      />

      <ProfileChangelogModal
        visible={showChangelog}
        title={t.profile.changelogTitle}
        subtitle={t.profile.changelogSubtitle}
        closeLabel={t.common.close}
        loading={changelogLoading}
        errorMessage={changelogError || null}
        entries={changelogEntries}
        emptyLabel={t.profile.changelogEmpty}
        resolveDetail={resolveChangelogDetail}
        versionMetaFormatter={formatChangelogVersionMeta}
        onClose={handleCloseChangelog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

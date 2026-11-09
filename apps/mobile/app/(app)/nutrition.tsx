import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorState } from '../../components/themed/ErrorState';
import { LoadingState } from '../../components/themed/LoadingState';
import { NutritionContent } from '../../components/nutrition/NutritionContent';
import { RootScreenActionMenu } from '../../components/navigation/RootScreenActionMenu';
import {
  ROOT_HEADER_EXPANDED_BODY_HEIGHT,
  RootCollapsibleHeader,
} from '../../components/navigation/RootCollapsibleHeader';
import { Colors } from '../../constants/colors';
import { useNutritionScreen } from '../../hooks/useNutritionScreen';
import { useI18n } from '../../lib/i18n';
import { OnboardingGuideCard } from '../../components/onboarding/OnboardingGuideCard';
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  skipOnboardingKind,
} from '../../lib/onboardingStatus';

export default function NutritionScreen() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: 'plan' }>();
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { locale } = useI18n();
  const {
    t,
    isPremium,
    loading,
    refreshing,
    error,
    userId,
    isAdmin,
    favorites,
    products,
    favoriteIds,
    fuelFilter,
    favoritesExpanded,
    catalogSearch,
    showCreateModal,
    selectedProduct,
    selectedProductFavoriteUsage,
    savingProduct,
    deletingProduct,
    creating,
    newName,
    newBrand,
    newFuelType,
    newCarbsG,
    newSodiumMg,
    newCaloriesKcal,
    newImageDraft,
    showFavoriteLimitModal,
    filteredProducts,
    availableBrands,
    favoriteLimitBannerLabel,
    favoriteLimitMessage,
    handleRetry,
    handleRefresh,
    toggleFavorite,
    setFuelFilter,
    setFavoritesExpanded,
    setCatalogSearch,
    setShowCreateModal,
    setNewName,
    setNewBrand,
    setNewFuelType,
    setNewCarbsG,
    setNewSodiumMg,
    setNewCaloriesKcal,
    setShowFavoriteLimitModal,
    pickNewImage,
    clearNewImage,
    handleCreateProduct,
    handleCancelCreateProduct,
    openProductDetail,
    closeProductDetail,
    handleUpdateSelectedProduct,
    handleDeleteSelectedProduct,
  } = useNutritionScreen();
  // Nutrition is no longer a root tab: during plan onboarding it keeps the help
  // menu, otherwise it is a pushed screen (Profil or plan workspace) with a back action.
  const rootHelpAction = onboarding === 'plan' ? (
    <RootScreenActionMenu
      contextLabel="Nutrition"
      help={{
        type: 'message',
        title: t.rootActionMenu.nutritionHelpTitle,
        body: t.rootActionMenu.nutritionHelpBody,
      }}
      topInset={insets.top}
    />
  ) : (
    <Pressable
      accessibilityLabel={t.common.back}
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/profile'))}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      testID="nutrition-back"
    >
      <Ionicons color={Colors.textOnBrand} name="chevron-back" size={24} />
    </Pressable>
  );

  async function continuePlanOnboarding() {
    setOnboardingBusy(true);
    try {
      const progress = await loadOnboardingProgress();
      if (!progress?.selectedRaceId) throw new Error('Missing onboarding race');
      await saveOnboardingProgress({
        kind: 'plan',
        stage: 'plan',
        selectedRaceId: progress.selectedRaceId,
      });
      router.replace(
        `/(app)/plan/new?catalogRaceId=${progress.selectedRaceId}&onboarding=plan`,
      );
    } catch (caught) {
      console.error('Unable to continue plan onboarding:', caught);
      setOnboardingBusy(false);
    }
  }

  async function skipPlanOnboarding() {
    setOnboardingBusy(true);
    try {
      await skipOnboardingKind('plan', 'nutrition');
      // Nutrition is not a root tab anymore: leave the guided step to "Mes courses".
      router.replace('/(app)/plans');
    } finally {
      setOnboardingBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState
          label={t.common.loading}
          style={[styles.screen, { paddingTop: insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT }]}
        />
        <RootCollapsibleHeader
          helpAction={rootHelpAction}
          icon="nutrition-outline"
          scrollY={scrollY}
          title="Nutrition"
          topInset={insets.top}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState
          title={t.nutrition.loadError}
          retryLabel={t.common.retry}
          onRetry={handleRetry}
          style={[styles.screen, { paddingTop: insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT }]}
        />
        <RootCollapsibleHeader
          helpAction={rootHelpAction}
          icon="nutrition-outline"
          scrollY={scrollY}
          title="Nutrition"
          topInset={insets.top}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <NutritionContent
        contentTopInset={insets.top + ROOT_HEADER_EXPANDED_BODY_HEIGHT}
        locale={locale}
        catalogSearch={catalogSearch}
        creating={creating}
        deletingProduct={deletingProduct}
        emptyCatalogDescription={t.nutrition.emptyCatalogDescription}
        emptyCatalogTitle={t.nutrition.emptyCatalogTitle}
        favoriteIds={favoriteIds}
        favoriteLimitBannerLabel={favoriteLimitBannerLabel}
        favoriteLimitMessage={favoriteLimitMessage}
        refreshing={refreshing}
        favorites={favorites}
        favoritesExpanded={favoritesExpanded}
        filteredProducts={filteredProducts}
        freeAccessTitle={t.plans.freeAccessTitle}
        fuelFilter={fuelFilter}
        isAdmin={isAdmin}
        isPremium={isPremium}
        otherBrandsLabel={t.nutrition.otherBrandsLabel}
        verifiedLabel={t.nutrition.verifiedLabel}
        newCaloriesKcal={newCaloriesKcal}
        newBrand={newBrand}
        availableBrands={availableBrands}
        newCarbsG={newCarbsG}
        newFuelType={newFuelType}
        newImageDraft={newImageDraft}
        newName={newName}
        newSodiumMg={newSodiumMg}
        onCancelCreateProduct={handleCancelCreateProduct}
        onChangeCatalogSearch={setCatalogSearch}
        onChangeFuelFilter={setFuelFilter}
        onChangeNewCaloriesKcal={setNewCaloriesKcal}
        onChangeNewBrand={setNewBrand}
        onChangeNewCarbsG={setNewCarbsG}
        onChangeNewFuelType={setNewFuelType}
        onChangeNewName={setNewName}
        onChangeNewSodiumMg={setNewSodiumMg}
        onPickNewImage={() => void pickNewImage()}
        onRemoveNewImage={clearNewImage}
        onRefresh={handleRefresh}
        onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
        onCloseFavoriteLimitModal={() => setShowFavoriteLimitModal(false)}
        onCloseProductDetail={closeProductDetail}
        onDeleteSelectedProduct={handleDeleteSelectedProduct}
        onOpenProductDetail={openProductDetail}
        onSubmitCreateProduct={() => void handleCreateProduct()}
        onToggleFavorite={(productId, productOverride) => void toggleFavorite(productId, productOverride)}
        onToggleFavorites={() => setFavoritesExpanded((current) => !current)}
        onUpdateProduct={handleUpdateSelectedProduct}
        products={products}
        savingProduct={savingProduct}
        selectedProduct={selectedProduct}
        selectedProductFavoriteUsage={selectedProductFavoriteUsage}
        showCreateModal={showCreateModal}
        showFavoriteLimitModal={showFavoriteLimitModal}
        userId={userId}
      />

      <RootCollapsibleHeader
        action={{
          accessibilityLabel: locale === 'fr' ? 'Nouveau produit' : 'New product',
          icon: 'add',
          onPress: () => setShowCreateModal(true),
        }}
        helpAction={rootHelpAction}
        icon="nutrition-outline"
        scrollY={scrollY}
        title="Nutrition"
        topInset={insets.top}
      />

      {onboarding === 'plan' ? (
        <OnboardingGuideCard
          title={t.onboarding.tours.productsTitle}
          body={t.onboarding.tours.productsBody}
          actionLabel={t.onboarding.tours.continueToPlan}
          onAction={() => void continuePlanOnboarding()}
          skipLabel={t.onboarding.tours.skip}
          onSkip={() => void skipPlanOnboarding()}
          busy={onboardingBusy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  backButtonPressed: { opacity: 0.68 },
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

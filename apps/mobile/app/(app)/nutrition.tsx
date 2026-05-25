import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/themed/Text';
import { NutritionContent } from '../../components/nutrition/NutritionContent';
import { RootScreenActionMenu } from '../../components/navigation/RootScreenActionMenu';
import { Colors } from '../../constants/colors';
import { useNutritionScreen } from '../../hooks/useNutritionScreen';
import { useI18n } from '../../lib/i18n';
import type { FloatingActionMenuItem } from '../../components/navigation/FloatingActionMenu';

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const { locale } = useI18n();
  const {
    t,
    isPremium,
    loading,
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
    savingProduct,
    deletingProduct,
    creating,
    newName,
    newFuelType,
    newCarbsG,
    newSodiumMg,
    newCaloriesKcal,
    newImageDraft,
    showFavoriteLimitModal,
    filteredProducts,
    favoriteLimitBannerLabel,
    favoriteLimitMessage,
    toggleFavorite,
    setFuelFilter,
    setFavoritesExpanded,
    setCatalogSearch,
    setShowCreateModal,
    setNewName,
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
        key: 'new-product',
        label: locale === 'fr' ? 'Nouveau produit' : 'New product',
        icon: 'add-circle-outline',
        onPress: () => setShowCreateModal(true),
      },
    ],
    [locale, setShowCreateModal],
  );
  const helpCopy = useMemo(
    () =>
      locale === 'fr'
        ? {
            title: 'Nutrition',
            body: 'Garde tes produits favoris en haut, filtre le catalogue par type de carburant et ajoute tes produits personnels depuis le menu.',
          }
        : {
            title: 'Nutrition',
            body: 'Keep favorite products at the top, filter the catalog by fuel type, and add custom products from the menu.',
          },
    [locale],
  );

  if (loading) {
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
      </View>
    );
  }

  return (
    <View style={screenStyle}>
      <NutritionContent
        catalogSearch={catalogSearch}
        creating={creating}
        deletingProduct={deletingProduct}
        favoriteIds={favoriteIds}
        favoriteLimitBannerLabel={favoriteLimitBannerLabel}
        favoriteLimitMessage={favoriteLimitMessage}
        favorites={favorites}
        favoritesExpanded={favoritesExpanded}
        filteredProducts={filteredProducts}
        freeAccessTitle={t.plans.freeAccessTitle}
        fuelFilter={fuelFilter}
        isAdmin={isAdmin}
        isPremium={isPremium}
        otherBrandsLabel={t.nutrition.otherBrandsLabel}
        newCaloriesKcal={newCaloriesKcal}
        newCarbsG={newCarbsG}
        newFuelType={newFuelType}
        newImageDraft={newImageDraft}
        newName={newName}
        newSodiumMg={newSodiumMg}
        onCancelCreateProduct={handleCancelCreateProduct}
        onChangeCatalogSearch={setCatalogSearch}
        onChangeFuelFilter={setFuelFilter}
        onChangeNewCaloriesKcal={setNewCaloriesKcal}
        onChangeNewCarbsG={setNewCarbsG}
        onChangeNewFuelType={setNewFuelType}
        onChangeNewName={setNewName}
        onChangeNewSodiumMg={setNewSodiumMg}
        onPickNewImage={() => void pickNewImage()}
        onRemoveNewImage={clearNewImage}
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
        showCreateModal={showCreateModal}
        showFavoriteLimitModal={showFavoriteLimitModal}
        userId={userId}
      />

      <RootScreenActionMenu
        actions={actionItems}
        contextLabel="Nutrition"
        help={{ type: 'message', title: helpCopy.title, body: helpCopy.body }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
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
  },
});

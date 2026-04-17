import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NutritionContent } from '../../components/nutrition/NutritionContent';
import { Colors } from '../../constants/colors';
import { useNutritionScreen } from '../../hooks/useNutritionScreen';

export default function NutritionScreen() {
  const {
    t,
    isPremium,
    loading,
    error,
    userId,
    favorites,
    products,
    favoriteIds,
    fuelFilter,
    favoritesExpanded,
    catalogSearch,
    showCreateModal,
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
  } = useNutritionScreen();

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
    <NutritionContent
      catalogSearch={catalogSearch}
      creating={creating}
      favoriteIds={favoriteIds}
      favoriteLimitBannerLabel={favoriteLimitBannerLabel}
      favoriteLimitMessage={favoriteLimitMessage}
      favorites={favorites}
      favoritesExpanded={favoritesExpanded}
      filteredProducts={filteredProducts}
      freeAccessTitle={t.plans.freeAccessTitle}
      fuelFilter={fuelFilter}
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
      onOpenCreateModal={() => setShowCreateModal(true)}
      onSubmitCreateProduct={() => void handleCreateProduct()}
      onToggleFavorite={(productId, productOverride) => void toggleFavorite(productId, productOverride)}
      onToggleFavorites={() => setFavoritesExpanded((current) => !current)}
      products={products}
      showCreateModal={showCreateModal}
      showFavoriteLimitModal={showFavoriteLimitModal}
      userId={userId}
    />
  );
}

const styles = StyleSheet.create({
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

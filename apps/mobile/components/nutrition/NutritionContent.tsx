import { memo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { PremiumUpsellModal } from '../premium/PremiumUpsellModal';
import { FREE_FAVORITE_LIMIT, FUEL_FILTERS, FUEL_TYPE_LABELS } from './nutritionConstants';
import { NutritionCreateProductModal } from './NutritionCreateProductModal';
import type { FavoriteRow, FuelType, Product } from './types';

type NutritionContentProps = {
  isPremium: boolean;
  favoritesExpanded: boolean;
  favorites: FavoriteRow[];
  products: Product[];
  filteredProducts: Product[];
  favoriteIds: Set<string>;
  fuelFilter: FuelType | 'all';
  catalogSearch: string;
  userId: string | null;
  showFavoriteLimitModal: boolean;
  showCreateModal: boolean;
  creating: boolean;
  newName: string;
  newFuelType: FuelType;
  newCarbsG: string;
  newSodiumMg: string;
  newCaloriesKcal: string;
  favoriteLimitBannerLabel: string;
  favoriteLimitMessage: string;
  freeAccessTitle: string;
  onToggleFavorites: () => void;
  onToggleFavorite: (productId: string, productOverride?: Product) => void;
  onChangeFuelFilter: (value: FuelType | 'all') => void;
  onChangeCatalogSearch: (value: string) => void;
  onOpenCreateModal: () => void;
  onCloseFavoriteLimitModal: () => void;
  onChangeNewName: (value: string) => void;
  onChangeNewFuelType: (value: FuelType) => void;
  onChangeNewCarbsG: (value: string) => void;
  onChangeNewSodiumMg: (value: string) => void;
  onChangeNewCaloriesKcal: (value: string) => void;
  onSubmitCreateProduct: () => void;
  onCancelCreateProduct: () => void;
};

export const NutritionContent = memo(function NutritionContent({
  isPremium,
  favoritesExpanded,
  favorites,
  products,
  filteredProducts,
  favoriteIds,
  fuelFilter,
  catalogSearch,
  userId,
  showFavoriteLimitModal,
  showCreateModal,
  creating,
  newName,
  newFuelType,
  newCarbsG,
  newSodiumMg,
  newCaloriesKcal,
  favoriteLimitBannerLabel,
  favoriteLimitMessage,
  freeAccessTitle,
  onToggleFavorites,
  onToggleFavorite,
  onChangeFuelFilter,
  onChangeCatalogSearch,
  onOpenCreateModal,
  onCloseFavoriteLimitModal,
  onChangeNewName,
  onChangeNewFuelType,
  onChangeNewCarbsG,
  onChangeNewSodiumMg,
  onChangeNewCaloriesKcal,
  onSubmitCreateProduct,
  onCancelCreateProduct,
}: NutritionContentProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <TouchableOpacity activeOpacity={0.7} onPress={onToggleFavorites} style={styles.favoritesToggleRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleCompact]}>Mes favoris</Text>
        <Text style={styles.favoritesChevron}>{favoritesExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {favoritesExpanded ? (
        <>
          {!isPremium ? (
            <View style={styles.limitBanner}>
              <Text style={styles.limitBannerText}>{favoriteLimitBannerLabel}</Text>
            </View>
          ) : null}

          {favorites.length === 0 ? (
            <View style={styles.emptyFavorites}>
              <Text style={styles.emptyFavText}>
                Aucun favori. Ajoute des produits depuis le catalogue ci-dessous.
              </Text>
            </View>
          ) : (
            favorites.map((favorite) => (
              <ProductCard
                key={favorite.product_id}
                isFavorite
                isOwnedByUser={false}
                onToggleFavorite={() => onToggleFavorite(favorite.product_id)}
                product={favorite.products}
              />
            ))
          )}
        </>
      ) : null}

      <View style={styles.catalogHeader}>
        <Text style={styles.sectionTitle}>Catalogue produits</Text>
        <TouchableOpacity onPress={onOpenCreateModal} style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Mon produit</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        onChangeText={onChangeCatalogSearch}
        placeholder="🔍 Rechercher un produit..."
        placeholderTextColor={Colors.textMuted}
        style={styles.catalogSearchInput}
        value={catalogSearch}
      />

      <ScrollView
        contentContainerStyle={styles.filterContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        {FUEL_FILTERS.map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => onChangeFuelFilter(type)}
            style={[styles.filterChip, fuelFilter === type && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, fuelFilter === type && styles.filterChipTextActive]}>
              {FUEL_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredProducts.length === 0 ? (
        <View style={styles.emptyCategory}>
          <Text style={styles.emptyFavText}>Aucun produit dans cette catégorie.</Text>
        </View>
      ) : (
        filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            isFavorite={favoriteIds.has(product.id)}
            isOwnedByUser={product.created_by === userId}
            onToggleFavorite={() => onToggleFavorite(product.id)}
            product={product}
          />
        ))
      )}

      <PremiumUpsellModal
        message={favoriteLimitMessage}
        onClose={onCloseFavoriteLimitModal}
        title={freeAccessTitle}
        visible={showFavoriteLimitModal}
      />

      <NutritionCreateProductModal
        caloriesKcal={newCaloriesKcal}
        carbsG={newCarbsG}
        creating={creating}
        fuelType={newFuelType}
        name={newName}
        onCancel={onCancelCreateProduct}
        onChangeCaloriesKcal={onChangeNewCaloriesKcal}
        onChangeCarbsG={onChangeNewCarbsG}
        onChangeName={onChangeNewName}
        onChangeSodiumMg={onChangeNewSodiumMg}
        onSelectFuelType={onChangeNewFuelType}
        onSubmit={onSubmitCreateProduct}
        sodiumMg={newSodiumMg}
        visible={showCreateModal}
      />
    </ScrollView>
  );
});

function ProductCard({
  product,
  isFavorite,
  isOwnedByUser,
  onToggleFavorite,
}: {
  product: Product;
  isFavorite: boolean;
  isOwnedByUser: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productType}>
          {FUEL_TYPE_LABELS[product.fuel_type] ?? product.fuel_type}
          {isOwnedByUser ? <Text style={styles.myProductTag}> · Mon produit</Text> : null}
        </Text>
        <View style={styles.productStats}>
          {product.carbs_g != null ? <Text style={styles.statText}>{product.carbs_g}g glucides</Text> : null}
          {product.sodium_mg != null ? <Text style={styles.statText}> · {product.sodium_mg}mg sodium</Text> : null}
          {!isFavorite && product.calories_kcal != null ? (
            <Text style={styles.statText}> · {product.calories_kcal} kcal</Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggleFavorite}
        style={[styles.favButton, isFavorite && styles.favButtonActive]}
      >
        <Ionicons
          color={isFavorite ? Colors.textOnBrand : Colors.brandPrimary}
          name={isFavorite ? 'star' : 'star-outline'}
          size={18}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brandPrimary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionTitleCompact: {
    marginBottom: 0,
  },
  favoritesToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  favoritesChevron: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  limitBanner: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  limitBannerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyFavorites: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 8,
  },
  emptyCategory: {
    paddingVertical: 20,
  },
  emptyFavText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    marginBottom: 4,
  },
  createButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  catalogSearchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.textOnBrand,
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  productType: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  myProductTag: {
    color: Colors.brandPrimary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  productStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  favButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1.5,
    borderColor: Colors.brandBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favButtonActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
});

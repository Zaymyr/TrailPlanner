import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Text } from '../themed/Text';
import { DataText } from '../themed/DataText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumUpsellModal } from '../premium/PremiumUpsellModal';
import { FUEL_FILTERS, FUEL_TYPE_LABELS } from './nutritionConstants';
import { NutritionCreateProductModal } from './NutritionCreateProductModal';
import { ProductDetailModal } from './ProductDetailModal';
import type { FavoriteRow, FuelType, Product, ProductEditDraft } from './types';

const verifiedProductIcon = require('../../assets/verified-product.png');

type ProductBrandGroup<T> = {
  brandLabel: string;
  items: T[];
};

type CatalogListRow =
  | {
      type: 'brand';
      key: string;
      brandLabel: string;
      count: number;
      expanded: boolean;
      hasVerifiedProduct: boolean;
    }
  | {
      type: 'product';
      key: string;
      product: Product;
    };

const KNOWN_BRAND_PREFIXES: Array<{ match: string; label: string }> = [
  { match: 'precision fuel & hydration', label: 'Precision Fuel & Hydration' },
  { match: 'precision fuel', label: 'Precision Fuel & Hydration' },
  { match: 'science in sport', label: 'SiS' },
  { match: 'tailwind nutrition', label: 'Tailwind' },
  { match: 'huma chia', label: 'Huma' },
  { match: 'naak', label: 'NAAK' },
  { match: 'maurten', label: 'Maurten' },
  { match: 'neversecond', label: 'Neversecond' },
  { match: 'overstims', label: 'Overstims' },
  { match: 'powerbar', label: 'Powerbar' },
  { match: 'tailwind', label: 'Tailwind' },
  { match: 'aptonia', label: 'Aptonia' },
  { match: 'clif', label: 'Clif' },
  { match: 'high5', label: 'HIGH5' },
  { match: 'sis', label: 'SiS' },
  { match: 'gu', label: 'GU' },
];

const GENERIC_BRAND_TOKENS = new Set([
  'bar',
  'capsule',
  'capsules',
  'decathlon',
  'drink',
  'electrolyte',
  'energy',
  'food',
  'fuel',
  'gel',
  'gels',
  'mix',
  'nutrition',
  'other',
  'product',
]);

function normalizeBrandSource(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferNutritionBrand(product: Pick<Product, 'name' | 'brand'>, fallbackLabel: string) {
  const explicitBrand = product.brand?.trim();
  if (explicitBrand) {
    return explicitBrand;
  }

  const productName = product.name;
  const fromDelimiter = productName.split(' - ')[0]?.trim();
  const source = fromDelimiter || productName.trim();
  const normalizedSource = normalizeBrandSource(source);

  for (const brand of KNOWN_BRAND_PREFIXES) {
    if (normalizedSource.startsWith(brand.match)) {
      return brand.label;
    }
  }

  const firstToken = source
    .split(/\s+/)
    .map((part) => part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .find(Boolean);

  if (firstToken && GENERIC_BRAND_TOKENS.has(normalizeBrandSource(firstToken))) {
    return fallbackLabel;
  }

  return firstToken || fallbackLabel;
}

function groupItemsByBrand<T>(
  items: T[],
  getProduct: (item: T) => Product,
  fallbackLabel: string,
): ProductBrandGroup<T>[] {
  const groups = items.reduce((map, item) => {
    const brandLabel = inferNutritionBrand(getProduct(item), fallbackLabel);
    const currentGroup = map.get(brandLabel) ?? [];
    currentGroup.push(item);
    map.set(brandLabel, currentGroup);
    return map;
  }, new Map<string, T[]>());

  return Array.from(groups.entries())
    .map(([brandLabel, groupedItems]) => ({
      brandLabel,
      items: groupedItems,
    }))
    .sort((left, right) => left.brandLabel.localeCompare(right.brandLabel));
}

function buildCatalogRows(
  groups: ProductBrandGroup<Product>[],
  expandedBrands: Set<string>,
  forceExpanded: boolean,
): CatalogListRow[] {
  const rows: CatalogListRow[] = [];

  groups.forEach((group) => {
    const expanded = forceExpanded || expandedBrands.has(group.brandLabel);
    rows.push({
      type: 'brand',
      key: `brand-${group.brandLabel}`,
      brandLabel: group.brandLabel,
      count: group.items.length,
      expanded,
    });

    if (expanded) {
      group.items.forEach((product) => {
        rows.push({
          type: 'product',
          key: `product-${product.id}`,
          product,
        });
      });
    }
  });

  return rows;
}

function isVerifiedProduct(product: Product) {
  return product.is_official === true;
}

function buildCatalogRows(
  groups: ProductBrandGroup<Product>[],
  expandedBrands: Set<string>,
  forceExpanded: boolean,
): CatalogListRow[] {
  const rows: CatalogListRow[] = [];

  groups.forEach((group) => {
    const expanded = forceExpanded || expandedBrands.has(group.brandLabel);
    rows.push({
      type: 'brand',
      key: `brand-${group.brandLabel}`,
      brandLabel: group.brandLabel,
      count: group.items.length,
      expanded,
      hasVerifiedProduct: group.items.some(isVerifiedProduct),
    });

    if (expanded) {
      group.items.forEach((product) => {
        rows.push({
          type: 'product',
          key: `product-${product.id}`,
          product,
        });
      });
    }
  });

  return rows;
}

type NutritionContentProps = {
  isPremium: boolean;
  isAdmin: boolean;
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
  newImageDraft: { uri: string; name: string } | null;
  selectedProduct: Product | null;
  savingProduct: boolean;
  deletingProduct: boolean;
  favoriteLimitBannerLabel: string;
  favoriteLimitMessage: string;
  freeAccessTitle: string;
  otherBrandsLabel: string;
  onToggleFavorites: () => void;
  onToggleFavorite: (productId: string, productOverride?: Product) => void;
  onChangeFuelFilter: (value: FuelType | 'all') => void;
  onChangeCatalogSearch: (value: string) => void;
  onCloseFavoriteLimitModal: () => void;
  onChangeNewName: (value: string) => void;
  onChangeNewFuelType: (value: FuelType) => void;
  onChangeNewCarbsG: (value: string) => void;
  onChangeNewSodiumMg: (value: string) => void;
  onChangeNewCaloriesKcal: (value: string) => void;
  onPickNewImage: () => void;
  onRemoveNewImage: () => void;
  onSubmitCreateProduct: () => void;
  onCancelCreateProduct: () => void;
  onOpenProductDetail: (product: Product) => void;
  onCloseProductDetail: () => void;
  onUpdateProduct: (draft: ProductEditDraft) => Promise<boolean>;
  onDeleteSelectedProduct: () => void;
};

export const NutritionContent = memo(function NutritionContent({
  isPremium,
  isAdmin,
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
  newImageDraft,
  selectedProduct,
  savingProduct,
  deletingProduct,
  favoriteLimitBannerLabel,
  favoriteLimitMessage,
  freeAccessTitle,
  otherBrandsLabel,
  onToggleFavorites,
  onToggleFavorite,
  onChangeFuelFilter,
  onChangeCatalogSearch,
  onCloseFavoriteLimitModal,
  onChangeNewName,
  onChangeNewFuelType,
  onChangeNewCarbsG,
  onChangeNewSodiumMg,
  onChangeNewCaloriesKcal,
  onPickNewImage,
  onRemoveNewImage,
  onSubmitCreateProduct,
  onCancelCreateProduct,
  onOpenProductDetail,
  onCloseProductDetail,
  onUpdateProduct,
  onDeleteSelectedProduct,
}: NutritionContentProps) {
  const [expandedCatalogBrands, setExpandedCatalogBrands] = useState<Set<string>>(() => new Set());
  const catalogSearchActive = catalogSearch.trim().length > 0;
  const favoriteGroups = useMemo(
    () => groupItemsByBrand(favorites, (favorite) => favorite.products, otherBrandsLabel),
    [favorites, otherBrandsLabel],
  );
  const catalogGroups = useMemo(
    () => groupItemsByBrand(filteredProducts, (product) => product, otherBrandsLabel),
    [filteredProducts, otherBrandsLabel],
  );
  const catalogRows = useMemo(
    () => buildCatalogRows(catalogGroups, expandedCatalogBrands, catalogSearchActive),
    [catalogGroups, catalogSearchActive, expandedCatalogBrands],
  );
  const canManageSelectedProduct = Boolean(
    selectedProduct && (isAdmin || selectedProduct.created_by === userId),
  );

  const toggleCatalogBrand = useCallback((brandLabel: string) => {
    setExpandedCatalogBrands((current) => {
      const next = new Set(current);
      if (next.has(brandLabel)) {
        next.delete(brandLabel);
      } else {
        next.add(brandLabel);
      }
      return next;
    });
  }, []);

  const listHeader = useMemo(
    () => (
      <>
        <TouchableOpacity activeOpacity={0.7} onPress={onToggleFavorites} style={styles.favoritesToggleRow}>
          <Text style={[styles.sectionTitle, styles.sectionTitleCompact]}>Mes favoris</Text>
          <Ionicons
            color={Colors.brandPrimary}
            name={favoritesExpanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
          />
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
              favoriteGroups.map((group) => (
                <View key={group.brandLabel} style={styles.brandGroup}>
                  <View style={styles.brandHeader}>
                    <Text style={styles.brandTitle}>{group.brandLabel}</Text>
                    <View style={styles.brandHeaderActions}>
                      <View style={styles.brandCountPill}>
                        <DataText style={styles.brandCountText}>{group.items.length}</DataText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.brandItems}>
                    {group.items.map((favorite) => (
                      <ProductCard
                        key={favorite.product_id}
                        isFavorite
                        isOwnedByUser={favorite.products.created_by === userId}
                        onPress={() => onOpenProductDetail(favorite.products)}
                        onToggleFavorite={() => onToggleFavorite(favorite.product_id)}
                        product={favorite.products}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}

        <View style={styles.catalogHeader}>
          <Text style={styles.sectionTitle}>Catalogue produits</Text>
        </View>

        <TextInput
          onChangeText={onChangeCatalogSearch}
          placeholder="Rechercher un produit..."
          placeholderTextColor={Colors.textMuted}
          style={styles.catalogSearchInput}
          value={catalogSearch}
        />

        <View style={styles.filterBar}>
          <ScrollView
            contentContainerStyle={styles.filterContent}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {FUEL_FILTERS.map((type) => (
              <TouchableOpacity
                key={type}
                activeOpacity={0.8}
                onPress={() => onChangeFuelFilter(type)}
                style={[styles.filterChip, fuelFilter === type && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, fuelFilter === type && styles.filterChipTextActive]}>
                  {FUEL_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </>
    ),
    [
      catalogSearch,
      favoriteGroups,
      favoriteLimitBannerLabel,
      favorites.length,
      favoritesExpanded,
      fuelFilter,
      isPremium,
      onChangeCatalogSearch,
      onChangeFuelFilter,
      onOpenProductDetail,
      onToggleFavorite,
      onToggleFavorites,
      userId,
    ],
  );

  const renderCatalogRow = useCallback(
    ({ item }: ListRenderItemInfo<CatalogListRow>) => {
      if (item.type === 'brand') {
        return (
          <TouchableOpacity
            accessibilityHint={
              catalogSearchActive
                ? undefined
                : item.expanded
                  ? 'Replier cette marque'
                  : 'Afficher les produits de cette marque'
            }
            accessibilityLabel={`${item.brandLabel}, ${item.count} produits`}
            accessibilityRole="button"
            activeOpacity={catalogSearchActive ? 1 : 0.75}
            disabled={catalogSearchActive}
            onPress={() => toggleCatalogBrand(item.brandLabel)}
            style={[styles.brandHeaderButton, item.expanded && styles.brandHeaderButtonExpanded]}
          >
            <Text numberOfLines={1} style={styles.brandTitle}>
              {item.brandLabel}
            </Text>
            <View style={styles.brandHeaderActions}>
              {item.hasVerifiedProduct && !item.expanded ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel="Marque validee"
                  source={verifiedProductIcon}
                  style={styles.brandVerifiedIcon}
                />
              ) : null}
              <View style={styles.brandCountPill}>
                <DataText style={styles.brandCountText}>{item.count}</DataText>
              </View>
              <Ionicons
                color={Colors.brandPrimary}
                name={item.expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
              />
            </View>
          </TouchableOpacity>
        );
      }

      return (
        <ProductCard
          isFavorite={favoriteIds.has(item.product.id)}
          isOwnedByUser={item.product.created_by === userId}
          onPress={() => onOpenProductDetail(item.product)}
          onToggleFavorite={() => onToggleFavorite(item.product.id)}
          product={item.product}
        />
      );
    },
    [
      catalogSearchActive,
      favoriteIds,
      onOpenProductDetail,
      onToggleFavorite,
      toggleCatalogBrand,
      userId,
    ],
  );

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={catalogRows}
        extraData={favoriteIds}
        initialNumToRender={18}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          <View style={styles.emptyCategory}>
            <Text style={styles.emptyFavText}>Aucun produit dans cette catégorie.</Text>
          </View>
        }
        ListHeaderComponent={listHeader}
        maxToRenderPerBatch={14}
        removeClippedSubviews
        renderItem={renderCatalogRow}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        updateCellsBatchingPeriod={32}
        windowSize={7}
      />

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
        imageName={newImageDraft?.name ?? null}
        imagePreviewUri={newImageDraft?.uri ?? null}
        name={newName}
        onCancel={onCancelCreateProduct}
        onChangeCaloriesKcal={onChangeNewCaloriesKcal}
        onChangeCarbsG={onChangeNewCarbsG}
        onChangeName={onChangeNewName}
        onChangeSodiumMg={onChangeNewSodiumMg}
        onPickImage={onPickNewImage}
        onRemoveImage={onRemoveNewImage}
        onSelectFuelType={onChangeNewFuelType}
        onSubmit={onSubmitCreateProduct}
        sodiumMg={newSodiumMg}
        visible={showCreateModal}
      />

      <ProductDetailModal
        canManage={canManageSelectedProduct}
        deleting={deletingProduct}
        isFavorite={selectedProduct ? favoriteIds.has(selectedProduct.id) : false}
        onClose={onCloseProductDetail}
        onDelete={onDeleteSelectedProduct}
        onSave={onUpdateProduct}
        onToggleFavorite={() => {
          if (selectedProduct) {
            onToggleFavorite(selectedProduct.id, selectedProduct);
          }
        }}
        product={selectedProduct}
        saving={savingProduct}
        visible={selectedProduct !== null}
      />
    </View>
  );
});

function ProductCard({
  product,
  isFavorite,
  isOwnedByUser,
  onPress,
  onToggleFavorite,
}: {
  product: Product;
  isFavorite: boolean;
  isOwnedByUser: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const isVerified = isVerifiedProduct(product);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.productCard}>
      <View style={styles.productMedia}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons color={Colors.textMuted} name="image-outline" size={18} />
          </View>
        )}
        {isVerified ? (
          <View style={styles.verifiedIconBadge}>
            <Image source={verifiedProductIcon} style={styles.verifiedIconImage} />
          </View>
        ) : null}
      </View>
      <View style={styles.productInfo}>
        <View style={styles.productNameRow}>
          <Text numberOfLines={2} style={styles.productName}>
            {product.name}
          </Text>
        </View>
        <Text style={styles.productType}>
          {FUEL_TYPE_LABELS[product.fuel_type] ?? product.fuel_type}
          {isOwnedByUser ? <Text style={styles.myProductTag}> · Mon produit</Text> : null}
        </Text>
        <View style={styles.productStats}>
          {product.carbs_g != null ? <DataText style={styles.statText}>{product.carbs_g}g glucides</DataText> : null}
          {product.sodium_mg != null ? <DataText style={styles.statText}> · {product.sodium_mg}mg sodium</DataText> : null}
          {!isFavorite && product.calories_kcal != null ? (
            <DataText style={styles.statText}> · {product.calories_kcal} kcal</DataText>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        style={[styles.favButton, isFavorite && styles.favButtonActive]}
      >
        <Ionicons
          color={isFavorite ? Colors.textOnBrand : Colors.brandPrimary}
          name={isFavorite ? 'star' : 'star-outline'}
          size={18}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
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
    marginTop: 14,
    marginBottom: 8,
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
  filterBar: {
    minHeight: 40,
    marginBottom: 12,
    zIndex: 1,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterContent: {
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingRight: 8,
  },
  filterChip: {
    minHeight: 34,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
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
  brandGroup: {
    marginBottom: 14,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  brandHeaderButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  brandHeaderButtonExpanded: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  brandHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  brandVerifiedIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  brandItems: {
    gap: 0,
  },
  brandCountPill: {
    minWidth: 30,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  brandCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
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
  productMedia: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  productImagePlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  productName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  verifiedIconBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  verifiedIconImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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

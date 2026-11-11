import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Field } from '../themed/Field';
import { Text } from '../themed/Text';
import { DataText } from '../themed/DataText';
import { EmptyState } from '../themed/EmptyState';
import { IconAction } from '../themed/IconAction';
import { StatusPill } from '../themed/StatusPill';
import { HeartMark } from '../themed/trail/HeartMark';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileComponents } from '@pace-yourself/design-system';
import { Colors } from '../../constants/colors';
import { PremiumUpsellModal } from '../premium/PremiumUpsellModal';
import { FUEL_FILTERS, FUEL_TYPE_LABELS } from './nutritionConstants';
import { NutritionCreateProductModal } from './NutritionCreateProductModal';
import { ProductDetailModal } from './ProductDetailModal';
import type { FavoriteRow, FuelType, Product, ProductEditDraft, ProductFavoriteUsage } from './types';
import { formatProductDisplayName } from '../../lib/productDisplayName';

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
      brandImageUrl: string | null;
    }
  | {
      type: 'product';
      key: string;
      product: Product;
      brandLabel?: string;
    };

const KNOWN_BRAND_PREFIXES: { match: string; label: string }[] = [
  { match: 'precision fuel & hydration', label: 'Precision Fuel & Hydration' },
  { match: 'precision fuel', label: 'Precision Fuel & Hydration' },
  { match: 'science in sport', label: 'SiS' },
  { match: 'tailwind nutrition', label: 'Tailwind' },
  { match: 'huma chia', label: 'Huma' },
  { match: 'naak', label: 'NAAK' },
  { match: 'maurten', label: 'Maurten' },
  { match: 'neversecond', label: 'Neversecond' },
  { match: 'overstims', label: 'Overstims' },
  { match: 'overstim', label: 'Overstims' },
  { match: 'powerbar', label: 'Powerbar' },
  { match: 'tailwind', label: 'Tailwind' },
  { match: 'meltonic', label: 'Meltonic' },
  { match: 'mulebar', label: 'Mulebar' },
  { match: 'andros', label: 'Andros' },
  { match: 'baouw', label: 'Baouw' },
  { match: 'decat', label: 'Decathlon' },
  { match: 'decathlon', label: 'Decathlon' },
  { match: 'aptonia', label: 'Aptonia' },
  { match: 'nduranz', label: 'Nduranz' },
  { match: 'nrgy', label: 'NRGY' },
  { match: 'clif', label: 'Clif' },
  { match: 'high5', label: 'HIGH5' },
  { match: 'sis', label: 'SiS' },
  { match: 'gu', label: 'GU' },
];

const GENERIC_BRAND_TOKENS = new Set([
  'bar',
  'barre',
  'boisson',
  'capsule',
  'capsules',
  'compote',
  'concentre',
  'decathlon',
  'drink',
  'electrolyte',
  'energy',
  'food',
  'fuel',
  'gel',
  'gels',
  'iso',
  'lait',
  'mix',
  'nutrition',
  'oats',
  'other',
  'pate',
  'product',
]);

function normalizeBrandSource(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findKnownNutritionBrand(value: string) {
  const normalizedSource = normalizeBrandSource(value);

  for (const brand of KNOWN_BRAND_PREFIXES) {
    if (
      normalizedSource === brand.match.trim() ||
      normalizedSource.startsWith(`${brand.match} `) ||
      normalizedSource.includes(` ${brand.match} `) ||
      normalizedSource.endsWith(` ${brand.match}`)
    ) {
      return brand.label;
    }
  }

  return null;
}

function inferNutritionBrand(product: Pick<Product, 'name' | 'brand'>, fallbackLabel: string) {
  const explicitBrand = product.brand?.trim();
  if (explicitBrand) {
    const knownBrand = findKnownNutritionBrand(explicitBrand);
    if (knownBrand) {
      return knownBrand;
    }

    const explicitTokens = normalizeBrandSource(explicitBrand).split(/\s+/).filter(Boolean);
    const looksLikeProductName =
      explicitTokens.length > 3 ||
      explicitTokens.some(
        (token) => GENERIC_BRAND_TOKENS.has(token) || /^\d/.test(token),
      );

    if (!looksLikeProductName) {
      return explicitBrand;
    }
  }

  const productName = product.name;
  const fromDelimiter = productName.split(' - ')[0]?.trim();
  const source = fromDelimiter || productName.trim();
  return findKnownNutritionBrand(source) ?? fallbackLabel;
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

  const normalizedGroups = Array.from(groups.entries())
    .map(([brandLabel, groupedItems]) => ({
      brandLabel,
      items: groupedItems,
    }));
  const consolidatedOther = normalizedGroups.flatMap((group) => (
    group.items.length === 1 && !isVerifiedProduct(getProduct(group.items[0])) ? group.items : []
  ));
  const visibleGroups = normalizedGroups.filter((group) => !(
    group.items.length === 1 && !isVerifiedProduct(getProduct(group.items[0]))
  ));
  if (consolidatedOther.length > 0) {
    const existingOther = visibleGroups.find((group) => group.brandLabel === fallbackLabel);
    if (existingOther) existingOther.items.push(...consolidatedOther);
    else visibleGroups.push({ brandLabel: fallbackLabel, items: consolidatedOther });
  }

  return visibleGroups.sort((left, right) => {
    if (left.brandLabel === fallbackLabel) return 1;
    if (right.brandLabel === fallbackLabel) return -1;
    const leftVerified = left.items.some((item) => isVerifiedProduct(getProduct(item)));
    const rightVerified = right.items.some((item) => isVerifiedProduct(getProduct(item)));
    if (leftVerified !== rightVerified) return leftVerified ? -1 : 1;
    return left.brandLabel.localeCompare(right.brandLabel);
  });
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
      brandImageUrl:
        group.items.find((product) => isVerifiedProduct(product) && product.image_url)?.image_url ??
        null,
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
  contentTopInset?: number;
  locale: 'fr' | 'en';
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
  newBrand: string;
  availableBrands: string[];
  newFuelType: FuelType;
  newCarbsG: string;
  newSodiumMg: string;
  newCaloriesKcal: string;
  newImageDraft: { uri: string; name: string } | null;
  selectedProduct: Product | null;
  selectedProductFavoriteUsage: ProductFavoriteUsage;
  savingProduct: boolean;
  deletingProduct: boolean;
  favoriteLimitBannerLabel: string;
  favoriteLimitMessage: string;
  emptyCatalogTitle: string;
  emptyCatalogDescription: string;
  refreshing: boolean;
  freeAccessTitle: string;
  otherBrandsLabel: string;
  verifiedLabel: string;
  onToggleFavorites: () => void;
  onToggleFavorite: (productId: string, productOverride?: Product) => void;
  onChangeFuelFilter: (value: FuelType | 'all') => void;
  onChangeCatalogSearch: (value: string) => void;
  onCloseFavoriteLimitModal: () => void;
  onChangeNewName: (value: string) => void;
  onChangeNewBrand: (value: string) => void;
  onChangeNewFuelType: (value: FuelType) => void;
  onChangeNewCarbsG: (value: string) => void;
  onChangeNewSodiumMg: (value: string) => void;
  onChangeNewCaloriesKcal: (value: string) => void;
  onPickNewImage: () => void;
  onRemoveNewImage: () => void;
  onRefresh: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSubmitCreateProduct: () => void;
  onCancelCreateProduct: () => void;
  onOpenProductDetail: (product: Product) => void;
  onCloseProductDetail: () => void;
  onUpdateProduct: (draft: ProductEditDraft) => Promise<boolean>;
  onDeleteSelectedProduct: () => void;
};

export const NutritionContent = memo(function NutritionContent({
  contentTopInset = 0,
  locale,
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
  newBrand,
  availableBrands,
  newFuelType,
  newCarbsG,
  newSodiumMg,
  newCaloriesKcal,
  newImageDraft,
  selectedProduct,
  selectedProductFavoriteUsage,
  savingProduct,
  deletingProduct,
  favoriteLimitBannerLabel,
  favoriteLimitMessage,
  emptyCatalogTitle,
  emptyCatalogDescription,
  refreshing,
  freeAccessTitle,
  otherBrandsLabel,
  verifiedLabel,
  onToggleFavorites,
  onToggleFavorite,
  onChangeFuelFilter,
  onChangeCatalogSearch,
  onCloseFavoriteLimitModal,
  onChangeNewName,
  onChangeNewBrand,
  onChangeNewFuelType,
  onChangeNewCarbsG,
  onChangeNewSodiumMg,
  onChangeNewCaloriesKcal,
  onPickNewImage,
  onRemoveNewImage,
  onRefresh,
  onScroll,
  onSubmitCreateProduct,
  onCancelCreateProduct,
  onOpenProductDetail,
  onCloseProductDetail,
  onUpdateProduct,
  onDeleteSelectedProduct,
}: NutritionContentProps) {
  const [expandedCatalogBrands, setExpandedCatalogBrands] = useState<Set<string>>(() => new Set());
  const flatCatalogActive = catalogSearch.trim().length > 0 || fuelFilter !== 'all';
  const favoriteGroups = useMemo(
    () => groupItemsByBrand(favorites, (favorite) => favorite.products, otherBrandsLabel),
    [favorites, otherBrandsLabel],
  );
  const catalogGroups = useMemo(
    () => groupItemsByBrand(filteredProducts, (product) => product, otherBrandsLabel),
    [filteredProducts, otherBrandsLabel],
  );
  const catalogRows = useMemo(
    () => flatCatalogActive
      ? filteredProducts.map((product) => ({
          type: 'product' as const,
          key: `product-${product.id}`,
          product,
          brandLabel: inferNutritionBrand(product, otherBrandsLabel),
        }))
      : buildCatalogRows(catalogGroups, expandedCatalogBrands, false),
    [catalogGroups, expandedCatalogBrands, filteredProducts, flatCatalogActive, otherBrandsLabel],
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
          <Text style={[styles.sectionTitle, styles.sectionTitleCompact]}>Mes favoris ({favorites.length})</Text>
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
                    <Text style={styles.brandTitle}>
                      {group.brandLabel}
                    </Text>
                    {group.items.some((favorite) => isVerifiedProduct(favorite.products)) ? (
                      <StatusPill label={verifiedLabel} tone="success" />
                    ) : null}
                    <View style={styles.brandHeaderActions}>
                      <StatusPill label={String(group.items.length)} />
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

        <Field
          accessibilityLabel="Rechercher un produit"
          containerStyle={styles.catalogSearchField}
          onChangeText={onChangeCatalogSearch}
          placeholder="Rechercher un produit..."
          value={catalogSearch}
          variant="search"
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
                accessibilityRole="button"
                accessibilityState={{ selected: fuelFilter === type }}
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
      verifiedLabel,
    ],
  );

  const renderCatalogRow = useCallback(
    ({ item }: ListRenderItemInfo<CatalogListRow>) => {
      if (item.type === 'brand') {
        return (
          <TouchableOpacity
            accessibilityHint={
              flatCatalogActive
                ? undefined
                : item.expanded
                  ? 'Replier cette marque'
                  : 'Afficher les produits de cette marque'
            }
            accessibilityLabel={`${item.brandLabel}, ${item.count} produits`}
            accessibilityRole="button"
            activeOpacity={flatCatalogActive ? 1 : 0.75}
            disabled={flatCatalogActive}
            onPress={() => toggleCatalogBrand(item.brandLabel)}
            style={[styles.brandHeaderButton, item.expanded && styles.brandHeaderButtonExpanded]}
          >
            <View style={styles.brandTitleRow}>
              {item.brandImageUrl ? (
                <Image source={{ uri: item.brandImageUrl }} style={styles.brandImage} />
              ) : (
                <View style={styles.brandImageFallback}>
                  <Text style={styles.brandInitial}>{item.brandLabel.slice(0, 1).toLocaleUpperCase(locale)}</Text>
                </View>
              )}
              <View style={styles.brandTitleText}>
                <Text numberOfLines={1} style={styles.brandTitle}>
                  {item.brandLabel}
                </Text>
                {item.hasVerifiedProduct ? (
                  <StatusPill label={verifiedLabel} style={styles.verifiedBrandBadge} tone="success" />
                ) : null}
              </View>
            </View>
            <View style={styles.brandHeaderActions}>
              <Text style={styles.brandCountText}>
                {item.count}{' '}
                {locale === 'fr'
                  ? item.count > 1 ? 'produits' : 'produit'
                  : item.count > 1 ? 'products' : 'product'}
              </Text>
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
          brandLabel={item.brandLabel}
          nested={!flatCatalogActive}
        />
      );
    },
    [
      flatCatalogActive,
      favoriteIds,
      locale,
      onOpenProductDetail,
      onToggleFavorite,
      toggleCatalogBrand,
      userId,
      verifiedLabel,
    ],
  );

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: contentTopInset + 16 }]}
        contentInsetAdjustmentBehavior="never"
        data={catalogRows}
        extraData={favoriteIds}
        initialNumToRender={18}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            progressViewOffset={contentTopInset}
            refreshing={refreshing}
            tintColor={Colors.brandPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            description={emptyCatalogDescription}
            icon={<Ionicons color={Colors.brandPrimary} name="nutrition-outline" size={32} />}
            style={styles.emptyCategory}
            title={emptyCatalogTitle}
          />
        }
        ListHeaderComponent={listHeader}
        maxToRenderPerBatch={14}
        removeClippedSubviews
        renderItem={renderCatalogRow}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        updateCellsBatchingPeriod={32}
        windowSize={7}
      />

      <PremiumUpsellModal
        message={favoriteLimitMessage}
        onClose={onCloseFavoriteLimitModal}
        placement="favorite_limit"
        title={freeAccessTitle}
        visible={showFavoriteLimitModal}
      />

      <NutritionCreateProductModal
        caloriesKcal={newCaloriesKcal}
        brand={newBrand}
        brandOptions={availableBrands}
        carbsG={newCarbsG}
        creating={creating}
        fuelType={newFuelType}
        imageName={newImageDraft?.name ?? null}
        imagePreviewUri={newImageDraft?.uri ?? null}
        name={newName}
        onCancel={onCancelCreateProduct}
        onChangeCaloriesKcal={onChangeNewCaloriesKcal}
        onChangeBrand={onChangeNewBrand}
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
        favoriteUsage={
          isAdmin && selectedProductFavoriteUsage.productId === selectedProduct?.id
            ? selectedProductFavoriteUsage
            : null
        }
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
  nested = false,
  brandLabel,
}: {
  product: Product;
  isFavorite: boolean;
  isOwnedByUser: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  nested?: boolean;
  brandLabel?: string;
}) {
  const isVerified = isVerifiedProduct(product);
  const nutritionStats = [
    product.carbs_g != null ? `${product.carbs_g}g glucides` : null,
    product.sodium_mg != null ? `${product.sodium_mg}mg sodium` : null,
    product.calories_kcal != null ? `${product.calories_kcal} kcal` : null,
  ].filter((value): value is string => value !== null);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.productCard, nested && styles.productCardNested]}
    >
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
            {formatProductDisplayName(product.name)}
          </Text>
        </View>
        <Text style={styles.productType}>
          {brandLabel ? `${brandLabel} · ` : ''}
          {FUEL_TYPE_LABELS[product.fuel_type] ?? product.fuel_type}
          {isOwnedByUser ? <Text style={styles.myProductTag}> · Mon produit</Text> : null}
        </Text>
        {nutritionStats.length > 0 ? (
          <DataText numberOfLines={1} style={styles.statText}>
            {nutritionStats.join(' · ')}
          </DataText>
        ) : null}
      </View>

      <IconAction
        accessibilityLabel={`${isFavorite ? 'Retirer' : 'Ajouter'} ${product.name} ${isFavorite ? 'des' : 'aux'} favoris`}
        accessibilityState={{ selected: isFavorite }}
        icon={<HeartMark filled={isFavorite} size={22} />}
        onPress={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        style={styles.favButton}
        tone="brand"
      />
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
    paddingVertical: 48,
  },
  emptyFavText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  catalogSearchField: {
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
    minHeight: mobileComponents.filterChip.minHeight,
    backgroundColor: Colors.surface,
    paddingHorizontal: mobileComponents.filterChip.paddingHorizontal,
    paddingVertical: 7,
    borderRadius: mobileComponents.filterChip.borderRadius,
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
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  brandTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitleText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  brandImage: {
    width: 48,
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.surfaceSecondary,
    resizeMode: 'contain',
  },
  brandImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
  },
  brandInitial: {
    color: Colors.brandPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  brandTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  verifiedBrandBadge: {
    marginTop: 4,
  },
  brandItems: {
    gap: 0,
  },
  brandCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  productCard: {
    position: 'relative',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 64,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  productCardNested: {
    marginLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brandBorder,
  },
  productMedia: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
  },
  productImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 48,
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
  statText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  favButton: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
});

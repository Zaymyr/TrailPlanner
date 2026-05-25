import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import type { PlanProduct } from './contracts';
import { styles } from './styles';

const verifiedProductIcon = require('../../assets/verified-product.png');

export type PickerProduct = PlanProduct;

type Props = {
  visible: boolean;
  pickerSearch: string;
  setPickerSearch: (value: string) => void;
  pickerSort: 'name' | 'carbs' | 'sodium';
  setPickerSort: (value: 'name' | 'carbs' | 'sodium') => void;
  productsLoading: boolean;
  pickerFavorites: PickerProduct[];
  filteredAllProducts: PickerProduct[];
  currentSupplyIds: Set<string>;
  fuelLabels: Record<string, string>;
  onClose: () => void;
  onAddProduct: (product: PickerProduct) => void;
};

const FALLBACK_BRAND_LABEL = 'Autres marques';
const GENERIC_BRAND_TOKENS = new Set(['barre', 'barres', 'boisson', 'drink', 'gel', 'gels', 'mix', 'pate', 'pates']);

function inferProductBrand(product: PickerProduct) {
  const explicitBrand = product.brand?.trim();
  if (explicitBrand) return explicitBrand;

  const firstToken = product.name
    .split(/\s+/)
    .map((part) => part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .find(Boolean);
  const token = firstToken?.toLowerCase();

  return firstToken && firstToken.length > 2 && !GENERIC_BRAND_TOKENS.has(token ?? '')
    ? firstToken
    : FALLBACK_BRAND_LABEL;
}

function groupProductsByBrand(products: PickerProduct[], titlePrefix?: string) {
  const groups = products.reduce((map, product) => {
    const brand = inferProductBrand(product);
    const current = map.get(brand) ?? [];
    current.push(product);
    map.set(brand, current);
    return map;
  }, new Map<string, PickerProduct[]>());

  return Array.from(groups.entries())
    .map(([brand, data]) => ({
      title: titlePrefix ? `${titlePrefix} · ${brand}` : brand,
      data,
    }))
    .sort((left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }));
}

function isVerifiedProduct(product: PickerProduct) {
  return product.created_by === null;
}

export const ProductPickerModal = React.memo(function ProductPickerModal({
  visible,
  pickerSearch,
  setPickerSearch,
  pickerSort,
  setPickerSort,
  productsLoading,
  pickerFavorites,
  filteredAllProducts,
  currentSupplyIds,
  fuelLabels,
  onClose,
  onAddProduct,
}: Props) {
  const sortOptions: Array<{ key: 'name' | 'carbs' | 'sodium'; label: string }> = [
    { key: 'name', label: 'Nom' },
    { key: 'carbs', label: 'Glucides' },
    { key: 'sodium', label: 'Sodium' },
  ];

  const renderPickerRow = useCallback(({ item: product }: { item: PickerProduct }) => {
    const added = currentSupplyIds.has(product.id);
    const carbs = Math.round(product.carbs_g ?? 0);
    const sodium = Math.round(product.sodium_mg ?? 0);
    const verified = isVerifiedProduct(product);
    return (
      <View style={styles.pickerRow}>
        <View style={styles.pickerProductImageFrame}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.pickerProductImage} />
          ) : (
            <View style={styles.pickerProductImagePlaceholder}>
              <Ionicons color={Colors.textMuted} name="image-outline" size={18} />
            </View>
          )}
          {verified ? (
            <View style={styles.pickerVerifiedBadge}>
              <Image source={verifiedProductIcon} style={styles.pickerVerifiedBadgeImage} />
            </View>
          ) : null}
        </View>
        <View style={styles.pickerRowInfo}>
          <Text style={styles.pickerRowName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.pickerRowType}>{fuelLabels[product.fuel_type] ?? product.fuel_type.toUpperCase()}</Text>
          <Text style={styles.pickerRowMeta}>
            {carbs}g glucides · {sodium}mg sodium
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.pickerAddBtn, added && styles.pickerAddBtnDone]}
          onPress={() => {
            if (!added) onAddProduct(product);
          }}
          disabled={added}
        >
          <Text style={[styles.pickerAddBtnText, added && styles.pickerAddBtnTextDone]}>{added ? '✓ Ajouté' : '+ Ajouter'}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [currentSupplyIds, fuelLabels, onAddProduct]);

  const sections = useMemo(() => {
    const favoriteIds = new Set(pickerFavorites.map((product) => product.id));
    const catalogProducts = filteredAllProducts.filter((product) => !favoriteIds.has(product.id));
    return [
      ...groupProductsByBrand(pickerFavorites, 'Mes favoris'),
      ...groupProductsByBrand(catalogProducts),
    ];
  }, [pickerFavorites, filteredAllProducts]);

  const renderSectionHeader = useCallback(({ section: { title } }: { section: { title: string } }) => (
    <Text style={styles.pickerSectionTitle}>{title}</Text>
  ), []);

  const keyExtractor = useCallback((item: PickerProduct) => item.id, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choisir un produit</Text>
            <TouchableOpacity onPress={onClose} style={styles.pickerCloseBtn}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.pickerSearchInput}
            value={pickerSearch}
            onChangeText={setPickerSearch}
            placeholder="Rechercher un produit ou une marque..."
            placeholderTextColor={Colors.textMuted}
            autoCorrect={false}
          />

          <View style={styles.pickerSortRow}>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.pickerSortBtn, pickerSort === option.key && styles.pickerSortBtnActive]}
                onPress={() => setPickerSort(option.key)}
              >
                <Text style={[styles.pickerSortBtnText, pickerSort === option.key && styles.pickerSortBtnTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {productsLoading ? (
            <ActivityIndicator color={Colors.brandPrimary} style={{ marginTop: 24 }} />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={keyExtractor}
              renderItem={renderPickerRow}
              renderSectionHeader={renderSectionHeader}
              ListEmptyComponent={<Text style={styles.pickerEmpty}>Aucun produit trouvé.</Text>}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

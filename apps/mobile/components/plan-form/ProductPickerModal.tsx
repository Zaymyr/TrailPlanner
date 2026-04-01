import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, SectionList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { PlanProduct } from './contracts';
import { styles } from './styles';

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
    return (
      <View style={styles.pickerRow}>
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
    const result: Array<{ title: string; data: PickerProduct[] }> = [];
    if (pickerFavorites.length > 0) {
      result.push({ title: 'Mes favoris', data: pickerFavorites });
    }
    result.push({ title: 'Tous les produits', data: filteredAllProducts });
    return result;
  }, [pickerFavorites, filteredAllProducts]);

  const renderSectionHeader = useCallback(({ section: { title } }: { section: { title: string } }) => (
    <Text style={styles.pickerSectionTitle}>{title}</Text>
  ), []);

  const renderSectionFooter = useCallback(({ section }: { section: { title: string; data: PickerProduct[] } }) => {
    if (section.title === 'Tous les produits' && section.data.length === 0) {
      return <Text style={styles.pickerEmpty}>Aucun produit trouvé.</Text>;
    }
    return null;
  }, []);

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
            placeholder="Rechercher..."
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
              renderSectionFooter={renderSectionFooter}
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

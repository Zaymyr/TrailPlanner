import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export function ProductPickerModal({
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

  const renderPickerRow = (product: PickerProduct) => {
    const added = currentSupplyIds.has(product.id);
    const carbs = Math.round(product.carbs_g ?? 0);
    const sodium = Math.round(product.sodium_mg ?? 0);
    return (
      <View key={product.id} style={styles.pickerRow}>
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
  };

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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {pickerFavorites.length > 0 && (
                <>
                  <Text style={styles.pickerSectionTitle}>Mes favoris</Text>
                  {pickerFavorites.map(renderPickerRow)}
                </>
              )}
              <Text style={styles.pickerSectionTitle}>Tous les produits</Text>
              {filteredAllProducts.length === 0 ? (
                <Text style={styles.pickerEmpty}>Aucun produit trouvé.</Text>
              ) : (
                filteredAllProducts.map(renderPickerRow)
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

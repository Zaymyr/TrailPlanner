import { memo, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';
import { FUEL_TYPE_LABELS, FUEL_TYPE_OPTIONS } from './nutritionConstants';
import type { FuelType, Product, ProductEditDraft, ProductImageDraft } from './types';

type ProductDetailModalProps = {
  canManage: boolean;
  deleting: boolean;
  isFavorite: boolean;
  product: Product | null;
  saving: boolean;
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (draft: ProductEditDraft) => Promise<boolean>;
  onToggleFavorite: () => void;
};

function formatNumberInput(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

export const ProductDetailModal = memo(function ProductDetailModal({
  canManage,
  deleting,
  isFavorite,
  product,
  saving,
  visible,
  onClose,
  onDelete,
  onSave,
  onToggleFavorite,
}: ProductDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gel');
  const [carbsG, setCarbsG] = useState('');
  const [sodiumMg, setSodiumMg] = useState('');
  const [caloriesKcal, setCaloriesKcal] = useState('');
  const [imageDraft, setImageDraft] = useState<ProductImageDraft | null>(null);

  useEffect(() => {
    if (!product || !visible) return;

    setIsEditing(false);
    setImageDraft(null);
    setName(product.name);
    setBrand(product.brand ?? '');
    setFuelType(product.fuel_type);
    setCarbsG(formatNumberInput(product.carbs_g));
    setSodiumMg(formatNumberInput(product.sodium_mg));
    setCaloriesKcal(formatNumberInput(product.calories_kcal));
  }, [product, visible]);

  const draft = useMemo<ProductEditDraft>(
    () => ({
      name,
      brand,
      fuelType,
      carbsG,
      sodiumMg,
      caloriesKcal,
      imageDraft,
    }),
    [brand, caloriesKcal, carbsG, fuelType, imageDraft, name, sodiumMg],
  );

  const hasChanges = useMemo(() => {
    if (!product) return false;

    return (
      name.trim() !== product.name ||
      brand.trim() !== (product.brand ?? '') ||
      fuelType !== product.fuel_type ||
      carbsG.trim() !== formatNumberInput(product.carbs_g) ||
      sodiumMg.trim() !== formatNumberInput(product.sodium_mg) ||
      caloriesKcal.trim() !== formatNumberInput(product.calories_kcal) ||
      imageDraft !== null
    );
  }, [brand, caloriesKcal, carbsG, fuelType, imageDraft, name, product, sodiumMg]);

  const currentProduct = product;

  if (!currentProduct) {
    return null;
  }

  const busy = saving || deleting;
  const editable = canManage && isEditing && !busy;
  const accessLabel = canManage ? 'Modifiable' : 'Lecture seule';
  const isVerified = currentProduct.created_by === null;
  const imagePreviewUri = imageDraft?.uri ?? currentProduct.image_url ?? null;

  async function handleSave() {
    const saved = await onSave(draft);
    if (saved) {
      setIsEditing(false);
    }
  }

  function handleCancelEdit() {
    if (!currentProduct) return;

    setName(currentProduct.name);
    setBrand(currentProduct.brand ?? '');
    setFuelType(currentProduct.fuel_type);
    setCarbsG(formatNumberInput(currentProduct.carbs_g));
    setSodiumMg(formatNumberInput(currentProduct.sodium_mg));
    setCaloriesKcal(formatNumberInput(currentProduct.calories_kcal));
    setImageDraft(null);
    setIsEditing(false);
  }

  async function handlePickImage() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const extension = asset.name?.split('.').pop()?.toLowerCase();
    const fallbackMimeType =
      extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'avif'
            ? 'image/avif'
            : extension === 'jpg' || extension === 'jpeg'
              ? 'image/jpeg'
              : '';
    const mimeType = asset.mimeType ?? fallbackMimeType;

    if (!mimeType.startsWith('image/')) {
      Alert.alert('Format invalide', 'Choisis une image JPEG, PNG, WebP ou AVIF.');
      return;
    }

    if ((asset.size ?? 0) > 5 * 1024 * 1024) {
      Alert.alert('Image trop lourde', "L'image doit faire moins de 5 Mo.");
      return;
    }

    setImageDraft({
      uri: asset.uri,
      name: asset.name ?? `product-${Date.now()}.jpg`,
      mimeType,
      size: asset.size ?? null,
    });
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
      >
        <Pressable disabled={busy} onPress={onClose} style={styles.modalOverlay} />
        <View style={styles.modalSheet}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.modalTitle}>Fiche produit</Text>
              {isVerified ? (
                <View style={styles.verifiedPill}>
                  <Ionicons color={Colors.brandPrimary} name="checkmark-circle" size={13} />
                  <Text style={styles.verifiedPillText}>Validé</Text>
                </View>
              ) : null}
              <View style={[styles.accessPill, canManage ? styles.accessPillEdit : styles.accessPillRead]}>
                <Text style={[styles.accessPillText, canManage ? styles.accessTextEdit : styles.accessTextRead]}>
                  {accessLabel}
                </Text>
              </View>
            </View>

            <TouchableOpacity disabled={busy} onPress={onClose} style={styles.closeButton}>
              <Ionicons color={Colors.textSecondary} name="close" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageFrame}>
              {imagePreviewUri ? (
                <Image source={{ uri: imagePreviewUri }} style={styles.productImage} />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <Ionicons color={Colors.textMuted} name="image-outline" size={26} />
                </View>
              )}
            </View>

            {editable ? (
              <View style={styles.imageActions}>
                <TouchableOpacity disabled={busy} onPress={() => void handlePickImage()} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>
                    {imagePreviewUri ? "Changer l'image" : 'Ajouter une image'}
                  </Text>
                </TouchableOpacity>

                {imageDraft ? (
                  <TouchableOpacity disabled={busy} onPress={() => setImageDraft(null)} style={styles.imageGhostButton}>
                    <Text style={styles.imageGhostButtonText}>Annuler image</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Nom</Text>
              <TextInput
                editable={editable}
                onChangeText={setName}
                placeholder="Nom du produit"
                placeholderTextColor={Colors.textMuted}
                style={[styles.textInput, !editable && styles.textInputReadOnly]}
                value={name}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Marque</Text>
              <TextInput
                editable={editable}
                onChangeText={setBrand}
                placeholder="Marque"
                placeholderTextColor={Colors.textMuted}
                style={[styles.textInput, !editable && styles.textInputReadOnly]}
                value={brand}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Type</Text>
              {isEditing && canManage ? (
                <ScrollView
                  contentContainerStyle={styles.typeContent}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.typeScroll}
                >
                  {FUEL_TYPE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      disabled={busy}
                      key={option}
                      onPress={() => setFuelType(option)}
                      style={[styles.typeChip, fuelType === option && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, fuelType === option && styles.typeChipTextActive]}>
                        {FUEL_TYPE_LABELS[option]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.readOnlyValue}>
                  <Text style={styles.readOnlyValueText}>{FUEL_TYPE_LABELS[currentProduct.fuel_type]}</Text>
                </View>
              )}
            </View>

            <View style={styles.nutritionGrid}>
              <View style={styles.metricField}>
                <Text style={styles.inputLabel}>Glucides (g)</Text>
                <TextInput
                  editable={editable}
                  keyboardType="decimal-pad"
                  onChangeText={setCarbsG}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.textInput, styles.metricInput, !editable && styles.textInputReadOnly]}
                  value={carbsG}
                />
              </View>

              <View style={styles.metricField}>
                <Text style={styles.inputLabel}>Sodium (mg)</Text>
                <TextInput
                  editable={editable}
                  keyboardType="decimal-pad"
                  onChangeText={setSodiumMg}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.textInput, styles.metricInput, !editable && styles.textInputReadOnly]}
                  value={sodiumMg}
                />
              </View>

              <View style={styles.metricField}>
                <Text style={styles.inputLabel}>Kcal</Text>
                <TextInput
                  editable={editable}
                  keyboardType="decimal-pad"
                  onChangeText={setCaloriesKcal}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.textInput, styles.metricInput, !editable && styles.textInputReadOnly]}
                  value={caloriesKcal}
                />
              </View>
            </View>

            <TouchableOpacity
              disabled={busy}
              onPress={onToggleFavorite}
              style={[styles.favoriteAction, isFavorite && styles.favoriteActionActive]}
            >
              <Ionicons
                color={isFavorite ? Colors.textOnBrand : Colors.brandPrimary}
                name={isFavorite ? 'star' : 'star-outline'}
                size={18}
              />
              <Text style={[styles.favoriteActionText, isFavorite && styles.favoriteActionTextActive]}>
                {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Text>
            </TouchableOpacity>

            {canManage ? (
              isEditing ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={handleCancelEdit}
                    style={[styles.secondaryButton, busy && styles.disabledButton]}
                  >
                    <Text style={styles.secondaryButtonText}>Annuler</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={busy || !hasChanges}
                    onPress={() => void handleSave()}
                    style={[styles.primaryButton, (busy || !hasChanges) && styles.disabledButton]}
                  >
                    {saving ? (
                      <ActivityIndicator color={Colors.textOnBrand} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionsRow}>
                  <TouchableOpacity disabled={busy} onPress={() => setIsEditing(true)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Modifier</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={busy}
                    onPress={onDelete}
                    style={[styles.deleteButton, busy && styles.disabledButton]}
                  >
                    {deleting ? (
                      <ActivityIndicator color={Colors.danger} />
                    ) : (
                      <Text style={styles.deleteButtonText}>Supprimer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <Text style={styles.readOnlyHint}>
                Tu peux consulter ce produit, mais seuls son createur et les admins peuvent le modifier.
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    maxHeight: '92%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  verifiedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verifiedPillText: {
    color: Colors.brandPrimary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  accessPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  accessPillEdit: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  accessPillRead: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.border,
  },
  accessPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  accessTextEdit: {
    color: Colors.brandPrimary,
  },
  accessTextRead: {
    color: Colors.textMuted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  content: {
    gap: 12,
    paddingBottom: 10,
  },
  imageFrame: {
    height: 164,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 10,
  },
  imageButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  imageButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  imageGhostButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  imageGhostButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textInputReadOnly: {
    backgroundColor: Colors.surface,
    color: Colors.textSecondary,
  },
  readOnlyValue: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readOnlyValueText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  typeScroll: {
    flexGrow: 0,
  },
  typeContent: {
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingRight: 8,
  },
  typeChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  typeChipActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  typeChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: Colors.textOnBrand,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricField: {
    flex: 1,
    minWidth: 92,
    gap: 6,
  },
  metricInput: {
    textAlign: 'center',
  },
  favoriteAction: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  favoriteActionActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  favoriteActionText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  favoriteActionTextActive: {
    color: Colors.textOnBrand,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '800',
  },
  deleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
  readOnlyHint: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

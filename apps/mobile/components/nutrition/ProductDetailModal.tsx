import { memo, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';

import { Colors } from '../../constants/colors';
import { DataText } from '../themed/DataText';
import { ActionButton } from '../themed/ActionButton';
import { Field } from '../themed/Field';
import { IconAction } from '../themed/IconAction';
import { SheetHeader } from '../themed/SheetHeader';
import { StatusPill } from '../themed/StatusPill';
import { HeartMark } from '../themed/trail/HeartMark';
import { Text } from '../themed/Text';
import { FUEL_TYPE_LABELS, FUEL_TYPE_OPTIONS } from './nutritionConstants';
import type { FuelType, Product, ProductEditDraft, ProductFavoriteUsage, ProductImageDraft } from './types';

const verifiedProductIcon = require('../../assets/verified-product.png');

type ProductDetailModalProps = {
  canManage: boolean;
  deleting: boolean;
  favoriteUsage?: ProductFavoriteUsage | null;
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
  favoriteUsage,
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
  const isVerified = currentProduct.is_official === true;
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
        <View accessibilityViewIsModal style={styles.modalSheet}>
          <SheetHeader
            closeDisabled={busy}
            closeLabel="Fermer"
            onClose={onClose}
            style={styles.header}
            title="Fiche produit"
            trailing={<StatusPill label={accessLabel} tone={canManage ? 'brand' : 'neutral'} />}
          />

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
              {isVerified ? (
                <View style={styles.verifiedImageBadge}>
                  <Image source={verifiedProductIcon} style={styles.verifiedImageBadgeIcon} />
                </View>
              ) : null}
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
              <Field
                editable={editable}
                label="Nom"
                onChangeText={setName}
                placeholder="Nom du produit"
                value={name}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Field
                editable={editable}
                label="Marque"
                onChangeText={setBrand}
                placeholder="Marque"
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
                <Field
                  editable={editable}
                  inputAccessoryViewID="pace-yourself-numeric-keyboard"
                  keyboardType="decimal-pad"
                  label="Glucides"
                  onChangeText={setCarbsG}
                  placeholder="0"
                  unit="g"
                  value={carbsG}
                />
              </View>

              <View style={styles.metricField}>
                <Field
                  editable={editable}
                  inputAccessoryViewID="pace-yourself-numeric-keyboard"
                  keyboardType="decimal-pad"
                  label="Sodium"
                  onChangeText={setSodiumMg}
                  placeholder="0"
                  unit="mg"
                  value={sodiumMg}
                />
              </View>

              <View style={styles.metricField}>
                <Field
                  editable={editable}
                  inputAccessoryViewID="pace-yourself-numeric-keyboard"
                  keyboardType="decimal-pad"
                  label="Kcal"
                  onChangeText={setCaloriesKcal}
                  placeholder="0"
                  value={caloriesKcal}
                />
              </View>
            </View>

            {favoriteUsage ? (
              <View style={styles.adminUsageBox}>
                <View style={styles.adminUsageIcon}>
                  <Ionicons color={Colors.brandPrimary} name="people-outline" size={18} />
                </View>
                <View style={styles.adminUsageBody}>
                  <Text style={styles.adminUsageTitle}>Favoris utilisateurs</Text>
                  {favoriteUsage.loading ? (
                    <Text style={styles.adminUsageText}>Chargement...</Text>
                  ) : favoriteUsage.error ? (
                    <Text style={[styles.adminUsageText, styles.adminUsageError]}>
                      Usage indisponible pour le moment.
                    </Text>
                  ) : (favoriteUsage.count ?? 0) === 0 ? (
                    <Text style={styles.adminUsageText}>Aucun utilisateur ne l'a en favori.</Text>
                  ) : (
                    <View style={styles.adminUsageCountRow}>
                      <DataText style={styles.adminUsageCount}>{favoriteUsage.count ?? 0}</DataText>
                      <Text style={styles.adminUsageText}>
                        {(favoriteUsage.count ?? 0) > 1
                          ? 'utilisateurs ont ce produit en favori'
                          : 'utilisateur a ce produit en favori'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            <View style={styles.favoriteAction}>
              <IconAction
                accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                accessibilityState={{ selected: isFavorite }}
                disabled={busy}
                icon={<HeartMark filled={isFavorite} size={22} />}
                onPress={onToggleFavorite}
                tone="brand"
              />
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.favoriteActionText}
              >
                {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Text>
            </View>

            {canManage ? (
              isEditing ? (
                <View style={styles.actionsRow}>
                  <ActionButton disabled={busy} onPress={handleCancelEdit} style={styles.actionButton} variant="ghost">
                    Annuler
                  </ActionButton>

                  <ActionButton
                    disabled={busy || !hasChanges}
                    isLoading={saving}
                    onPress={() => void handleSave()}
                    style={styles.actionButton}
                  >
                    Enregistrer
                  </ActionButton>
                </View>
              ) : (
                <View style={styles.actionsRow}>
                  <ActionButton disabled={busy} onPress={() => setIsEditing(true)} style={styles.actionButton}>
                    Modifier
                  </ActionButton>

                  <ActionButton
                    disabled={busy}
                    isLoading={deleting}
                    onPress={onDelete}
                    style={styles.actionButton}
                    variant="destructive-outline"
                  >
                    Supprimer
                  </ActionButton>
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
    paddingTop: 10,
    paddingBottom: 34,
  },
  header: {
    marginBottom: 14,
  },
  content: {
    gap: 12,
    paddingBottom: 10,
  },
  imageFrame: {
    position: 'relative',
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
  verifiedImageBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  verifiedImageBadgeIcon: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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
  adminUsageBox: {
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  adminUsageIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminUsageBody: {
    flex: 1,
    gap: 4,
  },
  adminUsageTitle: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  adminUsageCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  adminUsageCount: {
    color: Colors.brandPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  adminUsageText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  adminUsageError: {
    color: Colors.danger,
  },
  favoriteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  favoriteActionText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
  },
  readOnlyHint: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

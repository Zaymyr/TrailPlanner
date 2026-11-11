import { memo, useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { ActionButton } from '../themed/ActionButton';
import { Field } from '../themed/Field';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import { FUEL_TYPE_OPTIONS, FUEL_TYPE_LABELS } from './nutritionConstants';
import type { FuelType } from './types';

type NutritionCreateProductModalProps = {
  visible: boolean;
  creating: boolean;
  name: string;
  brand: string;
  brandOptions: string[];
  fuelType: FuelType;
  carbsG: string;
  sodiumMg: string;
  caloriesKcal: string;
  imagePreviewUri: string | null;
  imageName: string | null;
  onChangeName: (value: string) => void;
  onChangeBrand: (value: string) => void;
  onSelectFuelType: (value: FuelType) => void;
  onChangeCarbsG: (value: string) => void;
  onChangeSodiumMg: (value: string) => void;
  onChangeCaloriesKcal: (value: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export const NutritionCreateProductModal = memo(function NutritionCreateProductModal({
  visible,
  creating,
  name,
  brand,
  brandOptions,
  fuelType,
  carbsG,
  sodiumMg,
  caloriesKcal,
  imagePreviewUri,
  imageName,
  onChangeName,
  onChangeBrand,
  onSelectFuelType,
  onChangeCarbsG,
  onChangeSodiumMg,
  onChangeCaloriesKcal,
  onPickImage,
  onRemoveImage,
  onSubmit,
  onCancel,
}: NutritionCreateProductModalProps) {
  const [brandFieldFocused, setBrandFieldFocused] = useState(false);
  const normalizedBrand = brand.trim().toLocaleLowerCase();
  const matchingBrandOptions = useMemo(() => {
    return normalizedBrand
      ? brandOptions.filter((option) => option.toLocaleLowerCase().includes(normalizedBrand))
      : brandOptions;
  }, [brandOptions, normalizedBrand]);
  const matchesExistingBrand = brandOptions.some(
    (option) => option.toLocaleLowerCase() === normalizedBrand,
  );

  useEffect(() => {
    if (!visible) {
      setBrandFieldFocused(false);
    }
  }, [visible]);

  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
      >
        <Pressable onPress={onCancel} style={styles.modalOverlay} />
        <View accessibilityViewIsModal style={styles.modalSheet}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text accessibilityRole="header" style={styles.modalTitle}>Créer un produit</Text>

            <Field
              autoCapitalize="words"
              containerStyle={styles.formField}
              label="Nom *"
              onChangeText={onChangeName}
              placeholder="Ex : Gel Maurten 100"
              value={name}
            />

            <Field
              autoCapitalize="words"
              autoCorrect={false}
              containerStyle={styles.formField}
              label="Marque"
              onBlur={() => setBrandFieldFocused(false)}
              onChangeText={onChangeBrand}
              onFocus={() => setBrandFieldFocused(true)}
              placeholder="Choisir ou saisir une marque"
              value={brand}
            />
            {brandFieldFocused && matchingBrandOptions.length > 0 ? (
              <ScrollView
                bounces={false}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={styles.brandSuggestions}
              >
                {matchingBrandOptions.map((option) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={option}
                    onPress={() => {
                      onChangeBrand(option);
                      setBrandFieldFocused(false);
                    }}
                    style={styles.brandSuggestion}
                  >
                    <Text
                      style={[
                        styles.brandSuggestionText,
                        option.toLocaleLowerCase() === normalizedBrand &&
                          styles.brandSuggestionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            {brand.trim() && !matchesExistingBrand ? (
              <Text style={styles.brandCreateHint}>La marque « {brand.trim()} » sera créée.</Text>
            ) : (
              <Text style={styles.brandHint}>Sélectionne une marque existante ou saisis-en une nouvelle.</Text>
            )}

            <Text style={styles.inputLabel}>Image</Text>
            <View style={styles.imageCard}>
              {imagePreviewUri ? (
                <Image source={{ uri: imagePreviewUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Aperçu</Text>
                </View>
              )}
              <View style={styles.imageCopy}>
                <Text style={styles.imageTitle}>{imageName ?? 'Ajoute une photo du produit'}</Text>
                <Text style={styles.imageHint}>JPEG, PNG, WebP ou AVIF, max 5 Mo.</Text>
              </View>
            </View>

            <View style={styles.imageActions}>
              <ActionButton onPress={onPickImage} size="sm" style={styles.imagePickButton} variant="secondary">
                {imagePreviewUri ? "Changer l'image" : 'Choisir une image'}
              </ActionButton>
              {imagePreviewUri ? (
                <ActionButton onPress={onRemoveImage} size="sm" variant="ghost">
                  Retirer
                </ActionButton>
              ) : null}
            </View>

            <Text style={styles.inputLabel}>Type</Text>
            <ScrollView
              contentContainerStyle={styles.filterContent}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
            >
              {FUEL_TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => onSelectFuelType(option)}
                  style={[styles.filterChip, fuelType === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, fuelType === option && styles.filterChipTextActive]}>
                    {FUEL_TYPE_LABELS[option]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.numericRow}>
              <View style={styles.numericField}>
                <Field
                  containerStyle={styles.formField}
                  inputAccessoryViewID="pace-yourself-numeric-keyboard"
                  keyboardType="decimal-pad"
                  label="Glucides"
                  onChangeText={onChangeCarbsG}
                  placeholder="0"
                  unit="g"
                  value={carbsG}
                />
              </View>
              <View style={styles.numericField}>
                <Field
                  containerStyle={styles.formField}
                  inputAccessoryViewID="pace-yourself-numeric-keyboard"
                  keyboardType="decimal-pad"
                  label="Sodium"
                  onChangeText={onChangeSodiumMg}
                  placeholder="0"
                  unit="mg"
                  value={sodiumMg}
                />
              </View>
              <View style={styles.numericField}>
                <Field
                  containerStyle={styles.formField}
                  inputAccessoryViewID="pace-yourself-numeric-keyboard"
                  keyboardType="decimal-pad"
                  label="Kcal"
                  onChangeText={onChangeCaloriesKcal}
                  placeholder="0"
                  value={caloriesKcal}
                />
              </View>
            </View>

            <ActionButton fullWidth isLoading={creating} onPress={onSubmit} style={styles.submitButton}>
              Créer et ajouter aux favoris
            </ActionButton>

            <ActionButton onPress={onCancel} style={styles.cancelButton} variant="ghost">
              Annuler
            </ActionButton>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  formField: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  brandSuggestions: {
    maxHeight: 220,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  brandSuggestion: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  brandSuggestionText: {
    color: Colors.textPrimary,
    fontSize: 15,
  },
  brandSuggestionTextSelected: {
    color: Colors.brandPrimary,
    fontWeight: '700',
  },
  brandHint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  brandCreateHint: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 6,
  },
  imageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 12,
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  imageCopy: {
    flex: 1,
  },
  imageTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  imageHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  imagePickButton: {
    flex: 1,
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
  numericRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  numericField: {
    flex: 1,
  },
  submitButton: {
    marginTop: 24,
  },
  cancelButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
});

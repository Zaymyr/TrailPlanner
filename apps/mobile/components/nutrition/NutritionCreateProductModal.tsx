import { memo } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { FUEL_TYPE_OPTIONS, FUEL_TYPE_LABELS } from './nutritionConstants';
import type { FuelType } from './types';

type NutritionCreateProductModalProps = {
  visible: boolean;
  creating: boolean;
  name: string;
  fuelType: FuelType;
  carbsG: string;
  sodiumMg: string;
  caloriesKcal: string;
  imagePreviewUri: string | null;
  imageName: string | null;
  onChangeName: (value: string) => void;
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
  fuelType,
  carbsG,
  sodiumMg,
  caloriesKcal,
  imagePreviewUri,
  imageName,
  onChangeName,
  onSelectFuelType,
  onChangeCarbsG,
  onChangeSodiumMg,
  onChangeCaloriesKcal,
  onPickImage,
  onRemoveImage,
  onSubmit,
  onCancel,
}: NutritionCreateProductModalProps) {
  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
      >
        <Pressable onPress={onCancel} style={styles.modalOverlay} />
        <View style={styles.modalSheet}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>Creer un produit</Text>

            <Text style={styles.inputLabel}>Nom *</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={onChangeName}
              placeholder="Ex : Gel Maurten 100"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
              value={name}
            />

            <Text style={styles.inputLabel}>Image</Text>
            <View style={styles.imageCard}>
              {imagePreviewUri ? (
                <Image source={{ uri: imagePreviewUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Apercu</Text>
                </View>
              )}
              <View style={styles.imageCopy}>
                <Text style={styles.imageTitle}>{imageName ?? 'Ajoute une photo du produit'}</Text>
                <Text style={styles.imageHint}>JPEG, PNG, WebP ou AVIF, max 5 Mo.</Text>
              </View>
            </View>

            <View style={styles.imageActions}>
              <TouchableOpacity onPress={onPickImage} style={styles.secondaryActionButton}>
                <Text style={styles.secondaryActionText}>
                  {imagePreviewUri ? "Changer l'image" : 'Choisir une image'}
                </Text>
              </TouchableOpacity>
              {imagePreviewUri ? (
                <TouchableOpacity onPress={onRemoveImage} style={styles.ghostActionButton}>
                  <Text style={styles.ghostActionText}>Retirer</Text>
                </TouchableOpacity>
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
                <Text style={styles.inputLabel}>Glucides (g)</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={onChangeCarbsG}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                  value={carbsG}
                />
              </View>
              <View style={styles.numericField}>
                <Text style={styles.inputLabel}>Sodium (mg)</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={onChangeSodiumMg}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                  value={sodiumMg}
                />
              </View>
              <View style={styles.numericField}>
                <Text style={styles.inputLabel}>Kcal</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={onChangeCaloriesKcal}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                  value={caloriesKcal}
                />
              </View>
            </View>

            <TouchableOpacity
              disabled={creating}
              onPress={onSubmit}
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
            >
              {creating ? (
                <ActivityIndicator color={Colors.textOnBrand} />
              ) : (
                <Text style={styles.submitButtonText}>Creer et ajouter aux favoris</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
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
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
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
  secondaryActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  ghostActionButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  ghostActionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: Colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});

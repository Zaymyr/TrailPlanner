import { memo } from 'react';
import {
  ActivityIndicator,
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
  onChangeName: (value: string) => void;
  onSelectFuelType: (value: FuelType) => void;
  onChangeCarbsG: (value: string) => void;
  onChangeSodiumMg: (value: string) => void;
  onChangeCaloriesKcal: (value: string) => void;
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
  onChangeName,
  onSelectFuelType,
  onChangeCarbsG,
  onChangeSodiumMg,
  onChangeCaloriesKcal,
  onSubmit,
  onCancel,
}: NutritionCreateProductModalProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
      >
        <Pressable onPress={onCancel} style={styles.modalOverlay} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Créer un produit</Text>

          <Text style={styles.inputLabel}>Nom *</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={onChangeName}
            placeholder="Ex : Gel Maurten 100"
            placeholderTextColor={Colors.textMuted}
            style={styles.textInput}
            value={name}
          />

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
              <Text style={styles.submitButtonText}>Créer et ajouter aux favoris</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
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

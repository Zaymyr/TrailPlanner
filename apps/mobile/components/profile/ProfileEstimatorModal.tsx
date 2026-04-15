import { memo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import type {
  CarbEstimatorLevel,
  EstimatedHourlyTargets,
  HydrationEstimatorLevel,
  SodiumEstimatorLevel,
} from './types';

type ProfileEstimatorModalProps = {
  visible: boolean;
  closeLabel: string;
  title: string;
  subtitle: string;
  bodyMetricsTitle: string;
  weightLabel: string;
  weightPlaceholder: string;
  heightLabel: string;
  heightPlaceholder: string;
  carbQuestion: string;
  hydrationQuestion: string;
  sodiumQuestion: string;
  carbOptions: Array<{ value: CarbEstimatorLevel; label: string }>;
  hydrationOptions: Array<{ value: HydrationEstimatorLevel; label: string }>;
  sodiumOptions: Array<{ value: SodiumEstimatorLevel; label: string }>;
  selectedCarbLevel: CarbEstimatorLevel;
  selectedHydrationLevel: HydrationEstimatorLevel;
  selectedSodiumLevel: SodiumEstimatorLevel;
  estimatorWeightKg: string;
  estimatorHeightCm: string;
  onChangeEstimatorWeightKg: (value: string) => void;
  onChangeEstimatorHeightCm: (value: string) => void;
  onSelectCarbLevel: (value: CarbEstimatorLevel) => void;
  onSelectHydrationLevel: (value: HydrationEstimatorLevel) => void;
  onSelectSodiumLevel: (value: SodiumEstimatorLevel) => void;
  resultTitle: string;
  carbsLabel: string;
  waterLabel: string;
  sodiumLabel: string;
  estimatedTargets: EstimatedHourlyTargets | null;
  missingBodyMetricsLabel: string;
  disclaimer: string;
  applyLabel: string;
  onApply: () => void;
  onClose: () => void;
};

function EstimatorOptionList<T extends string>({
  options,
  selectedValue,
  onSelect,
}: {
  options: Array<{ value: T; label: string }>;
  selectedValue: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.optionsList}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={() => onSelect(option.value)}
          >
            <View style={[styles.radio, isSelected && styles.radioSelected]}>
              {isSelected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ProfileEstimatorModalComponent({
  visible,
  closeLabel,
  title,
  subtitle,
  bodyMetricsTitle,
  weightLabel,
  weightPlaceholder,
  heightLabel,
  heightPlaceholder,
  carbQuestion,
  hydrationQuestion,
  sodiumQuestion,
  carbOptions,
  hydrationOptions,
  sodiumOptions,
  selectedCarbLevel,
  selectedHydrationLevel,
  selectedSodiumLevel,
  estimatorWeightKg,
  estimatorHeightCm,
  onChangeEstimatorWeightKg,
  onChangeEstimatorHeightCm,
  onSelectCarbLevel,
  onSelectHydrationLevel,
  onSelectSodiumLevel,
  resultTitle,
  carbsLabel,
  waterLabel,
  sodiumLabel,
  estimatedTargets,
  missingBodyMetricsLabel,
  disclaimer,
  applyLabel,
  onApply,
  onClose,
}: ProfileEstimatorModalProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalWrapper}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>{closeLabel}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.estimatorContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{bodyMetricsTitle}</Text>
              <View style={styles.bodyMetricsRow}>
                <View style={styles.bodyMetricField}>
                  <Text style={styles.label}>{weightLabel}</Text>
                  <View style={styles.metricInputShell}>
                    <TextInput
                      style={styles.metricInput}
                      value={estimatorWeightKg}
                      onChangeText={onChangeEstimatorWeightKg}
                      placeholder={weightPlaceholder}
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.metricInputUnit}>kg</Text>
                  </View>
                </View>

                <View style={styles.bodyMetricField}>
                  <Text style={styles.label}>{heightLabel}</Text>
                  <View style={styles.metricInputShell}>
                    <TextInput
                      style={styles.metricInput}
                      value={estimatorHeightCm}
                      onChangeText={onChangeEstimatorHeightCm}
                      placeholder={heightPlaceholder}
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.metricInputUnit}>cm</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{carbQuestion}</Text>
              <EstimatorOptionList
                options={carbOptions}
                selectedValue={selectedCarbLevel}
                onSelect={onSelectCarbLevel}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{hydrationQuestion}</Text>
              <EstimatorOptionList
                options={hydrationOptions}
                selectedValue={selectedHydrationLevel}
                onSelect={onSelectHydrationLevel}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{sodiumQuestion}</Text>
              <EstimatorOptionList
                options={sodiumOptions}
                selectedValue={selectedSodiumLevel}
                onSelect={onSelectSodiumLevel}
              />
            </View>

            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{resultTitle}</Text>
              {estimatedTargets ? (
                <>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{carbsLabel}</Text>
                    <Text style={styles.resultValue}>{estimatedTargets.carbsGPerHour} g/h</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{waterLabel}</Text>
                    <Text style={styles.resultValue}>{estimatedTargets.waterMlPerHour} ml/h</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{sodiumLabel}</Text>
                    <Text style={styles.resultValue}>{estimatedTargets.sodiumMgPerHour} mg/h</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.missingText}>{missingBodyMetricsLabel}</Text>
              )}
            </View>

            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{disclaimer}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyButton, !estimatedTargets && styles.applyButtonDisabled]}
            onPress={onApply}
            disabled={!estimatedTargets}
          >
            <Text style={styles.applyButtonText}>{applyLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export const ProfileEstimatorModal = memo(ProfileEstimatorModalComponent);

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  modalHeaderContent: {
    flex: 1,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  modalCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCloseButtonText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  estimatorContent: {
    gap: 16,
    paddingBottom: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  bodyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bodyMetricField: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 0,
  },
  metricInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  metricInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  metricInputUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  optionsList: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionSelected: {
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  radioSelected: {
    borderColor: Colors.brandPrimary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  optionText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: Colors.brandPrimary,
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    padding: 14,
    gap: 10,
  },
  resultTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  resultValue: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  missingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
  },
  noticeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  applyButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '600',
  },
});

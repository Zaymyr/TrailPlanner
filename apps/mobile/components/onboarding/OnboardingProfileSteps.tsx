import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';
import { OnboardingShell } from './OnboardingIntroSteps';

type StepFrameProps = {
  continueLabel: string;
  error: string | null;
  onContinue: () => void;
  onSkip: () => void;
  skipDisabled: boolean;
  skipLabel: string;
  step: number;
  stepLabel: string;
  subtitle: string;
  title: string;
  totalSteps: number;
};

type PersonalStepProps = StepFrameProps & {
  firstNameLabel: string;
  firstNamePlaceholder: string;
  fullName: string;
  heightCm: string;
  heightLabel: string;
  heightPlaceholder: string;
  onChangeFullName: (value: string) => void;
  onChangeHeightCm: (value: string) => void;
  onChangeWeightKg: (value: string) => void;
  sectionSubtitle: string;
  sectionTitle: string;
  weightKg: string;
  weightLabel: string;
  weightPlaceholder: string;
};

export function OnboardingPersonalStep({
  continueLabel,
  error,
  firstNameLabel,
  firstNamePlaceholder,
  fullName,
  heightCm,
  heightLabel,
  heightPlaceholder,
  onChangeFullName,
  onChangeHeightCm,
  onChangeWeightKg,
  onContinue,
  onSkip,
  sectionSubtitle,
  sectionTitle,
  skipDisabled,
  skipLabel,
  step,
  stepLabel,
  subtitle,
  title,
  totalSteps,
  weightKg,
  weightLabel,
  weightPlaceholder,
}: PersonalStepProps) {
  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      stepLabel={stepLabel}
      skipLabel={skipLabel}
      skipDisabled={skipDisabled}
      onSkip={onSkip}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        <Text style={styles.sectionSubtitle}>{sectionSubtitle}</Text>
        <Text style={styles.label}>{firstNameLabel}</Text>
        <TextInput
          style={styles.textInput}
          value={fullName}
          onChangeText={onChangeFullName}
          placeholder={firstNamePlaceholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          textContentType="givenName"
        />
        <View style={styles.bodyMetricsRow}>
          <MetricInput
            label={weightLabel}
            placeholder={weightPlaceholder}
            unit="kg"
            value={weightKg}
            onChange={onChangeWeightKg}
          />
          <MetricInput
            label={heightLabel}
            placeholder={heightPlaceholder}
            unit="cm"
            value={heightCm}
            onChange={onChangeHeightCm}
          />
        </View>
      </View>
      <StepFooter error={error} continueLabel={continueLabel} onContinue={onContinue} />
    </OnboardingShell>
  );
}

function MetricInput({
  label,
  onChange,
  placeholder,
  unit,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  unit: string;
  value: string;
}) {
  return (
    <View style={styles.bodyMetricField}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.metricInputShell}>
        <TextInput
          style={styles.metricInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Text style={styles.metricInputUnit}>{unit}</Text>
      </View>
    </View>
  );
}

type PerformanceStepProps = StepFrameProps & {
  comfortableFlatPaceLabel: string;
  comfortableFlatPaceMinutes: string;
  comfortableFlatPaceMinutesLabel: string;
  comfortableFlatPaceSeconds: string;
  comfortableFlatPaceSecondsLabel: string;
  onChangeComfortableFlatPaceMinutes: (value: string) => void;
  onChangeComfortableFlatPaceSeconds: (value: string) => void;
  onChangeUtmbIndex: (value: string) => void;
  onChangeWaterBagLiters: (value: number) => void;
  utmbIndex: string;
  utmbIndexLabel: string;
  utmbIndexPlaceholder: string;
  waterBagLabel: string;
  waterBagLiters: number;
  waterBagOptions: readonly number[];
};

export function OnboardingPerformanceStep({
  comfortableFlatPaceLabel,
  comfortableFlatPaceMinutes,
  comfortableFlatPaceMinutesLabel,
  comfortableFlatPaceSeconds,
  comfortableFlatPaceSecondsLabel,
  continueLabel,
  error,
  onChangeComfortableFlatPaceMinutes,
  onChangeComfortableFlatPaceSeconds,
  onChangeUtmbIndex,
  onChangeWaterBagLiters,
  onContinue,
  onSkip,
  skipDisabled,
  skipLabel,
  step,
  stepLabel,
  subtitle,
  title,
  totalSteps,
  utmbIndex,
  utmbIndexLabel,
  utmbIndexPlaceholder,
  waterBagLabel,
  waterBagLiters,
  waterBagOptions,
}: PerformanceStepProps) {
  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      stepLabel={stepLabel}
      skipLabel={skipLabel}
      skipDisabled={skipDisabled}
      onSkip={onSkip}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.sectionCard}>
        <Text style={styles.label}>{waterBagLabel}</Text>
        <View style={styles.waterBagRow}>
          {waterBagOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.waterBtn, waterBagLiters === option && styles.waterBtnActive]}
              onPress={() => onChangeWaterBagLiters(option)}
            >
              <Text style={[styles.waterBtnText, waterBagLiters === option && styles.waterBtnTextActive]}>
                {option}L
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>{comfortableFlatPaceLabel}</Text>
        <View style={styles.paceInputRow}>
          <PaceInput
            label={comfortableFlatPaceMinutesLabel}
            placeholder="6"
            value={comfortableFlatPaceMinutes}
            onChange={onChangeComfortableFlatPaceMinutes}
          />
          <PaceInput
            label={comfortableFlatPaceSecondsLabel}
            placeholder="00"
            value={comfortableFlatPaceSeconds}
            onChange={onChangeComfortableFlatPaceSeconds}
          />
        </View>
        <Text style={styles.label}>{utmbIndexLabel}</Text>
        <TextInput
          style={styles.textInput}
          value={utmbIndex}
          onChangeText={onChangeUtmbIndex}
          placeholder={utmbIndexPlaceholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
      <StepFooter error={error} continueLabel={continueLabel} onContinue={onContinue} />
    </OnboardingShell>
  );
}

function PaceInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.paceInputGroup}>
      <Text style={styles.paceInputLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={2}
      />
    </View>
  );
}

type NutritionTargetsStepProps = StepFrameProps & {
  carbsLabel: string;
  carbsValue: string;
  estimatorLabel: string;
  onChangeCarbs: (value: string) => void;
  onChangeSodium: (value: string) => void;
  onChangeWater: (value: string) => void;
  onOpenEstimator: () => void;
  sodiumLabel: string;
  sodiumValue: string;
  waterLabel: string;
  waterValue: string;
};

export function OnboardingNutritionTargetsStep({
  carbsLabel,
  carbsValue,
  continueLabel,
  error,
  estimatorLabel,
  onChangeCarbs,
  onChangeSodium,
  onChangeWater,
  onContinue,
  onOpenEstimator,
  onSkip,
  skipDisabled,
  skipLabel,
  sodiumLabel,
  sodiumValue,
  step,
  stepLabel,
  subtitle,
  title,
  totalSteps,
  waterLabel,
  waterValue,
}: NutritionTargetsStepProps) {
  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      stepLabel={stepLabel}
      skipLabel={skipLabel}
      skipDisabled={skipDisabled}
      onSkip={onSkip}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.sectionCard}>
        <TouchableOpacity style={styles.estimateButton} onPress={onOpenEstimator}>
          <Text style={styles.estimateButtonText}>{estimatorLabel}</Text>
        </TouchableOpacity>
        <View style={styles.targetsStack}>
          <TargetInput label={carbsLabel} unit="g" value={carbsValue} maxLength={3} onChange={onChangeCarbs} />
          <TargetInput label={waterLabel} unit="ml" value={waterValue} maxLength={4} onChange={onChangeWater} />
          <TargetInput label={sodiumLabel} unit="mg" value={sodiumValue} maxLength={4} onChange={onChangeSodium} last />
        </View>
      </View>
      <StepFooter error={error} continueLabel={continueLabel} onContinue={onContinue} />
    </OnboardingShell>
  );
}

function TargetInput({
  label,
  last = false,
  maxLength,
  onChange,
  unit,
  value,
}: {
  label: string;
  last?: boolean;
  maxLength: number;
  onChange: (value: string) => void;
  unit: string;
  value: string;
}) {
  return (
    <View style={[styles.targetRow, !last && styles.targetRowBordered]}>
      <Text style={styles.targetLabel}>{label}</Text>
      <View style={styles.targetInputShell}>
        <TextInput
          style={styles.targetInput}
          value={value}
          onChangeText={onChange}
          placeholder={maxLength === 3 ? '70' : unit === 'ml' ? '500' : '600'}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={maxLength}
        />
        <Text style={styles.targetUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function StepFooter({
  continueLabel,
  error,
  onContinue,
}: {
  continueLabel: string;
  error: string | null;
  onContinue: () => void;
}) {
  return (
    <>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity style={styles.primaryButton} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>{continueLabel}</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  sectionCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sectionSubtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 8 },
  textInput: { backgroundColor: Colors.surfaceSecondary, color: Colors.textPrimary, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 8 },
  bodyMetricsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  bodyMetricField: { flex: 1 },
  metricInputShell: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  metricInput: { flex: 1, minWidth: 0, backgroundColor: 'transparent', color: Colors.textPrimary, paddingHorizontal: 0, paddingVertical: 8, fontSize: 15, fontWeight: '700' },
  metricInputUnit: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  waterBagRow: { flexDirection: 'row', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  waterBtn: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, minWidth: 72, alignItems: 'center' },
  waterBtnActive: { backgroundColor: Colors.brandSurface, borderColor: Colors.brandBorder },
  waterBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  waterBtnTextActive: { color: Colors.brandPrimary },
  paceInputRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  paceInputGroup: { flex: 1, gap: 6 },
  paceInputLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  estimateButton: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface, marginTop: 4, marginBottom: 14 },
  estimateButtonText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
  targetsStack: { borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden' },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  targetRowBordered: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  targetLabel: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  targetInputShell: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 116, paddingHorizontal: 12, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  targetInput: { flex: 1, minWidth: 0, backgroundColor: 'transparent', color: Colors.textPrimary, paddingHorizontal: 0, paddingVertical: 8, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  targetUnit: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  primaryButton: { backgroundColor: Colors.brandPrimary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryButtonText: { color: Colors.textOnBrand, fontSize: 16, fontWeight: '700' },
});

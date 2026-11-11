import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Field } from '../themed/Field';
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
        <Field
          autoCapitalize="words"
          containerStyle={styles.fieldSpacing}
          label={firstNameLabel}
          onChangeText={onChangeFullName}
          placeholder={firstNamePlaceholder}
          textContentType="givenName"
          value={fullName}
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
    <Field
      containerStyle={[styles.bodyMetricField, styles.fieldSpacing]}
      inputAccessoryViewID="pace-yourself-numeric-keyboard"
      keyboardType="number-pad"
      label={label}
      maxLength={3}
      onChangeText={onChange}
      placeholder={placeholder}
      unit={unit}
      value={value}
    />
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
        <Field
          containerStyle={styles.fieldSpacing}
          inputAccessoryViewID="pace-yourself-numeric-keyboard"
          keyboardType="number-pad"
          label={utmbIndexLabel}
          maxLength={4}
          onChangeText={onChangeUtmbIndex}
          placeholder={utmbIndexPlaceholder}
          value={utmbIndex}
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
    <Field
      containerStyle={styles.paceInputGroup}
      inputAccessoryViewID="pace-yourself-numeric-keyboard"
      keyboardType="number-pad"
      label={label}
      maxLength={2}
      onChangeText={onChange}
      placeholder={placeholder}
      value={value}
    />
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
    <Field
      containerStyle={!last ? styles.fieldSpacing : undefined}
      inputAccessoryViewID="pace-yourself-numeric-keyboard"
      keyboardType="number-pad"
      label={label}
      maxLength={maxLength}
      onChangeText={onChange}
      placeholder={maxLength === 3 ? '70' : unit === 'ml' ? '500' : '600'}
      unit={unit}
      value={value}
    />
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
  bodyMetricsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  bodyMetricField: { flex: 1 },
  waterBagRow: { flexDirection: 'row', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  waterBtn: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, minWidth: 72, alignItems: 'center' },
  waterBtnActive: { backgroundColor: Colors.brandSurface, borderColor: Colors.brandBorder },
  waterBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  waterBtnTextActive: { color: Colors.brandPrimary },
  paceInputRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  paceInputGroup: { flex: 1 },
  fieldSpacing: { marginTop: 8, marginBottom: 8 },
  estimateButton: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface, marginTop: 4, marginBottom: 14 },
  estimateButtonText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
  targetsStack: { gap: 4 },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  primaryButton: { backgroundColor: Colors.brandPrimary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryButtonText: { color: Colors.textOnBrand, fontSize: 16, fontWeight: '700' },
});

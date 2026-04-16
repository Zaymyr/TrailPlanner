import { useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ProfileEstimatorModal } from '../../components/profile/ProfileEstimatorModal';
import {
  estimateHourlyTargets,
  isValidHeightCm,
  isValidWeightKg,
} from '../../components/profile/profileEstimator';
import {
  parseComfortableFlatPace,
  parseOptionalNonNegativeInteger,
  WATER_BAG_OPTIONS,
} from '../../components/profile/profileHelpers';
import type {
  CarbEstimatorLevel,
  HydrationEstimatorLevel,
  SodiumEstimatorLevel,
} from '../../components/profile/types';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { noteReviewOnboardingCompleted } from '../../lib/appReview';

function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function OnboardingShell({
  children,
  step,
  totalSteps,
  stepLabel,
}: {
  children: React.ReactNode;
  step: number;
  totalSteps: number;
  stepLabel: string;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topGlow} />
      <ScrollView
        contentContainerStyle={styles.shellScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.hero}>
            <Text style={styles.logo}>Pace Yourself</Text>
            <Text style={styles.stepIndicator}>
              {stepLabel.replace('{step}', String(step)).replace('{total}', String(totalSteps))}
            </Text>
            <View style={styles.progressRow}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View
                  key={`progress-${index + 1}`}
                  style={[
                    styles.progressSegment,
                    index < step ? styles.progressSegmentActive : styles.progressSegmentInactive,
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.card}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function OnboardingScreen() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState(1.5);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [comfortableFlatPaceMinutes, setComfortableFlatPaceMinutes] = useState('');
  const [comfortableFlatPaceSeconds, setComfortableFlatPaceSeconds] = useState('');
  const [utmbIndex, setUtmbIndex] = useState('');
  const [defaultCarbsPerHour, setDefaultCarbsPerHour] = useState('');
  const [defaultWaterPerHour, setDefaultWaterPerHour] = useState('');
  const [defaultSodiumPerHour, setDefaultSodiumPerHour] = useState('');
  const [showEstimatorModal, setShowEstimatorModal] = useState(false);
  const [estimatorWeightKg, setEstimatorWeightKg] = useState('');
  const [estimatorHeightCm, setEstimatorHeightCm] = useState('');
  const [estimatorCarbLevel, setEstimatorCarbLevel] = useState<CarbEstimatorLevel>('moderate');
  const [estimatorHydrationLevel, setEstimatorHydrationLevel] =
    useState<HydrationEstimatorLevel>('normal');
  const [estimatorSodiumLevel, setEstimatorSodiumLevel] = useState<SodiumEstimatorLevel>('normal');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const router = useRouter();
  const totalSteps = 5;
  const parsedEstimatorWeight = useMemo(
    () => parseOptionalNonNegativeInteger(estimatorWeightKg),
    [estimatorWeightKg],
  );
  const parsedEstimatorHeight = useMemo(
    () => parseOptionalNonNegativeInteger(estimatorHeightCm),
    [estimatorHeightCm],
  );
  const estimatedTargets = useMemo(() => {
    if (!isValidWeightKg(parsedEstimatorWeight) || !isValidHeightCm(parsedEstimatorHeight)) {
      return null;
    }

    return estimateHourlyTargets({
      weightKg: parsedEstimatorWeight,
      heightCm: parsedEstimatorHeight,
      carbLevel: estimatorCarbLevel,
      hydrationLevel: estimatorHydrationLevel,
      sodiumLevel: estimatorSodiumLevel,
    });
  }, [
    estimatorCarbLevel,
    estimatorHydrationLevel,
    estimatorSodiumLevel,
    parsedEstimatorHeight,
    parsedEstimatorWeight,
  ]);
  const carbEstimatorOptions = useMemo(
    () => [
      { value: 'beginner' as const, label: t.profile.estimatorCarbBeginner },
      { value: 'moderate' as const, label: t.profile.estimatorCarbModerate },
      { value: 'gels' as const, label: t.profile.estimatorCarbGels },
      { value: 'high' as const, label: t.profile.estimatorCarbHigh },
    ],
    [
      t.profile.estimatorCarbBeginner,
      t.profile.estimatorCarbGels,
      t.profile.estimatorCarbHigh,
      t.profile.estimatorCarbModerate,
    ],
  );
  const hydrationEstimatorOptions = useMemo(
    () => [
      { value: 'low' as const, label: t.profile.estimatorHydrationLow },
      { value: 'normal' as const, label: t.profile.estimatorHydrationNormal },
      { value: 'thirsty' as const, label: t.profile.estimatorHydrationThirsty },
      { value: 'very_thirsty' as const, label: t.profile.estimatorHydrationVeryThirsty },
    ],
    [
      t.profile.estimatorHydrationLow,
      t.profile.estimatorHydrationNormal,
      t.profile.estimatorHydrationThirsty,
      t.profile.estimatorHydrationVeryThirsty,
    ],
  );
  const sodiumEstimatorOptions = useMemo(
    () => [
      { value: 'low' as const, label: t.profile.estimatorSodiumLow },
      { value: 'normal' as const, label: t.profile.estimatorSodiumNormal },
      { value: 'salty' as const, label: t.profile.estimatorSodiumSalty },
      { value: 'very_salty' as const, label: t.profile.estimatorSodiumVerySalty },
    ],
    [
      t.profile.estimatorSodiumLow,
      t.profile.estimatorSodiumNormal,
      t.profile.estimatorSodiumSalty,
      t.profile.estimatorSodiumVerySalty,
    ],
  );
  const workflowSteps = [
    {
      title: t.onboarding.workflowStep1Title,
      text: t.onboarding.workflowStep1Text,
    },
    {
      title: t.onboarding.workflowStep2Title,
      text: t.onboarding.workflowStep2Text,
    },
    {
      title: t.onboarding.workflowStep3Title,
      text: t.onboarding.workflowStep3Text,
    },
    {
      title: t.onboarding.workflowStep4Title,
      text: t.onboarding.workflowStep4Text,
    },
    {
      title: t.onboarding.workflowStep5Title,
      text: t.onboarding.workflowStep5Text,
    },
    {
      title: t.onboarding.workflowStep6Title,
      text: t.onboarding.workflowStep6Text,
    },
    {
      title: t.onboarding.workflowStep7Title,
      text: t.onboarding.workflowStep7Text,
    },
  ];
  const overviewPhases = [
    {
      index: 1,
      title: t.onboarding.phase1Title,
      text: t.onboarding.phase1Text,
    },
    {
      index: 2,
      title: t.onboarding.phase2Title,
      text: t.onboarding.phase2Text,
    },
    {
      index: 3,
      title: t.onboarding.phase3Title,
      text: t.onboarding.phase3Text,
    },
  ];
  const workflowGroups = [
    {
      label: t.onboarding.workflowGroup1Label,
      items: workflowSteps.slice(0, 3),
    },
    {
      label: t.onboarding.workflowGroup2Label,
      items: workflowSteps.slice(3, 6),
    },
    {
      label: t.onboarding.workflowGroup3Label,
      items: workflowSteps.slice(6),
    },
  ];

  function validatePersonalStep(): {
    parsedWeightKg: number | null;
    parsedHeightCm: number | null;
  } | null {
    const parsedWeightKg = parseOptionalNonNegativeInteger(weightKg);
    if (
      Number.isNaN(parsedWeightKg) ||
      (parsedWeightKg !== null && (parsedWeightKg < 20 || parsedWeightKg > 250))
    ) {
      setProfileError(t.profile.weightInvalid);
      return null;
    }

    const parsedHeightCm = parseOptionalNonNegativeInteger(heightCm);
    if (
      Number.isNaN(parsedHeightCm) ||
      (parsedHeightCm !== null && (parsedHeightCm < 100 || parsedHeightCm > 250))
    ) {
      setProfileError(t.profile.heightInvalid);
      return null;
    }

    setProfileError(null);
    return {
      parsedWeightKg,
      parsedHeightCm,
    };
  }

  function validatePerformanceStep(): {
    comfortableFlatPaceMinPerKm: number | null;
    parsedUtmbIndex: number | null;
    parsedDefaultCarbsPerHour: number | null;
    parsedDefaultWaterPerHour: number | null;
    parsedDefaultSodiumPerHour: number | null;
  } | null {
    const comfortableFlatPaceMinPerKm = parseComfortableFlatPace(
      comfortableFlatPaceMinutes,
      comfortableFlatPaceSeconds,
    );

    if (Number.isNaN(comfortableFlatPaceMinPerKm)) {
      setProfileError(t.onboarding.comfortableFlatPaceInvalid);
      return null;
    }

    const parsedUtmbIndex = utmbIndex.trim() ? Number(utmbIndex.trim()) : null;
    if (
      utmbIndex.trim() &&
      (!Number.isFinite(parsedUtmbIndex) || parsedUtmbIndex === null || parsedUtmbIndex < 0 || parsedUtmbIndex > 2000)
    ) {
      setProfileError(t.onboarding.utmbIndexInvalid);
      return null;
    }

    const parsedDefaultCarbsPerHour = parseOptionalNonNegativeInteger(defaultCarbsPerHour);
    const parsedDefaultWaterPerHour = parseOptionalNonNegativeInteger(defaultWaterPerHour);
    const parsedDefaultSodiumPerHour = parseOptionalNonNegativeInteger(defaultSodiumPerHour);
    if (
      Number.isNaN(parsedDefaultCarbsPerHour) ||
      Number.isNaN(parsedDefaultWaterPerHour) ||
      Number.isNaN(parsedDefaultSodiumPerHour)
    ) {
      setProfileError(t.profile.defaultTargetsInvalid);
      return null;
    }

    setProfileError(null);
    return {
      comfortableFlatPaceMinPerKm,
      parsedUtmbIndex,
      parsedDefaultCarbsPerHour,
      parsedDefaultWaterPerHour,
      parsedDefaultSodiumPerHour,
    };
  }

  async function finishOnboarding() {
    const personalStep = validatePersonalStep();
    if (!personalStep) {
      return;
    }

    const performanceStep = validatePerformanceStep();
    if (!performanceStep) {
      return;
    }

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (userId) {
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        full_name: fullName.trim() || null,
        water_bag_liters: waterBagLiters,
        utmb_index: performanceStep.parsedUtmbIndex,
        comfortable_flat_pace_min_per_km: performanceStep.comfortableFlatPaceMinPerKm,
        weight_kg: personalStep.parsedWeightKg,
        height_cm: personalStep.parsedHeightCm,
        default_carbs_g_per_hour: performanceStep.parsedDefaultCarbsPerHour,
        default_water_ml_per_hour: performanceStep.parsedDefaultWaterPerHour,
        default_sodium_mg_per_hour: performanceStep.parsedDefaultSodiumPerHour,
      });
    }

    await noteReviewOnboardingCompleted();
    setSaving(false);
    router.replace('/(app)/plans');
  }

  async function handleNotifStep() {
    await Notifications.requestPermissionsAsync();
    await finishOnboarding();
  }

  function handlePersonalContinue() {
    const personalStep = validatePersonalStep();
    if (!personalStep) return;
    setStep(3);
  }

  function handlePerformanceContinue() {
    const performanceStep = validatePerformanceStep();
    if (!performanceStep) return;
    setStep(4);
  }

  function handleOpenEstimator() {
    setEstimatorWeightKg(weightKg);
    setEstimatorHeightCm(heightCm);
    setShowEstimatorModal(true);
  }

  function handleApplyEstimator() {
    if (
      !estimatedTargets ||
      !isValidWeightKg(parsedEstimatorWeight) ||
      !isValidHeightCm(parsedEstimatorHeight)
    ) {
      Alert.alert(t.common.error, t.profile.estimatorMissingBodyMetrics);
      return;
    }

    setWeightKg(String(parsedEstimatorWeight));
    setHeightCm(String(parsedEstimatorHeight));
    setDefaultCarbsPerHour(String(estimatedTargets.carbsGPerHour));
    setDefaultWaterPerHour(String(estimatedTargets.waterMlPerHour));
    setDefaultSodiumPerHour(String(estimatedTargets.sodiumMgPerHour));
    setShowEstimatorModal(false);
    setProfileError(null);
  }

  function renderEstimatorModal() {
    return (
      <ProfileEstimatorModal
        visible={showEstimatorModal}
        closeLabel={t.common.close}
        title={t.profile.estimatorTitle}
        subtitle={t.profile.estimatorSubtitle}
        bodyMetricsTitle={t.profile.estimatorBodyMetricsTitle}
        weightLabel={t.profile.weightLabel}
        weightPlaceholder={t.profile.weightPlaceholder}
        heightLabel={t.profile.heightLabel}
        heightPlaceholder={t.profile.heightPlaceholder}
        carbQuestion={t.profile.estimatorCarbQuestion}
        hydrationQuestion={t.profile.estimatorHydrationQuestion}
        sodiumQuestion={t.profile.estimatorSodiumQuestion}
        carbOptions={carbEstimatorOptions}
        hydrationOptions={hydrationEstimatorOptions}
        sodiumOptions={sodiumEstimatorOptions}
        selectedCarbLevel={estimatorCarbLevel}
        selectedHydrationLevel={estimatorHydrationLevel}
        selectedSodiumLevel={estimatorSodiumLevel}
        estimatorWeightKg={estimatorWeightKg}
        estimatorHeightCm={estimatorHeightCm}
        onChangeEstimatorWeightKg={(value) => setEstimatorWeightKg(sanitizeDigits(value, 3))}
        onChangeEstimatorHeightCm={(value) => setEstimatorHeightCm(sanitizeDigits(value, 3))}
        onSelectCarbLevel={setEstimatorCarbLevel}
        onSelectHydrationLevel={setEstimatorHydrationLevel}
        onSelectSodiumLevel={setEstimatorSodiumLevel}
        resultTitle={t.profile.estimatorResultTitle}
        carbsLabel={t.profile.defaultCarbsPerHourLabel}
        waterLabel={t.profile.defaultWaterPerHourLabel}
        sodiumLabel={t.profile.defaultSodiumPerHourLabel}
        estimatedTargets={estimatedTargets}
        missingBodyMetricsLabel={t.profile.estimatorMissingBodyMetrics}
        disclaimer={t.profile.estimatorDisclaimer}
        applyLabel={t.profile.estimatorApply}
        onApply={handleApplyEstimator}
        onClose={() => setShowEstimatorModal(false)}
      />
    );
  }

  if (step === 0) {
    return (
      <OnboardingShell step={1} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.kicker}>{t.onboarding.welcomeKicker}</Text>
        <Text style={styles.title}>{t.onboarding.welcomeTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.welcomeSubtitle}</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t.onboarding.overviewCardTitle}</Text>
          <Text style={styles.summaryText}>{t.onboarding.overviewCardText}</Text>
        </View>

        <View style={styles.phaseList}>
          {overviewPhases.map((item) => (
            <View key={item.title} style={styles.phaseCard}>
              <View style={styles.phaseBadge}>
                <Text style={styles.phaseBadgeText}>{item.index}</Text>
              </View>
              <View style={styles.phaseBody}>
                <Text style={styles.phaseTitle}>{item.title}</Text>
                <Text style={styles.phaseText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(1)}>
          <Text style={styles.primaryButtonText}>{t.onboarding.overviewCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  if (step === 1) {
    return (
      <OnboardingShell step={2} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.kicker}>{t.onboarding.workflowKicker}</Text>
        <Text style={styles.title}>{t.onboarding.workflowTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.workflowSubtitle}</Text>

        <View style={styles.timelineGroups}>
          {workflowGroups.map((group) => (
            <View key={group.label} style={styles.timelineGroup}>
              <Text style={styles.timelineGroupLabel}>{group.label}</Text>

              <View style={styles.timelineGroupBody}>
                {group.items.map((item) => {
                  const globalIndex = workflowSteps.findIndex((workflowStep) => workflowStep.title === item.title);
                  const isLast = group.items[group.items.length - 1]?.title === item.title;

                  return (
                    <View key={item.title} style={styles.timelineItem}>
                      <View style={styles.timelineMarkerColumn}>
                        <View style={styles.timelineBadge}>
                          <Text style={styles.timelineBadgeText}>{globalIndex + 1}</Text>
                        </View>
                        {!isLast ? <View style={styles.timelineLine} /> : null}
                      </View>

                      <View style={styles.timelineCard}>
                        <Text style={styles.timelineTitle}>{item.title}</Text>
                        <Text style={styles.timelineText}>{item.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
          <Text style={styles.primaryButtonText}>{t.onboarding.startCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <>
        <OnboardingShell step={3} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
          <Text style={styles.title}>{t.profile.personalSectionTitle}</Text>
          <Text style={styles.subtitle}>{t.profile.personalSectionSubtitle}</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.profile.personalSectionTitle}</Text>
            <Text style={styles.sectionSubtitle}>{t.profile.personalSectionSubtitle}</Text>

            <Text style={styles.label}>{t.onboarding.firstNameLabel}</Text>
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                if (profileError) setProfileError(null);
              }}
              placeholder={t.onboarding.firstNamePlaceholder}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              textContentType="givenName"
            />

            <View style={styles.bodyMetricsRow}>
              <View style={styles.bodyMetricField}>
                <Text style={styles.label}>{t.profile.weightLabel}</Text>
                <View style={styles.metricInputShell}>
                  <TextInput
                    style={styles.metricInput}
                    value={weightKg}
                    onChangeText={(value) => {
                      setWeightKg(sanitizeDigits(value, 3));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder={t.profile.weightPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.metricInputUnit}>kg</Text>
                </View>
              </View>

              <View style={styles.bodyMetricField}>
                <Text style={styles.label}>{t.profile.heightLabel}</Text>
                <View style={styles.metricInputShell}>
                  <TextInput
                    style={styles.metricInput}
                    value={heightCm}
                    onChangeText={(value) => {
                      setHeightCm(sanitizeDigits(value, 3));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder={t.profile.heightPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.metricInputUnit}>cm</Text>
                </View>
              </View>
            </View>
          </View>

          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handlePersonalContinue}>
            <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
          </TouchableOpacity>
        </OnboardingShell>
      </>
    );
  }

  if (step === 3) {
    return (
      <>
        <OnboardingShell step={4} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
          <Text style={styles.title}>{t.profile.performanceSectionTitle}</Text>
          <Text style={styles.subtitle}>{t.profile.performanceSectionSubtitle}</Text>
          <Text style={styles.predictionHint}>{t.onboarding.predictionHint}</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.profile.performanceSectionTitle}</Text>
            <Text style={styles.sectionSubtitle}>{t.profile.performanceSectionSubtitle}</Text>

            <Text style={styles.label}>{t.onboarding.waterBagLabel}</Text>
            <Text style={styles.labelHint}>{t.onboarding.waterBagHint}</Text>
            <View style={styles.waterBagRow}>
              {WATER_BAG_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.waterBtn, waterBagLiters === opt && styles.waterBtnActive]}
                  onPress={() => setWaterBagLiters(opt)}
                >
                  <Text style={[styles.waterBtnText, waterBagLiters === opt && styles.waterBtnTextActive]}>
                    {opt}L
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t.onboarding.comfortableFlatPaceLabel}</Text>
            <Text style={styles.labelHint}>{t.onboarding.comfortableFlatPaceHint}</Text>
            <View style={styles.paceInputRow}>
              <View style={styles.paceInputGroup}>
                <Text style={styles.paceInputLabel}>{t.onboarding.comfortableFlatPaceMinutesLabel}</Text>
                <TextInput
                  style={styles.textInput}
                  value={comfortableFlatPaceMinutes}
                  onChangeText={(value) => {
                    setComfortableFlatPaceMinutes(sanitizeDigits(value, 2));
                    if (profileError) setProfileError(null);
                  }}
                  placeholder="6"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.paceInputGroup}>
                <Text style={styles.paceInputLabel}>{t.onboarding.comfortableFlatPaceSecondsLabel}</Text>
                <TextInput
                  style={styles.textInput}
                  value={comfortableFlatPaceSeconds}
                  onChangeText={(value) => {
                    setComfortableFlatPaceSeconds(sanitizeDigits(value, 2));
                    if (profileError) setProfileError(null);
                  }}
                  placeholder="00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            <Text style={styles.label}>{t.onboarding.utmbIndexLabel}</Text>
            <Text style={styles.labelHint}>{t.onboarding.utmbIndexHint}</Text>
            <TextInput
              style={styles.textInput}
              value={utmbIndex}
              onChangeText={(value) => {
                setUtmbIndex(sanitizeDigits(value, 4));
                if (profileError) setProfileError(null);
              }}
              placeholder={t.onboarding.utmbIndexPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.profile.planDefaultsSectionTitle}</Text>
            <Text style={styles.sectionSubtitle}>{t.profile.planDefaultsSectionSubtitle}</Text>
            <Text style={styles.labelHint}>{t.profile.estimatorInlineHint}</Text>

            <TouchableOpacity style={styles.estimateButton} onPress={handleOpenEstimator}>
              <Text style={styles.estimateButtonText}>{t.profile.estimatorButton}</Text>
            </TouchableOpacity>

            <View style={styles.targetsStack}>
              <View style={[styles.targetRow, styles.targetRowBordered]}>
                <Text style={styles.targetLabel}>{t.profile.defaultCarbsPerHourLabel}</Text>
                <View style={styles.targetInputShell}>
                  <TextInput
                    style={styles.targetInput}
                    value={defaultCarbsPerHour}
                    onChangeText={(value) => {
                      setDefaultCarbsPerHour(sanitizeDigits(value, 3));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="70"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.targetUnit}>g</Text>
                </View>
              </View>

              <View style={[styles.targetRow, styles.targetRowBordered]}>
                <Text style={styles.targetLabel}>{t.profile.defaultWaterPerHourLabel}</Text>
                <View style={styles.targetInputShell}>
                  <TextInput
                    style={styles.targetInput}
                    value={defaultWaterPerHour}
                    onChangeText={(value) => {
                      setDefaultWaterPerHour(sanitizeDigits(value, 4));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="500"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={styles.targetUnit}>ml</Text>
                </View>
              </View>

              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>{t.profile.defaultSodiumPerHourLabel}</Text>
                <View style={styles.targetInputShell}>
                  <TextInput
                    style={styles.targetInput}
                    value={defaultSodiumPerHour}
                    onChangeText={(value) => {
                      setDefaultSodiumPerHour(sanitizeDigits(value, 4));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="600"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={styles.targetUnit}>mg</Text>
                </View>
              </View>
            </View>
          </View>

          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handlePerformanceContinue}>
            <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
          </TouchableOpacity>
        </OnboardingShell>

        {renderEstimatorModal()}
      </>
    );
  }

  return (
    <>
      <OnboardingShell step={5} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <View style={styles.notificationIconWrap}>
          <Text style={styles.notificationIcon}>!</Text>
        </View>
        <Text style={styles.title}>{t.onboarding.notificationsTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.notificationsSubtitle}</Text>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t.onboarding.notificationsBoxTitle}</Text>
          <Text style={styles.noticeText}>{t.onboarding.notificationsItem1}</Text>
          <Text style={styles.noticeText}>{t.onboarding.notificationsItem2}</Text>
          <Text style={styles.noticeText}>{t.onboarding.notificationsItem3}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleNotifStep}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnBrand} />
          ) : (
            <Text style={styles.primaryButtonText}>{t.onboarding.notificationsCta}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={finishOnboarding} disabled={saving}>
          <Text style={styles.secondaryButtonText}>{t.onboarding.skipCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>

      {renderEstimatorModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topGlow: {
    position: 'absolute',
    top: -60,
    left: -20,
    right: -20,
    height: 220,
    backgroundColor: Colors.brandSurface,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
  },
  shellScrollContent: {
    flexGrow: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  progressSegmentActive: {
    backgroundColor: Colors.brandPrimary,
  },
  progressSegmentInactive: {
    backgroundColor: Colors.surfaceMuted,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.brandPrimary,
    letterSpacing: 0.4,
  },
  stepIndicator: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  kicker: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  predictionHint: {
    color: Colors.brandPrimary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 20,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: Colors.brandSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  summaryText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  phaseList: {
    gap: 14,
    marginBottom: 28,
  },
  phaseCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phaseBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  phaseBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '700',
  },
  phaseBody: {
    flex: 1,
  },
  phaseTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  phaseText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  timelineGroups: {
    gap: 16,
    marginBottom: 28,
  },
  timelineGroup: {
    gap: 10,
  },
  timelineGroupLabel: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timelineGroupBody: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  timelineMarkerColumn: {
    alignItems: 'center',
    width: 30,
  },
  timelineBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.brandBorder,
    marginTop: 6,
    marginBottom: -6,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  timelineTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  labelHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
    marginTop: -2,
  },
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textPrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  paceInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  paceInputGroup: {
    flex: 1,
    gap: 6,
  },
  paceInputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  bodyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  bodyMetricField: {
    flex: 1,
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
    backgroundColor: Colors.surface,
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
  waterBtn: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 72,
    alignItems: 'center',
  },
  waterBtnActive: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  waterBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  waterBtnTextActive: {
    color: Colors.brandPrimary,
  },
  estimateButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    marginTop: 4,
    marginBottom: 14,
  },
  estimateButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  targetsStack: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  targetRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  targetLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  targetInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 116,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  targetInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  targetUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  notificationIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  notificationIcon: {
    color: Colors.brandPrimary,
    fontSize: 34,
    fontWeight: '800',
  },
  noticeBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
    marginBottom: 24,
  },
  noticeTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});

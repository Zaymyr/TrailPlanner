import { useState } from 'react';
import {
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
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0];

function parseComfortableFlatPace(minutesInput: string, secondsInput: string): number | null {
  const trimmedMinutes = minutesInput.trim();
  const trimmedSeconds = secondsInput.trim();

  if (!trimmedMinutes && !trimmedSeconds) return null;
  if (!trimmedMinutes) return Number.NaN;

  const minutes = Number(trimmedMinutes);
  const seconds = trimmedSeconds ? Number(trimmedSeconds) : 0;

  if (
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return Number.NaN;
  }

  const totalMinutes = minutes + seconds / 60;
  return totalMinutes > 0 ? totalMinutes : Number.NaN;
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
  const [comfortableFlatPaceMinutes, setComfortableFlatPaceMinutes] = useState('');
  const [comfortableFlatPaceSeconds, setComfortableFlatPaceSeconds] = useState('');
  const [utmbIndex, setUtmbIndex] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const router = useRouter();
  const totalSteps = 4;
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

  function validateProfileStep(): { comfortableFlatPaceMinPerKm: number | null; parsedUtmbIndex: number | null } | null {
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

    setProfileError(null);
    return { comfortableFlatPaceMinPerKm, parsedUtmbIndex };
  }

  async function finishOnboarding() {
    const profileStep = validateProfileStep();
    if (!profileStep) {
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
        utmb_index: profileStep.parsedUtmbIndex,
        comfortable_flat_pace_min_per_km: profileStep.comfortableFlatPaceMinPerKm,
      });
    }

    setSaving(false);
    router.replace('/(app)/plans');
  }

  async function handleNotifStep() {
    await Notifications.requestPermissionsAsync();
    await finishOnboarding();
  }

  function handleProfileContinue() {
    const profileStep = validateProfileStep();
    if (!profileStep) return;
    setStep(3);
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
      <OnboardingShell step={3} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.title}>{t.onboarding.profileTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.profileSubtitle}</Text>
        <Text style={styles.predictionHint}>{t.onboarding.predictionHint}</Text>

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
                setComfortableFlatPaceMinutes(value.replace(/\D/g, '').slice(0, 2));
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
                setComfortableFlatPaceSeconds(value.replace(/\D/g, '').slice(0, 2));
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
            setUtmbIndex(value.replace(/\D/g, '').slice(0, 4));
            if (profileError) setProfileError(null);
          }}
          placeholder={t.onboarding.utmbIndexPlaceholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
        />

        {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handleProfileContinue}>
          <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={4} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
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
    marginBottom: 20,
    flexWrap: 'wrap',
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

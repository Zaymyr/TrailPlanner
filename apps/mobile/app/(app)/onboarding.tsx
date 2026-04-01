import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0];

function OnboardingShell({
  children,
  step,
  stepLabel,
}: {
  children: React.ReactNode;
  step: number;
  stepLabel: string;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topGlow} />
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Text style={styles.logo}>Pace Yourself</Text>
          <Text style={styles.stepIndicator}>{stepLabel.replace('{step}', String(step))}</Text>
        </View>
        <View style={styles.card}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

export default function OnboardingScreen() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState(1.5);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function finishOnboarding() {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (userId) {
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        full_name: fullName.trim() || null,
        water_bag_liters: waterBagLiters,
      });
    }

    setSaving(false);
    router.replace('/(app)/plans');
  }

  async function handleNotifStep() {
    await Notifications.requestPermissionsAsync();
    await finishOnboarding();
  }

  if (step === 0) {
    return (
      <OnboardingShell step={1} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.title}>{t.onboarding.welcomeTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.welcomeSubtitle}</Text>

        <View style={styles.bullets}>
          <View style={styles.bullet}>
            <View style={styles.bulletBadge}>
              <Text style={styles.bulletBadgeText}>1</Text>
            </View>
            <View style={styles.bulletBody}>
              <Text style={styles.bulletTitle}>{t.onboarding.bulletPlanTitle}</Text>
              <Text style={styles.bulletText}>{t.onboarding.bulletPlanText}</Text>
            </View>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletBadge}>
              <Text style={styles.bulletBadgeText}>2</Text>
            </View>
            <View style={styles.bulletBody}>
              <Text style={styles.bulletTitle}>{t.onboarding.bulletRaceTitle}</Text>
              <Text style={styles.bulletText}>{t.onboarding.bulletRaceText}</Text>
            </View>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletBadge}>
              <Text style={styles.bulletBadgeText}>3</Text>
            </View>
            <View style={styles.bulletBody}>
              <Text style={styles.bulletTitle}>{t.onboarding.bulletFuelTitle}</Text>
              <Text style={styles.bulletText}>{t.onboarding.bulletFuelText}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(1)}>
          <Text style={styles.primaryButtonText}>{t.onboarding.startCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  if (step === 1) {
    return (
      <OnboardingShell step={2} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.title}>{t.onboarding.profileTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.profileSubtitle}</Text>

        <Text style={styles.label}>{t.onboarding.firstNameLabel}</Text>
        <TextInput
          style={styles.textInput}
          value={fullName}
          onChangeText={setFullName}
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

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
          <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={3} stepLabel={t.onboarding.stepLabel}>
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
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
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
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  bullets: {
    gap: 14,
    marginBottom: 28,
  },
  bullet: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bulletBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 13,
    fontWeight: '700',
  },
  bulletBody: {
    flex: 1,
  },
  bulletTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  bulletText: {
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
  waterBagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
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

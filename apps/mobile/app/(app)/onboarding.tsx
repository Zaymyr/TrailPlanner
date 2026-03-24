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

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0];

export default function OnboardingScreen() {
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

  // Step 0 — Bienvenue
  if (step === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.logo}>Pace Yourself</Text>
          <Text style={styles.title}>Bienvenue ! 👋</Text>
          <Text style={styles.subtitle}>
            L'app qui t'aide à ne plus bonker en trail.
          </Text>

          <View style={styles.bullets}>
            <View style={styles.bullet}>
              <Text style={styles.bulletIcon}>📋</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bulletBold}>Planifie</Text> tes ravitaillements km par km selon ton allure
              </Text>
            </View>
            <View style={styles.bullet}>
              <Text style={styles.bulletIcon}>▶</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bulletBold}>Exécute</Text> ton plan le jour J avec des alertes nutrition en temps réel
              </Text>
            </View>
            <View style={styles.bullet}>
              <Text style={styles.bulletIcon}>⚡</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bulletBold}>Ne bonke plus</Text> grâce au suivi glucides, eau et sodium
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(1)}>
            <Text style={styles.primaryButtonText}>Commencer →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step 1 — Profil
  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.stepIndicator}>2 / 3</Text>
          <Text style={styles.title}>Ton profil</Text>
          <Text style={styles.subtitle}>Quelques infos pour personnaliser tes plans.</Text>

          <Text style={styles.label}>Ton prénom (optionnel)</Text>
          <TextInput
            style={styles.textInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ex : Marie"
            placeholderTextColor="#475569"
            autoCapitalize="words"
            textContentType="givenName"
          />

          <Text style={styles.label}>Volume de ton sac à eau</Text>
          <Text style={styles.labelHint}>Utilisé pour calculer tes ravitaillements en eau.</Text>
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
            <Text style={styles.primaryButtonText}>Suivant →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step 2 — Notifications
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.stepIndicator}>3 / 3</Text>
        <Text style={styles.notifIcon}>🔔</Text>
        <Text style={styles.title}>Alertes nutrition</Text>
        <Text style={styles.subtitle}>
          Active les notifications pour recevoir tes alertes en course — même quand l'écran est éteint.
        </Text>

        <View style={styles.bullets}>
          <View style={styles.bullet}>
            <Text style={styles.bulletIcon}>⏰</Text>
            <Text style={styles.bulletText}>Rappels de prise de gel aux bons moments</Text>
          </View>
          <View style={styles.bullet}>
            <Text style={styles.bulletIcon}>💧</Text>
            <Text style={styles.bulletText}>Alertes eau et sodium pendant l'effort</Text>
          </View>
          <View style={styles.bullet}>
            <Text style={styles.bulletIcon}>😴</Text>
            <Text style={styles.bulletText}>Snooze et confirmation depuis la notification</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleNotifStep}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.primaryButtonText}>Activer les notifications</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={finishOnboarding}
          disabled={saving}
        >
          <Text style={styles.skipButtonText}>Passer cette étape</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 32,
  },
  stepIndicator: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  notifIcon: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  bullets: {
    gap: 16,
    marginBottom: 40,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  bulletIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
  },
  bulletBold: {
    color: '#f1f5f9',
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 8,
  },
  labelHint: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
    marginTop: -4,
  },
  textInput: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  waterBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    flex: 1,
    alignItems: 'center',
  },
  waterBtnActive: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  waterBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  waterBtnTextActive: {
    color: '#22c55e',
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    color: '#475569',
    fontSize: 15,
  },
});

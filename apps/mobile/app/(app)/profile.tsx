import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { Colors } from '../../constants/colors';
import { usePremium } from '../../hooks/usePremium';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

type UserProfile = {
  full_name: string | null;
  age: number | null;
  birth_date: string | null;
  water_bag_liters: number | null;
  role: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
};

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatBirthDateInput(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function normalizeBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDateInput(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return iso;
}

function calculateAgeFromBirthDate(birthDate: string): number {
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState<number>(1.5);
  const { isPremium, isTrialActive, trialEndsAt } = usePremium();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid || cancelled) return;
      setUserId(uid);

      const profileResult = await supabase
        .from('user_profiles')
        .select('full_name, age, birth_date, water_bag_liters, role, trial_ends_at, trial_started_at')
        .eq('user_id', uid)
        .single();

      if (cancelled) return;

      if (!profileResult.error && profileResult.data) {
        const nextProfile = profileResult.data as UserProfile;
        setProfile(nextProfile);
        setFullName(nextProfile.full_name ?? '');
        setBirthDateInput(formatBirthDateInput(nextProfile.birth_date));
        setWaterBagLiters(nextProfile.water_bag_liters ?? 1.5);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const parsedBirthDate = useMemo(() => {
    const trimmedValue = birthDateInput.trim();
    if (!trimmedValue) return null;
    return parseBirthDateInput(trimmedValue);
  }, [birthDateInput]);

  const computedAge = useMemo(() => {
    if (parsedBirthDate) {
      return calculateAgeFromBirthDate(parsedBirthDate);
    }
    return profile?.age ?? null;
  }, [parsedBirthDate, profile?.age]);

  async function handleSave() {
    if (!userId) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    const trimmedBirthDate = birthDateInput.trim();
    const birthDateIso = trimmedBirthDate ? parseBirthDateInput(trimmedBirthDate) : null;

    if (trimmedBirthDate && !birthDateIso) {
      setSaving(false);
      setError('Entre une date valide au format JJ/MM/AAAA.');
      return;
    }

    const nextAge = birthDateIso ? calculateAgeFromBirthDate(birthDateIso) : null;

    if (nextAge !== null && (nextAge < 0 || nextAge > 120)) {
      setSaving(false);
      setError('La date de naissance doit correspondre a un age entre 0 et 120 ans.');
      return;
    }

    const { error: saveError } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        full_name: fullName.trim() || null,
        birth_date: birthDateIso,
        age: nextAge,
        water_bag_liters: waterBagLiters,
      },
      { onConflict: 'user_id' }
    );

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setProfile((current) => ({
      full_name: fullName.trim() || null,
      birth_date: birthDateIso,
      age: nextAge,
      water_bag_liters: waterBagLiters,
      role: current?.role ?? null,
      trial_ends_at: current?.trial_ends_at ?? null,
      trial_started_at: current?.trial_started_at ?? null,
    }));
    setBirthDateInput(birthDateIso ? formatBirthDateInput(birthDateIso) : '');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    Alert.alert('Se deconnecter ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Deconnexion',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  function handleUpgrade() {
    const url = WEB_URL ? `${WEB_URL}/premium` : null;
    if (!url) {
      Alert.alert('Premium', 'Rendez-vous sur notre site web pour passer en Premium.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir le navigateur.");
    });
  }

  function handleManageSubscription() {
    const url = WEB_URL ? `${WEB_URL}/profile` : null;
    if (!url) {
      Alert.alert('Abonnement', 'Rendez-vous sur notre site web pour gerer votre abonnement.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir le navigateur.");
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
      </View>
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '-';
  const showTrialActive = !isPremium && isTrialActive && trialEndsAt;
  const showTrialExpired = !isPremium && !isTrialActive && trialEndsAt;
  const showFree = !isPremium && !trialEndsAt;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Prenom</Text>
      <TextInput
        style={styles.textInput}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Ton prenom"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="words"
        textContentType="givenName"
      />

      <Text style={styles.label}>Date de naissance</Text>
      <TextInput
        style={styles.textInput}
        value={birthDateInput}
        onChangeText={(value) => setBirthDateInput(normalizeBirthDateInput(value))}
        placeholder="JJ/MM/AAAA"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={10}
      />
      <Text style={styles.helperText}>
        {computedAge !== null ? `Age calcule : ${computedAge} ans` : "L'age sera calcule automatiquement."}
      </Text>

      <Text style={styles.label}>Volume sac a eau</Text>
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.textOnBrand} />
        ) : (
          <Text style={styles.saveButtonText}>{saved ? 'Profil enregistre' : 'Enregistrer'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Abonnement</Text>

          {isPremium ? (
            <View style={[styles.statusBadge, styles.statusBadgePremium]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextPremium]}>Premium</Text>
            </View>
          ) : null}

          {showTrialActive ? (
            <View style={[styles.statusBadge, styles.statusBadgeTrial]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextTrial]}>Essai Premium</Text>
            </View>
          ) : null}

          {showTrialExpired || showFree ? (
            <View style={[styles.statusBadge, styles.statusBadgeFree]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextFree]}>
                {showTrialExpired ? 'Essai expire' : 'Gratuit'}
              </Text>
            </View>
          ) : null}
        </View>

        {showTrialActive && trialEndsAt ? (
          <Text style={styles.trialSubtitle}>Expire le {formatDate(trialEndsAt)}</Text>
        ) : null}

        {showTrialExpired || showFree ? (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>Passer en Premium</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.manageSubscriptionButton} onPress={handleManageSubscription}>
          <Text style={styles.manageSubscriptionButtonText}>Modifier mon abonnement</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t.profile.languageLabel}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, locale === 'fr' && styles.langBtnActive]}
          onPress={() => setLocale('fr')}
        >
          <Text style={[styles.langBtnText, locale === 'fr' && styles.langBtnTextActive]}>
            FR {t.profile.languageFr}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}
          onPress={() => setLocale('en')}
        >
          <Text style={[styles.langBtnText, locale === 'en' && styles.langBtnTextActive]}>
            EN {t.profile.languageEn}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>Pace Yourself v{appVersion}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Se deconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brandPrimary,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  waterBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  waterBtnActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  waterBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  waterBtnTextActive: {
    color: Colors.textOnBrand,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  langBtnActive: {
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
  },
  langBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  langBtnTextActive: {
    color: Colors.brandPrimary,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgePremium: {
    backgroundColor: Colors.brandSurface,
  },
  statusBadgeFree: {
    backgroundColor: Colors.surfaceSecondary,
  },
  statusBadgeTrial: {
    backgroundColor: Colors.warningSurface,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextPremium: {
    color: Colors.brandPrimary,
  },
  statusBadgeTextFree: {
    color: Colors.textSecondary,
  },
  statusBadgeTextTrial: {
    color: Colors.warning,
  },
  trialSubtitle: {
    color: Colors.warning,
    fontSize: 13,
    marginTop: 8,
  },
  upgradeButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
  },
  upgradeButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  manageSubscriptionButton: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manageSubscriptionButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  logoutButton: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: 'transparent',
  },
  logoutButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '500',
  },
});

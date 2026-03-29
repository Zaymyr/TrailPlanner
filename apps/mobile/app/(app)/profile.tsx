import { useEffect, useState } from 'react';
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

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

type UserProfile = {
  full_name: string | null;
  age: number | null;
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

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState<number>(1.5);
  const [isPremium, setIsPremium] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [isTrialActive, setIsTrialActive] = useState(false);
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

      const [profileResult, subResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('full_name, age, water_bag_liters, role, trial_ends_at, trial_started_at')
          .eq('user_id', uid)
          .single(),
        supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', uid)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (!profileResult.error && profileResult.data) {
        const p = profileResult.data as UserProfile;
        setProfile(p);
        setFullName(p.full_name ?? '');
        setWaterBagLiters(p.water_bag_liters ?? 1.5);

        if (p.trial_ends_at) {
          setTrialEndsAt(p.trial_ends_at);
          setIsTrialActive(new Date(p.trial_ends_at).getTime() > Date.now());
        }
      }

      if (!subResult.error && subResult.data) {
        setIsPremium(true);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setSaved(false);

    const { error: err } = await supabase
      .from('user_profiles')
      .update({
        full_name: fullName.trim() || null,
        water_bag_liters: waterBagLiters,
      })
      .eq('user_id', userId);

    setSaving(false);

    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Se déconnecter ?',
      '',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => supabase.auth.signOut(),
        },
      ]
    );
  }

  function handleUpgrade() {
    const url = WEB_URL ? `${WEB_URL}/premium` : null;
    if (!url) {
      Alert.alert('Premium', 'Rendez-vous sur notre site web pour passer en Premium.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le navigateur.');
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
      </View>
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '—';

  // Determine subscription display state
  const showTrialActive = !isPremium && isTrialActive && trialEndsAt;
  const showTrialExpired = !isPremium && !isTrialActive && trialEndsAt;
  const showFree = !isPremium && !trialEndsAt;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Section profil */}
      <Text style={styles.sectionTitle}>Mon profil</Text>

      <Text style={styles.label}>Prénom</Text>
      <TextInput
        style={styles.textInput}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Ton prénom"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="words"
        textContentType="givenName"
      />

      <Text style={styles.label}>Volume sac à eau</Text>
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

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.textOnBrand} />
        ) : (
          <Text style={styles.saveButtonText}>
            {saved ? '✓ Enregistré' : 'Enregistrer'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Statut abonnement */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Abonnement</Text>

          {isPremium && (
            <View style={[styles.statusBadge, styles.statusBadgePremium]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextPremium]}>
                ⚡ Premium
              </Text>
            </View>
          )}

          {showTrialActive && (
            <View style={[styles.statusBadge, styles.statusBadgeTrial]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextTrial]}>
                ⏳ Essai Premium
              </Text>
            </View>
          )}

          {(showTrialExpired || showFree) && (
            <View style={[styles.statusBadge, styles.statusBadgeFree]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextFree]}>
                {showTrialExpired ? 'Essai expiré' : 'Gratuit'}
              </Text>
            </View>
          )}
        </View>

        {showTrialActive && trialEndsAt && (
          <Text style={styles.trialSubtitle}>
            Expire le {formatDate(trialEndsAt)}
          </Text>
        )}

        {(showTrialExpired || showFree) && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>Passer en Premium →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Langue */}
      <Text style={styles.sectionTitle}>{t.profile.languageLabel}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, locale === 'fr' && styles.langBtnActive]}
          onPress={() => setLocale('fr')}
        >
          <Text style={[styles.langBtnText, locale === 'fr' && styles.langBtnTextActive]}>
            🇫🇷 {t.profile.languageFr}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}
          onPress={() => setLocale('en')}
        >
          <Text style={[styles.langBtnText, locale === 'en' && styles.langBtnTextActive]}>
            🇬🇧 {t.profile.languageEn}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <Text style={styles.versionText}>Pace Yourself v{appVersion}</Text>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Se déconnecter</Text>
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.brandPrimary,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  waterBtnActive: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandPrimary,
  },
  waterBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  waterBtnTextActive: {
    color: Colors.brandPrimary,
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
    alignItems: 'center',
  },
  langBtnActive: {
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
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderRadius: 20,
  },
  statusBadgePremium: {
    backgroundColor: Colors.brandSurface,
  },
  statusBadgeFree: {
    backgroundColor: Colors.surfaceMuted,
  },
  statusBadgeTrial: {
    backgroundColor: Colors.warningSurface,
  },
  statusBadgeText: {
    fontSize: 13,
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
    backgroundColor: Colors.brandSurface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  upgradeButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
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
    borderColor: Colors.border,
  },
  logoutButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});

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
} from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';

type UserProfile = {
  full_name: string | null;
  age: number | null;
  water_bag_liters: number | null;
  role: string | null;
};

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState<number>(1.5);
  const [isPremium, setIsPremium] = useState(false);
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
          .select('full_name, age, water_bag_liters, role')
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '—';

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
        placeholderTextColor="#475569"
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
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.saveButtonText}>
            {saved ? '✓ Enregistré' : 'Enregistrer'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Statut abonnement */}
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Abonnement</Text>
        <View style={[styles.statusBadge, isPremium ? styles.statusBadgePremium : styles.statusBadgeFree]}>
          <Text style={[styles.statusBadgeText, isPremium ? styles.statusBadgeTextPremium : styles.statusBadgeTextFree]}>
            {isPremium ? '⚡ Premium' : 'Gratuit'}
          </Text>
        </View>
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
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  waterBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  waterBtnActive: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  waterBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  waterBtnTextActive: {
    color: '#22c55e',
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
    borderColor: '#334155',
    alignItems: 'center',
  },
  langBtnActive: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d',
  },
  langBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  langBtnTextActive: {
    color: '#22c55e',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgePremium: {
    backgroundColor: '#14532d',
  },
  statusBadgeFree: {
    backgroundColor: '#334155',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadgeTextPremium: {
    color: '#22c55e',
  },
  statusBadgeTextFree: {
    color: '#94a3b8',
  },
  versionText: {
    color: '#334155',
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
    borderColor: '#334155',
  },
  logoutButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
});

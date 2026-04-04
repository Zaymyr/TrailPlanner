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
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { Colors } from '../../constants/colors';
import { usePremium } from '../../hooks/usePremium';
import { useRevenueCatBilling } from '../../hooks/useRevenueCatBilling';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';
const ANDROID_PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'com.paceyourself.app';
const PLAY_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`;

type UserProfile = {
  full_name: string | null;
  age: number | null;
  birth_date: string | null;
  water_bag_liters: number | null;
  role: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
};

type ChangelogEntry = {
  id: number;
  published_at: string;
  version: string;
  title: string;
  detail: string;
};

const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
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
  const trimmedValue = value.trim();
  const frenchMatch = /^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})$/.exec(trimmedValue);
  const isoMatch = /^(\d{4})[\/.\-](\d{2})[\/.\-](\d{2})$/.exec(trimmedValue);

  let day: string;
  let month: string;
  let year: string;

  if (frenchMatch) {
    [, day, month, year] = frenchMatch;
  } else if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else {
    const digits = trimmedValue.replace(/\D/g, '');
    if (digits.length !== 8) return null;
    day = digits.slice(0, 2);
    month = digits.slice(2, 4);
    year = digits.slice(4, 8);
  }

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

  if (!hasHadBirthdayThisYear) age -= 1;
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
  const billing = useRevenueCatBilling();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogLoaded, setChangelogLoaded] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);

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
    if (parsedBirthDate) return calculateAgeFromBirthDate(parsedBirthDate);
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
      setError(t.profile.birthDateInvalid);
      return;
    }

    const nextAge = birthDateIso ? calculateAgeFromBirthDate(birthDateIso) : null;
    if (nextAge !== null && (nextAge < 0 || nextAge > 120)) {
      setSaving(false);
      setError(t.profile.birthDateRange);
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
    Alert.alert(t.profile.logoutPrompt, '', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.logoutCta,
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  async function openExternalUrl(url: string | null, fallbackMessage: string) {
    if (!url) {
      Alert.alert(t.profile.subscriptionLabel, fallbackMessage);
      return false;
    }

    try {
      await Linking.openURL(url);
      return true;
    } catch {
      Alert.alert(t.common.error, t.profile.browserError);
      return false;
    }
  }

  const inAppBillingEnabled = Platform.OS === 'android' && billing.isAvailable;
  const billingActionBusy = billing.isLoading || billing.isPurchasing || billing.isRestoring;
  const upgradeLabel = billing.currentPackage
    ? t.profile.upgradeCtaWithPrice.replace('{price}', billing.currentPackage.product.priceString)
    : t.profile.upgradeCta;

  async function handleUpgrade() {
    if (inAppBillingEnabled) {
      try {
        const result = await billing.purchase();

        if (result === 'purchased') {
          Alert.alert(t.common.ok, t.profile.purchaseSuccess);
          return;
        }

        if (result === 'unavailable') {
          Alert.alert(t.profile.subscriptionLabel, t.profile.purchaseUnavailable);
        }

        return;
      } catch (purchaseError) {
        console.error('RevenueCat purchase error:', purchaseError);
        Alert.alert(t.common.error, t.profile.purchaseFailed);
        return;
      }
    }

    const webUrl = WEB_URL ? `${WEB_URL}/premium` : null;
    await openExternalUrl(webUrl, t.profile.premiumFallback);
  }

  async function handleManageSubscription() {
    if (inAppBillingEnabled) {
      const storeUrl = billing.managementUrl ?? PLAY_SUBSCRIPTIONS_URL;
      const openedStore = await openExternalUrl(storeUrl, t.profile.subscriptionFallback);
      if (openedStore) {
        return;
      }
    }

    const webUrl = WEB_URL ? `${WEB_URL}/profile` : null;
    await openExternalUrl(webUrl, t.profile.subscriptionFallback);
  }

  async function handleRestorePurchases() {
    if (!inAppBillingEnabled) {
      Alert.alert(t.profile.subscriptionLabel, t.profile.subscriptionFallback);
      return;
    }

    try {
      const result = await billing.restore();

      if (result === 'restored') {
        Alert.alert(t.common.ok, t.profile.restoreSuccess);
        return;
      }

      if (result === 'unavailable') {
        Alert.alert(t.profile.subscriptionLabel, t.profile.purchaseUnavailable);
      }
    } catch (restoreError) {
      console.error('RevenueCat restore error:', restoreError);
      Alert.alert(t.common.error, t.profile.restoreFailed);
    }
  }

  async function loadChangelog() {
    if (!supabase || changelogLoading) return;

    setChangelogLoading(true);
    setChangelogError(null);

    const { data, error: loadError } = await supabase
      .from('app_changelog')
      .select('id, published_at, version, title, detail')
      .order('published_at', { ascending: false });

    setChangelogLoading(false);

    if (loadError) {
      setChangelogError(loadError.message || t.profile.changelogLoadFailed);
      return;
    }

    setChangelogEntries((data as ChangelogEntry[] | null) ?? []);
    setChangelogLoaded(true);
  }

  function handleOpenChangelog() {
    setShowChangelog(true);
    if (!changelogLoaded) {
      void loadChangelog();
    }
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
      <Text style={styles.label}>{t.profile.firstNameLabel}</Text>
      <TextInput
        style={styles.textInput}
        value={fullName}
        onChangeText={setFullName}
        placeholder={t.profile.namePlaceholder}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="words"
        textContentType="givenName"
      />

      <Text style={styles.label}>{t.profile.birthDateLabel}</Text>
      <TextInput
        style={styles.textInput}
        value={birthDateInput}
        onChangeText={(value) => setBirthDateInput(normalizeBirthDateInput(value))}
        placeholder={t.profile.birthDatePlaceholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={10}
      />
      <Text style={styles.helperText}>
        {computedAge !== null
          ? t.profile.ageCalculated.replace('{age}', String(computedAge))
          : t.profile.birthDateHelp}
      </Text>

      <Text style={styles.label}>{t.profile.waterBagLabel}</Text>
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
          <Text style={styles.saveButtonText}>{saved ? t.profile.saved : t.common.save}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t.profile.subscriptionLabel}</Text>

          {isPremium ? (
            <View style={[styles.statusBadge, styles.statusBadgePremium]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextPremium]}>{t.profile.premiumLabel}</Text>
            </View>
          ) : null}

          {showTrialActive ? (
            <View style={[styles.statusBadge, styles.statusBadgeTrial]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextTrial]}>{t.profile.trialLabel}</Text>
            </View>
          ) : null}

          {showTrialExpired || showFree ? (
            <View style={[styles.statusBadge, styles.statusBadgeFree]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextFree]}>
                {showTrialExpired ? t.profile.trialExpiredLabel : t.profile.freeLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {showTrialActive && trialEndsAt ? (
          <Text style={styles.trialSubtitle}>
            {t.profile.trialExpiresOn.replace('{date}', formatDate(trialEndsAt, locale))}
          </Text>
        ) : null}

        {showTrialExpired || showFree ? (
          <TouchableOpacity
            style={[styles.upgradeButton, billingActionBusy && styles.actionButtonDisabled]}
            onPress={() => void handleUpgrade()}
            disabled={billingActionBusy}
          >
            {billing.isPurchasing ? (
              <ActivityIndicator color={Colors.brandPrimary} />
            ) : (
              <Text style={styles.upgradeButtonText}>{upgradeLabel}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.manageSubscriptionButton, billingActionBusy && styles.actionButtonDisabled]}
          onPress={() => void handleManageSubscription()}
          disabled={billingActionBusy}
        >
          <Text style={styles.manageSubscriptionButtonText}>{t.profile.manageSubscription}</Text>
        </TouchableOpacity>

        {inAppBillingEnabled ? (
          <TouchableOpacity
            style={[styles.restorePurchasesButton, billingActionBusy && styles.actionButtonDisabled]}
            onPress={() => void handleRestorePurchases()}
            disabled={billingActionBusy}
          >
            {billing.isRestoring ? (
              <ActivityIndicator color={Colors.textSecondary} />
            ) : (
              <Text style={styles.restorePurchasesButtonText}>{t.profile.restorePurchases}</Text>
            )}
          </TouchableOpacity>
        ) : null}
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

      <Text style={styles.versionText}>{t.profile.versionLabel.replace('{version}', appVersion)}</Text>
      <TouchableOpacity style={styles.changelogButton} onPress={handleOpenChangelog}>
        <Text style={styles.changelogButtonText}>{t.profile.changelogButton}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>{t.profile.logoutCta}</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowChangelog(false)}
        transparent
        visible={showChangelog}
      >
        <View style={styles.modalWrapper}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowChangelog(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <Text style={styles.modalTitle}>{t.profile.changelogTitle}</Text>
                <Text style={styles.modalSubtitle}>{t.profile.changelogSubtitle}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowChangelog(false)}>
                <Text style={styles.modalCloseButtonText}>{t.common.close}</Text>
              </TouchableOpacity>
            </View>

            {changelogLoading ? (
              <View style={styles.changelogState}>
                <ActivityIndicator color={Colors.brandPrimary} />
                <Text style={styles.changelogStateText}>{t.profile.changelogLoading}</Text>
              </View>
            ) : null}

            {!changelogLoading && changelogError ? (
              <View style={styles.changelogState}>
                <Text style={styles.changelogErrorText}>{changelogError || t.profile.changelogLoadFailed}</Text>
              </View>
            ) : null}

            {!changelogLoading && !changelogError ? (
              <ScrollView contentContainerStyle={styles.changelogList}>
                {changelogEntries.length === 0 ? (
                  <Text style={styles.changelogEmptyText}>{t.profile.changelogEmpty}</Text>
                ) : (
                  changelogEntries.map((entry) => (
                    <View key={entry.id} style={styles.changelogCard}>
                      <Text style={styles.changelogCardTitle}>{entry.title}</Text>
                      <Text style={styles.changelogCardMeta}>
                        {t.profile.changelogVersionMeta
                          .replace('{version}', entry.version)
                          .replace('{date}', formatDate(entry.published_at, locale))}
                      </Text>
                      <Text style={styles.changelogCardDetail}>{entry.detail}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
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
  actionButtonDisabled: {
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
  restorePurchasesButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  restorePurchasesButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  changelogButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  changelogButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
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
  changelogList: {
    paddingBottom: 12,
    gap: 12,
  },
  changelogCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
  },
  changelogCardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  changelogCardMeta: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  changelogCardDetail: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  changelogState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  changelogStateText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  changelogEmptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  changelogErrorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});

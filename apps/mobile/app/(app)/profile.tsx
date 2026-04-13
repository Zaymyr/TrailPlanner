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
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
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
  utmb_index: number | null;
  comfortable_flat_pace_min_per_km: number | null;
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

function formatDate(value: string | Date, locale: string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getRemainingDays(iso: string): number {
  const endTime = new Date(iso).getTime();
  if (!Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)));
}

function formatBirthDateInput(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parseIsoBirthDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  return {
    year: Number(yearValue),
    month: Number(monthValue),
    day: Number(dayValue),
  };
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

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber)
  ) {
    return null;
  }

  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() + 1 !== monthNumber ||
    date.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function calculateAgeFromBirthDate(birthDate: string): number {
  const birthParts = parseIsoBirthDateParts(birthDate);
  if (!birthParts) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthParts.year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > birthParts.month ||
    (today.getMonth() + 1 === birthParts.month && today.getDate() >= birthParts.day);

  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function splitPaceMinutesPerKm(value: number | null | undefined): { minutes: string; seconds: string } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return { minutes: '', seconds: '' };
  }

  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes: String(minutes),
    seconds: String(seconds).padStart(2, '0'),
  };
}

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

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState<number>(1.5);
  const [utmbIndex, setUtmbIndex] = useState('');
  const [comfortableFlatPaceMinutes, setComfortableFlatPaceMinutes] = useState('');
  const [comfortableFlatPaceSeconds, setComfortableFlatPaceSeconds] = useState('');
  const {
    isPremium,
    hasPaidPremium,
    paidPremiumSource,
    subscriptionRenewalAt,
    premiumGrant,
    isTrialActive,
    trialEndsAt,
  } = usePremium();
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
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid || cancelled) return;
      setUserId(uid);

      const profileResult = await supabase
        .from('user_profiles')
        .select(
          'full_name, age, birth_date, water_bag_liters, utmb_index, comfortable_flat_pace_min_per_km, role, trial_ends_at, trial_started_at',
        )
        .eq('user_id', uid)
        .single();

      if (cancelled) return;

      if (!profileResult.error && profileResult.data) {
        const nextProfile = profileResult.data as UserProfile;
        setProfile(nextProfile);
        setFullName(nextProfile.full_name ?? '');
        setBirthDateInput(formatBirthDateInput(nextProfile.birth_date));
        setWaterBagLiters(nextProfile.water_bag_liters ?? 1.5);
        setUtmbIndex(
          typeof nextProfile.utmb_index === 'number' && Number.isFinite(nextProfile.utmb_index)
            ? String(Math.round(nextProfile.utmb_index))
            : '',
        );
        const flatPaceFields = splitPaceMinutesPerKm(nextProfile.comfortable_flat_pace_min_per_km);
        setComfortableFlatPaceMinutes(flatPaceFields.minutes);
        setComfortableFlatPaceSeconds(flatPaceFields.seconds);
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

    const comfortableFlatPaceMinPerKm = parseComfortableFlatPace(
      comfortableFlatPaceMinutes,
      comfortableFlatPaceSeconds,
    );
    if (Number.isNaN(comfortableFlatPaceMinPerKm)) {
      setSaving(false);
      setError(t.profile.comfortableFlatPaceInvalid);
      return;
    }
    const parsedUtmbIndex = utmbIndex.trim() ? Number(utmbIndex.trim()) : null;
    if (
      utmbIndex.trim() &&
      (!Number.isFinite(parsedUtmbIndex) || parsedUtmbIndex === null || parsedUtmbIndex < 0 || parsedUtmbIndex > 2000)
    ) {
      setSaving(false);
      setError(t.profile.utmbIndexInvalid);
      return;
    }

    const { error: saveError } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        full_name: fullName.trim() || null,
        birth_date: birthDateIso,
        age: nextAge,
        water_bag_liters: waterBagLiters,
        utmb_index: parsedUtmbIndex,
        comfortable_flat_pace_min_per_km: comfortableFlatPaceMinPerKm,
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
      utmb_index: parsedUtmbIndex,
      comfortable_flat_pace_min_per_km: comfortableFlatPaceMinPerKm,
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
    ? t.profile.premiumAnnualCta.replace('{price}', billing.currentPackage.product.priceString)
    : t.profile.premiumAnnualFallbackCta;
  const isWebManagedPremium = hasPaidPremium && paidPremiumSource === 'web';

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
    if (paidPremiumSource !== 'web' && inAppBillingEnabled) {
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

  function getChangelogDetail(entry: ChangelogEntry): string {
    const trimmedDetail = entry.detail?.trim();
    if (trimmedDetail) return entry.detail;
    return t.profile.changelogSnapshotFallback.replace('{version}', entry.version);
  }

  function handleOpenChangelog() {
    setShowChangelog(true);
    if (!changelogLoaded) {
      void loadChangelog();
    }
  }

  async function handleCheckForUpdates() {
    if (__DEV__ || !Updates.isEnabled) {
      setUpdateCheckMessage(t.profile.updateCheckUnavailable);
      return;
    }

    setCheckingUpdates(true);
    setUpdateCheckMessage(t.profile.updateChecking);

    try {
      const result = await Updates.checkForUpdateAsync();

      if (result.isRollBackToEmbedded) {
        setUpdateCheckMessage(t.profile.updateCheckRollback);
        await Updates.fetchUpdateAsync().catch(() => null);
        await Updates.reloadAsync();
        return;
      }

      if (!result.isAvailable) {
        setUpdateCheckMessage(t.profile.updateCheckUpToDate);
        setCheckingUpdates(false);
        return;
      }

      setUpdateCheckMessage(t.profile.updateCheckInstalling);
      const fetchResult = await Updates.fetchUpdateAsync();

      if (fetchResult.isNew || fetchResult.isRollBackToEmbedded) {
        await Updates.reloadAsync();
        return;
      }

      setUpdateCheckMessage(t.profile.updateCheckUpToDate);
    } catch (checkError) {
      console.error('Profile update check failed:', checkError);
      const fallback = t.profile.updateCheckFailed;
      const detail = checkError instanceof Error && checkError.message
        ? `${fallback} ${checkError.message}`
        : fallback;
      setUpdateCheckMessage(detail);
    } finally {
      setCheckingUpdates(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
      </View>
    );
  }

  const appVersion =
    Constants.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '-';
  const appBuild = Constants.nativeBuildVersion ?? t.profile.updateDataUnavailable;
  const runtimeVersion = Updates.runtimeVersion ?? t.profile.updateDataUnavailable;
  const channel = Updates.channel ?? t.profile.updateDataUnavailable;
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : t.profile.updateDataUnavailable;
  const updateDate = Updates.createdAt ? formatDate(Updates.createdAt, locale) : t.profile.updateDataUnavailable;
  const updateSource = Updates.isEmbeddedLaunch
    ? t.profile.updateSourceEmbedded
    : t.profile.updateSourceDownloaded;
  const isAdmin = profile?.role === 'admin';
  const showAdminGrant = !hasPaidPremium && premiumGrant !== null;
  const showTrialActive = !hasPaidPremium && !showAdminGrant && isTrialActive && trialEndsAt;
  const showTrialExpired = !isPremium && !isTrialActive && trialEndsAt;
  const showFree = !isPremium && !trialEndsAt;
  const showPremiumBadge = isPremium && !showTrialActive;
  const trialRemainingDays = trialEndsAt ? getRemainingDays(trialEndsAt) : 0;
  const canManagePaidSubscription = hasPaidPremium;
  const showUpgradeAction = !hasPaidPremium && !showAdminGrant;

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
      <Text style={styles.helperText}>{t.profile.waterBagHint}</Text>
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

      <Text style={styles.label}>{t.profile.utmbIndexLabel}</Text>
      <Text style={styles.helperText}>{t.profile.utmbIndexHint}</Text>
      <TextInput
        style={styles.textInput}
        value={utmbIndex}
        onChangeText={(value) => setUtmbIndex(value.replace(/\D/g, '').slice(0, 4))}
        placeholder="600"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={4}
      />

      <Text style={styles.label}>{t.profile.comfortableFlatPaceLabel}</Text>
      <Text style={styles.helperText}>{t.profile.comfortableFlatPaceHint}</Text>
      <View style={styles.paceInputRow}>
        <View style={styles.paceInputGroup}>
          <Text style={styles.paceInputLabel}>{t.profile.comfortableFlatPaceMinutesLabel}</Text>
          <TextInput
            style={styles.paceInput}
            value={comfortableFlatPaceMinutes}
            onChangeText={(value) => setComfortableFlatPaceMinutes(value.replace(/\D/g, '').slice(0, 2))}
            placeholder="6"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <View style={styles.paceInputGroup}>
          <Text style={styles.paceInputLabel}>{t.profile.comfortableFlatPaceSecondsLabel}</Text>
          <TextInput
            style={styles.paceInput}
            value={comfortableFlatPaceSeconds}
            onChangeText={(value) => setComfortableFlatPaceSeconds(value.replace(/\D/g, '').slice(0, 2))}
            placeholder="00"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
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

          {showPremiumBadge ? (
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
          <View style={styles.premiumSourceCard}>
            <Text style={styles.premiumSourceTitle}>{t.profile.premiumSourceTrial}</Text>
            <Text style={styles.premiumSourceText}>
              {t.profile.trialDaysRemaining.replace('{days}', String(trialRemainingDays))}
            </Text>
            <Text style={styles.premiumSourceMeta}>
              {t.profile.trialExpiresOn.replace('{date}', formatDate(trialEndsAt, locale))}
            </Text>
          </View>
        ) : null}

        {hasPaidPremium ? (
          <View style={styles.premiumSourceCard}>
            <Text style={styles.premiumSourceTitle}>{t.profile.premiumSourceSubscription}</Text>
            <Text style={styles.premiumSourceText}>
              {subscriptionRenewalAt
                ? t.profile.subscriptionRenewsOn.replace('{date}', formatDate(subscriptionRenewalAt, locale))
                : t.profile.subscriptionActive}
            </Text>
          </View>
        ) : null}

        {showAdminGrant && premiumGrant ? (
          <View style={styles.premiumSourceCard}>
            <Text style={styles.premiumSourceTitle}>{t.profile.premiumSourceAdminGrant}</Text>
            <Text style={styles.premiumSourceText}>
              {t.profile.adminGrantReason.replace(
                '{reason}',
                premiumGrant.reason || t.profile.adminGrantReasonFallback,
              )}
            </Text>
            <Text style={styles.premiumSourceMeta}>
              {t.profile.adminGrantDaysRemaining.replace('{days}', String(premiumGrant.remainingDays))}
            </Text>
          </View>
        ) : null}

        {showUpgradeAction ? (
          <View style={styles.premiumBenefitsCard}>
            <Text style={styles.premiumBenefitsTitle}>{t.profile.premiumBenefitsTitle}</Text>
            <View style={styles.premiumBenefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.brandPrimary} />
              <Text style={styles.premiumBenefitText}>{t.profile.premiumBenefitPlans}</Text>
            </View>
            <View style={styles.premiumBenefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.brandPrimary} />
              <Text style={styles.premiumBenefitText}>{t.profile.premiumBenefitFavorites}</Text>
            </View>
            <View style={styles.premiumBenefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.brandPrimary} />
              <Text style={styles.premiumBenefitText}>{t.profile.premiumBenefitAutoFill}</Text>
            </View>
          </View>
        ) : null}

        {showUpgradeAction ? (
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

        {isWebManagedPremium ? (
          <Text style={styles.subscriptionHint}>{t.profile.webManagedSubscription}</Text>
        ) : null}

        {canManagePaidSubscription ? (
          <TouchableOpacity
            style={[styles.manageSubscriptionButton, billingActionBusy && styles.actionButtonDisabled]}
            onPress={() => void handleManageSubscription()}
            disabled={billingActionBusy}
          >
            <Text style={styles.manageSubscriptionButtonText}>{t.profile.manageSubscription}</Text>
          </TouchableOpacity>
        ) : null}

        {inAppBillingEnabled && !isWebManagedPremium && !isPremium ? (
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

      <View style={styles.appInfoCard}>
        <Text style={styles.versionText}>{t.profile.versionLabel.replace('{version}', appVersion)}</Text>

        {isAdmin ? (
          <>
            <Text style={styles.buildText}>{t.profile.buildLabel.replace('{build}', appBuild)}</Text>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>{t.profile.runtimeLabel}</Text>
              <Text style={styles.appInfoValue}>{runtimeVersion}</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>{t.profile.channelLabel}</Text>
              <Text style={styles.appInfoValue}>{channel}</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>{t.profile.updateIdLabel}</Text>
              <Text style={styles.appInfoValue}>{updateId}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.appInfoRow}>
          <Text style={styles.appInfoLabel}>{t.profile.updateDateLabel}</Text>
          <Text style={styles.appInfoValue}>{updateDate}</Text>
        </View>
        <View style={styles.appInfoRow}>
          <Text style={styles.appInfoLabel}>{t.profile.updateSourceLabel}</Text>
          <Text style={styles.appInfoValue}>{updateSource}</Text>
        </View>
        {Updates.isEmergencyLaunch ? (
          <Text style={styles.updateCheckMessage}>{t.profile.updateEmergencyLaunch}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.updateCheckButton, checkingUpdates && styles.actionButtonDisabled]}
          onPress={() => void handleCheckForUpdates()}
          disabled={checkingUpdates}
        >
          {checkingUpdates ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.updateCheckButtonText}>{t.profile.updateCheckButton}</Text>
          )}
        </TouchableOpacity>

        {updateCheckMessage ? <Text style={styles.updateCheckMessage}>{updateCheckMessage}</Text> : null}
      </View>

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
                      <Text style={styles.changelogCardDetail}>{getChangelogDetail(entry)}</Text>
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
  paceInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  paceInput: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
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
  premiumSourceCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 14,
  },
  premiumSourceTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  premiumSourceText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  premiumSourceMeta: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  subscriptionHint: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  upgradeButton: {
    backgroundColor: Colors.brandSurface,
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
    fontWeight: '700',
  },
  premiumBenefitsCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 14,
  },
  premiumBenefitsTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  premiumBenefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  premiumBenefitText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  buildText: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  appInfoCard: {
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  appInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  appInfoLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  appInfoValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  updateCheckButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  updateCheckButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  updateCheckMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
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

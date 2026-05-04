import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import {
  estimateHourlyTargets,
  isValidHeightCm,
  isValidWeightKg,
} from '../components/profile/profileEstimator';
import {
  calculateAgeFromBirthDate,
  formatBirthDateInput,
  formatDate,
  getChangelogDetail,
  getRemainingDays,
  parseBirthDateInput,
  parseComfortableFlatPace,
  parseOptionalNonNegativeInteger,
  splitPaceMinutesPerKm,
  type UserProfile,
} from '../components/profile/profileHelpers';
import type {
  CarbEstimatorLevel,
  ChangelogEntry,
  EstimatedHourlyTargets,
  HydrationEstimatorLevel,
  ProfileTabKey,
  SodiumEstimatorLevel,
} from '../components/profile/types';
import { Colors } from '../constants/colors';
import { isAnonymousSession } from '../lib/appSession';
import { useI18n } from '../lib/i18n';
import {
  getLastPushRegistrationStatus,
  type PushRegistrationStatus,
} from '../lib/pushRegistration';
import { supabase } from '../lib/supabase';
import { WEB_API_BASE_URL } from '../lib/webApi';
import { usePremium } from './usePremium';
import { useRevenueCatBilling } from './useRevenueCatBilling';

const ANDROID_PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'com.paceyourself.app';
const PLAY_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`;
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function formatDebugTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPushRegistrationDetails(details?: Record<string, unknown>): string | null {
  if (!details) {
    return null;
  }

  const formattedEntries = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}=${value.join(', ')}`;
      }

      if (typeof value === 'object') {
        try {
          return `${key}=${JSON.stringify(value)}`;
        } catch {
          return `${key}=[object]`;
        }
      }

      return `${key}=${String(value)}`;
    });

  return formattedEntries.length > 0 ? formattedEntries.join(' | ') : null;
}

export function useProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnonymousAccount, setIsAnonymousAccount] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTabKey>('personal');
  const [fullName, setFullName] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState<number>(1.5);
  const [utmbIndex, setUtmbIndex] = useState('');
  const [comfortableFlatPaceMinutes, setComfortableFlatPaceMinutes] = useState('');
  const [comfortableFlatPaceSeconds, setComfortableFlatPaceSeconds] = useState('');
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
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [pushRegistrationStatus, setPushRegistrationStatus] =
    useState<PushRegistrationStatus | null>(null);
  const savedResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      setIsAnonymousAccount(isAnonymousSession(sessionData?.session));

      if (!uid || cancelled) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      setUserId(uid);

      const profileResult = await supabase
        .from('user_profiles')
        .select(
          'full_name, age, birth_date, weight_kg, height_cm, water_bag_liters, utmb_index, comfortable_flat_pace_min_per_km, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour, role, trial_ends_at, trial_started_at',
        )
        .eq('user_id', uid)
        .single();

      if (cancelled) return;

      if (!profileResult.error && profileResult.data) {
        const nextProfile = profileResult.data as UserProfile;
        setProfile(nextProfile);
        setFullName(nextProfile.full_name ?? '');
        setBirthDateInput(formatBirthDateInput(nextProfile.birth_date));
        setWeightKg(
          typeof nextProfile.weight_kg === 'number' && Number.isFinite(nextProfile.weight_kg)
            ? String(Math.round(nextProfile.weight_kg))
            : '',
        );
        setHeightCm(
          typeof nextProfile.height_cm === 'number' && Number.isFinite(nextProfile.height_cm)
            ? String(Math.round(nextProfile.height_cm))
            : '',
        );
        setWaterBagLiters(nextProfile.water_bag_liters ?? 1.5);
        setUtmbIndex(
          typeof nextProfile.utmb_index === 'number' && Number.isFinite(nextProfile.utmb_index)
            ? String(Math.round(nextProfile.utmb_index))
            : '',
        );
        const flatPaceFields = splitPaceMinutesPerKm(nextProfile.comfortable_flat_pace_min_per_km);
        setComfortableFlatPaceMinutes(flatPaceFields.minutes);
        setComfortableFlatPaceSeconds(flatPaceFields.seconds);
        setDefaultCarbsPerHour(
          typeof nextProfile.default_carbs_g_per_hour === 'number' &&
            Number.isFinite(nextProfile.default_carbs_g_per_hour)
            ? String(Math.round(nextProfile.default_carbs_g_per_hour))
            : '',
        );
        setDefaultWaterPerHour(
          typeof nextProfile.default_water_ml_per_hour === 'number' &&
            Number.isFinite(nextProfile.default_water_ml_per_hour)
            ? String(Math.round(nextProfile.default_water_ml_per_hour))
            : '',
        );
        setDefaultSodiumPerHour(
          typeof nextProfile.default_sodium_mg_per_hour === 'number' &&
            Number.isFinite(nextProfile.default_sodium_mg_per_hour)
            ? String(Math.round(nextProfile.default_sodium_mg_per_hour))
            : '',
        );
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (savedResetTimeoutRef.current) {
        clearTimeout(savedResetTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const nextStatus = await getLastPushRegistrationStatus();
        if (active) {
          setPushRegistrationStatus(nextStatus);
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  const parsedBirthDate = useMemo(() => {
    const trimmedValue = birthDateInput.trim();
    if (!trimmedValue) return null;
    return parseBirthDateInput(trimmedValue);
  }, [birthDateInput]);

  const computedAge = useMemo(() => {
    if (parsedBirthDate) return calculateAgeFromBirthDate(parsedBirthDate);
    return profile?.age ?? null;
  }, [parsedBirthDate, profile?.age]);

  const parsedEstimatorWeight = useMemo(
    () => parseOptionalNonNegativeInteger(estimatorWeightKg),
    [estimatorWeightKg],
  );
  const parsedEstimatorHeight = useMemo(
    () => parseOptionalNonNegativeInteger(estimatorHeightCm),
    [estimatorHeightCm],
  );
  const estimatorHasValidBodyMetrics =
    isValidWeightKg(parsedEstimatorWeight) && isValidHeightCm(parsedEstimatorHeight);

  const estimatedTargets = useMemo<EstimatedHourlyTargets | null>(() => {
    if (!estimatorHasValidBodyMetrics) return null;

    return estimateHourlyTargets({
      weightKg: parsedEstimatorWeight,
      heightCm: parsedEstimatorHeight,
      carbLevel: estimatorCarbLevel,
      hydrationLevel: estimatorHydrationLevel,
      sodiumLevel: estimatorSodiumLevel,
    });
  }, [
    estimatorCarbLevel,
    estimatorHasValidBodyMetrics,
    estimatorHydrationLevel,
    estimatorSodiumLevel,
    parsedEstimatorHeight,
    parsedEstimatorWeight,
  ]);

  const handleChangeBirthDate = useCallback((value: string) => {
    setBirthDateInput(value);
  }, []);

  const handleChangeWeightKg = useCallback((value: string) => {
    setWeightKg(sanitizeDigits(value, 3));
  }, []);

  const handleChangeHeightCm = useCallback((value: string) => {
    setHeightCm(sanitizeDigits(value, 3));
  }, []);

  const handleChangeUtmbIndex = useCallback((value: string) => {
    setUtmbIndex(sanitizeDigits(value, 4));
  }, []);

  const handleChangePaceMinutes = useCallback((value: string) => {
    setComfortableFlatPaceMinutes(sanitizeDigits(value, 2));
  }, []);

  const handleChangePaceSeconds = useCallback((value: string) => {
    setComfortableFlatPaceSeconds(sanitizeDigits(value, 2));
  }, []);

  const handleChangeDefaultCarbs = useCallback((value: string) => {
    setDefaultCarbsPerHour(sanitizeDigits(value, 3));
  }, []);

  const handleChangeDefaultWater = useCallback((value: string) => {
    setDefaultWaterPerHour(sanitizeDigits(value, 4));
  }, []);

  const handleChangeDefaultSodium = useCallback((value: string) => {
    setDefaultSodiumPerHour(sanitizeDigits(value, 4));
  }, []);

  const handleChangeEstimatorWeightKg = useCallback((value: string) => {
    setEstimatorWeightKg(sanitizeDigits(value, 3));
  }, []);

  const handleChangeEstimatorHeightCm = useCallback((value: string) => {
    setEstimatorHeightCm(sanitizeDigits(value, 3));
  }, []);

  const handleOpenEstimator = useCallback(() => {
    setEstimatorWeightKg(weightKg);
    setEstimatorHeightCm(heightCm);
    setShowEstimatorModal(true);
  }, [heightCm, weightKg]);

  const handleCloseEstimator = useCallback(() => {
    setShowEstimatorModal(false);
  }, []);

  const handleApplyEstimator = useCallback(() => {
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
    Alert.alert(t.common.ok, t.profile.estimatorApplied);
  }, [
    estimatedTargets,
    parsedEstimatorHeight,
    parsedEstimatorWeight,
    t.common.error,
    t.common.ok,
    t.profile.estimatorApplied,
    t.profile.estimatorMissingBodyMetrics,
  ]);

  const handleSave = useCallback(async () => {
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
      (!Number.isFinite(parsedUtmbIndex) ||
        parsedUtmbIndex === null ||
        parsedUtmbIndex < 0 ||
        parsedUtmbIndex > 2000)
    ) {
      setSaving(false);
      setError(t.profile.utmbIndexInvalid);
      return;
    }

    const parsedWeightKg = parseOptionalNonNegativeInteger(weightKg);
    if (
      Number.isNaN(parsedWeightKg) ||
      (parsedWeightKg !== null && (parsedWeightKg < 20 || parsedWeightKg > 250))
    ) {
      setSaving(false);
      setError(t.profile.weightInvalid);
      return;
    }

    const parsedHeightCm = parseOptionalNonNegativeInteger(heightCm);
    if (
      Number.isNaN(parsedHeightCm) ||
      (parsedHeightCm !== null && (parsedHeightCm < 100 || parsedHeightCm > 250))
    ) {
      setSaving(false);
      setError(t.profile.heightInvalid);
      return;
    }

    const parsedDefaultCarbsPerHour = parseOptionalNonNegativeInteger(defaultCarbsPerHour);
    const parsedDefaultWaterPerHour = parseOptionalNonNegativeInteger(defaultWaterPerHour);
    const parsedDefaultSodiumPerHour = parseOptionalNonNegativeInteger(defaultSodiumPerHour);
    if (
      Number.isNaN(parsedDefaultCarbsPerHour) ||
      Number.isNaN(parsedDefaultWaterPerHour) ||
      Number.isNaN(parsedDefaultSodiumPerHour)
    ) {
      setSaving(false);
      setError(t.profile.defaultTargetsInvalid);
      return;
    }

    const { error: saveError } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        full_name: fullName.trim() || null,
        birth_date: birthDateIso,
        age: nextAge,
        weight_kg: parsedWeightKg,
        height_cm: parsedHeightCm,
        water_bag_liters: waterBagLiters,
        utmb_index: parsedUtmbIndex,
        comfortable_flat_pace_min_per_km: comfortableFlatPaceMinPerKm,
        default_carbs_g_per_hour: parsedDefaultCarbsPerHour,
        default_water_ml_per_hour: parsedDefaultWaterPerHour,
        default_sodium_mg_per_hour: parsedDefaultSodiumPerHour,
      },
      { onConflict: 'user_id' },
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
      weight_kg: parsedWeightKg,
      height_cm: parsedHeightCm,
      water_bag_liters: waterBagLiters,
      utmb_index: parsedUtmbIndex,
      comfortable_flat_pace_min_per_km: comfortableFlatPaceMinPerKm,
      default_carbs_g_per_hour: parsedDefaultCarbsPerHour,
      default_water_ml_per_hour: parsedDefaultWaterPerHour,
      default_sodium_mg_per_hour: parsedDefaultSodiumPerHour,
      role: current?.role ?? null,
      trial_ends_at: current?.trial_ends_at ?? null,
      trial_started_at: current?.trial_started_at ?? null,
    }));
    setBirthDateInput(birthDateIso ? formatBirthDateInput(birthDateIso) : '');
    setSaved(true);

    if (savedResetTimeoutRef.current) {
      clearTimeout(savedResetTimeoutRef.current);
    }
    savedResetTimeoutRef.current = setTimeout(() => {
      setSaved(false);
    }, 2000);
  }, [
    birthDateInput,
    comfortableFlatPaceMinutes,
    comfortableFlatPaceSeconds,
    defaultCarbsPerHour,
    defaultSodiumPerHour,
    defaultWaterPerHour,
    fullName,
    heightCm,
    t.profile.birthDateInvalid,
    t.profile.birthDateRange,
    t.profile.comfortableFlatPaceInvalid,
    t.profile.defaultTargetsInvalid,
    t.profile.heightInvalid,
    t.profile.utmbIndexInvalid,
    t.profile.weightInvalid,
    userId,
    utmbIndex,
    waterBagLiters,
    weightKg,
  ]);

  const handleLogout = useCallback(() => {
    Alert.alert(t.profile.logoutPrompt, '', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.logoutCta,
        style: 'destructive',
        onPress: () => {
          void supabase.auth.signOut();
        },
      },
    ]);
  }, [t.common.cancel, t.profile.logoutCta, t.profile.logoutPrompt]);

  const handleOpenCreateAccount = useCallback(() => {
    router.push('/(auth)/signup');
  }, [router]);

  const handleOpenExistingAccountLogin = useCallback(() => {
    router.push('/(auth)/login');
  }, [router]);

  const openExternalUrl = useCallback(
    async (url: string | null, fallbackMessage: string, title = t.profile.subscriptionLabel) => {
      if (!url) {
        Alert.alert(title, fallbackMessage);
        return false;
      }

      try {
        await Linking.openURL(url);
        return true;
      } catch {
        Alert.alert(t.common.error, t.profile.browserError);
        return false;
      }
    },
    [t.common.error, t.profile.browserError, t.profile.subscriptionLabel],
  );

  const inAppBillingEnabled = billing.isAvailable;
  const billingActionBusy = billing.isLoading || billing.isPurchasing || billing.isRestoring;
  const upgradeLabel = billing.currentPackage
    ? t.profile.premiumAnnualCta.replace('{price}', billing.currentPackage.product.priceString)
    : t.profile.premiumAnnualFallbackCta;
  const isWebManagedPremium = hasPaidPremium && paidPremiumSource === 'web';

  const handleUpgrade = useCallback(async () => {
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

    await openExternalUrl(`${WEB_API_BASE_URL}/premium`, t.profile.premiumFallback);
  }, [
    billing,
    inAppBillingEnabled,
    openExternalUrl,
    t.common.error,
    t.common.ok,
    t.profile.premiumFallback,
    t.profile.purchaseFailed,
    t.profile.purchaseSuccess,
    t.profile.purchaseUnavailable,
    t.profile.subscriptionLabel,
  ]);

  const handleManageSubscription = useCallback(async () => {
    if (paidPremiumSource !== 'web' && inAppBillingEnabled) {
      const fallbackStoreUrl = Platform.OS === 'ios' ? IOS_SUBSCRIPTIONS_URL : PLAY_SUBSCRIPTIONS_URL;
      const storeUrl = billing.managementUrl ?? fallbackStoreUrl;
      const openedStore = await openExternalUrl(storeUrl, t.profile.subscriptionFallback);
      if (openedStore) {
        return;
      }
    }

    await openExternalUrl(`${WEB_API_BASE_URL}/profile`, t.profile.subscriptionFallback);
  }, [
    billing.managementUrl,
    inAppBillingEnabled,
    openExternalUrl,
    paidPremiumSource,
    t.profile.subscriptionFallback,
  ]);

  const handleRestorePurchases = useCallback(async () => {
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
  }, [
    billing,
    inAppBillingEnabled,
    t.common.error,
    t.common.ok,
    t.profile.purchaseUnavailable,
    t.profile.restoreFailed,
    t.profile.restoreSuccess,
    t.profile.subscriptionFallback,
    t.profile.subscriptionLabel,
  ]);

  const loadChangelog = useCallback(async () => {
    if (changelogLoading) return;

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
  }, [changelogLoading, t.profile.changelogLoadFailed]);

  const handleOpenChangelog = useCallback(() => {
    setShowChangelog(true);
    if (!changelogLoaded) {
      void loadChangelog();
    }
  }, [changelogLoaded, loadChangelog]);

  const handleCloseChangelog = useCallback(() => {
    setShowChangelog(false);
  }, []);

  const handleOpenPrivacyPolicy = useCallback(async () => {
    await openExternalUrl(
      `${WEB_API_BASE_URL}/legal/privacy`,
      t.profile.privacyPolicyFallback,
      t.profile.accountSectionTitle,
    );
  }, [
    openExternalUrl,
    t.profile.accountSectionTitle,
    t.profile.privacyPolicyFallback,
  ]);

  const performDeleteAccount = useCallback(async () => {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? null;

    if (!accessToken) {
      Alert.alert(t.common.error, t.profile.deleteAccountFailed);
      return;
    }

    setDeletingAccount(true);

    try {
      const response = await fetch(`${WEB_API_BASE_URL}/api/account/delete`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || t.profile.deleteAccountFailed);
      }

      Alert.alert(t.common.ok, t.profile.deleteAccountSuccess, [
        {
          text: t.common.ok,
          onPress: () => {
            void supabase.auth.signOut();
          },
        },
      ]);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error && deleteError.message
          ? deleteError.message
          : t.profile.deleteAccountFailed;
      Alert.alert(t.common.error, message);
    } finally {
      setDeletingAccount(false);
    }
  }, [
    t.common.error,
    t.common.ok,
    t.profile.deleteAccountFailed,
    t.profile.deleteAccountSuccess,
  ]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t.profile.deleteAccountTitle, t.profile.deleteAccountMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.deleteAccountConfirm,
        style: 'destructive',
        onPress: () => {
          void performDeleteAccount();
        },
      },
    ]);
  }, [
    performDeleteAccount,
    t.common.cancel,
    t.profile.deleteAccountConfirm,
    t.profile.deleteAccountMessage,
    t.profile.deleteAccountTitle,
  ]);

  const handleCheckForUpdates = useCallback(async () => {
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
      const detail =
        checkError instanceof Error && checkError.message
          ? `${fallback} ${checkError.message}`
          : fallback;
      setUpdateCheckMessage(detail);
    } finally {
      setCheckingUpdates(false);
    }
  }, [
    t.profile.updateCheckFailed,
    t.profile.updateCheckInstalling,
    t.profile.updateCheckRollback,
    t.profile.updateCheckUnavailable,
    t.profile.updateCheckUpToDate,
    t.profile.updateChecking,
  ]);

  const appVersion = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '-';
  const appBuild = Constants.nativeBuildVersion ?? t.profile.updateDataUnavailable;
  const runtimeVersion = Updates.runtimeVersion ?? t.profile.updateDataUnavailable;
  const channel = Updates.channel ?? t.profile.updateDataUnavailable;
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : t.profile.updateDataUnavailable;
  const updateDate = Updates.createdAt
    ? formatDate(Updates.createdAt, locale)
    : t.profile.updateDataUnavailable;
  const updateSource = Updates.isEmbeddedLaunch
    ? t.profile.updateSourceEmbedded
    : t.profile.updateSourceDownloaded;
  const isAdmin = profile?.role === 'admin';
  const showAdminGrant = !hasPaidPremium && premiumGrant !== null;
  const showTrialActive = Boolean(!hasPaidPremium && !showAdminGrant && isTrialActive && trialEndsAt);
  const showTrialExpired = Boolean(!isPremium && !isTrialActive && trialEndsAt);
  const showFree = !isPremium && !trialEndsAt;
  const showPremiumBadge = isPremium && !showTrialActive;
  const trialRemainingDays = trialEndsAt ? getRemainingDays(trialEndsAt) : 0;
  const canManagePaidSubscription = hasPaidPremium;
  const showUpgradeAction = !hasPaidPremium && !showAdminGrant;
  const showRestorePurchases = inAppBillingEnabled && !isWebManagedPremium && !isPremium;

  const profileTabs = useMemo<Array<{ key: ProfileTabKey; label: string }>>(
    () => [
      { key: 'personal', label: t.profile.personalTabLabel },
      { key: 'performance', label: t.profile.performanceTabLabel },
      { key: 'settings', label: t.profile.settingsTabLabel },
    ],
    [
      t.profile.performanceTabLabel,
      t.profile.personalTabLabel,
      t.profile.settingsTabLabel,
    ],
  );

  const carbEstimatorOptions = useMemo<Array<{ value: CarbEstimatorLevel; label: string }>>(
    () => [
      { value: 'beginner', label: t.profile.estimatorCarbBeginner },
      { value: 'moderate', label: t.profile.estimatorCarbModerate },
      { value: 'gels', label: t.profile.estimatorCarbGels },
      { value: 'high', label: t.profile.estimatorCarbHigh },
    ],
    [
      t.profile.estimatorCarbBeginner,
      t.profile.estimatorCarbGels,
      t.profile.estimatorCarbHigh,
      t.profile.estimatorCarbModerate,
    ],
  );

  const hydrationEstimatorOptions = useMemo<
    Array<{ value: HydrationEstimatorLevel; label: string }>
  >(
    () => [
      { value: 'low', label: t.profile.estimatorHydrationLow },
      { value: 'normal', label: t.profile.estimatorHydrationNormal },
      { value: 'thirsty', label: t.profile.estimatorHydrationThirsty },
      { value: 'very_thirsty', label: t.profile.estimatorHydrationVeryThirsty },
    ],
    [
      t.profile.estimatorHydrationLow,
      t.profile.estimatorHydrationNormal,
      t.profile.estimatorHydrationThirsty,
      t.profile.estimatorHydrationVeryThirsty,
    ],
  );

  const sodiumEstimatorOptions = useMemo<Array<{ value: SodiumEstimatorLevel; label: string }>>(
    () => [
      { value: 'low', label: t.profile.estimatorSodiumLow },
      { value: 'normal', label: t.profile.estimatorSodiumNormal },
      { value: 'salty', label: t.profile.estimatorSodiumSalty },
      { value: 'very_salty', label: t.profile.estimatorSodiumVerySalty },
    ],
    [
      t.profile.estimatorSodiumLow,
      t.profile.estimatorSodiumNormal,
      t.profile.estimatorSodiumSalty,
      t.profile.estimatorSodiumVerySalty,
    ],
  );

  const birthDateHelpText = useMemo(
    () =>
      computedAge !== null
        ? t.profile.ageCalculated.replace('{age}', String(computedAge))
        : t.profile.birthDateHelp,
    [computedAge, t.profile.ageCalculated, t.profile.birthDateHelp],
  );

  const saveButtonLabel = useMemo(
    () => (saved ? t.profile.saved : t.common.save),
    [saved, t.common.save, t.profile.saved],
  );

  const premiumBadges = useMemo(
    () =>
      [
        showPremiumBadge ? { tone: 'premium' as const, label: t.profile.premiumLabel } : null,
        showTrialActive ? { tone: 'trial' as const, label: t.profile.trialLabel } : null,
        showTrialExpired
          ? { tone: 'free' as const, label: t.profile.trialExpiredLabel }
          : showFree
            ? { tone: 'free' as const, label: t.profile.freeLabel }
            : null,
      ].filter((badge): badge is { tone: 'premium' | 'trial' | 'free'; label: string } => badge !== null),
    [
      showFree,
      showPremiumBadge,
      showTrialActive,
      showTrialExpired,
      t.profile.freeLabel,
      t.profile.premiumLabel,
      t.profile.trialExpiredLabel,
      t.profile.trialLabel,
    ],
  );

  const premiumInfoCards = useMemo(
    () =>
      [
        showTrialActive && trialEndsAt
          ? {
              id: 'trial',
              title: t.profile.premiumSourceTrial,
              body: t.profile.trialDaysRemaining.replace('{days}', String(trialRemainingDays)),
              meta: t.profile.trialExpiresOn.replace('{date}', formatDate(trialEndsAt, locale)),
            }
          : null,
        hasPaidPremium
          ? {
              id: 'subscription',
              title: t.profile.premiumSourceSubscription,
              body: subscriptionRenewalAt
                ? t.profile.subscriptionRenewsOn.replace(
                    '{date}',
                    formatDate(subscriptionRenewalAt, locale),
                  )
                : t.profile.subscriptionActive,
            }
          : null,
        showAdminGrant && premiumGrant
          ? {
              id: 'admin-grant',
              title: t.profile.premiumSourceAdminGrant,
              body: t.profile.adminGrantReason.replace(
                '{reason}',
                premiumGrant.reason || t.profile.adminGrantReasonFallback,
              ),
              meta: t.profile.adminGrantDaysRemaining.replace(
                '{days}',
                String(premiumGrant.remainingDays),
              ),
            }
          : null,
      ].filter(
        (
          infoCard,
        ): infoCard is {
          id: string;
          title: string;
          body: string;
          meta?: string;
        } => infoCard !== null,
      ),
    [
      hasPaidPremium,
      locale,
      premiumGrant,
      showAdminGrant,
      showTrialActive,
      subscriptionRenewalAt,
      t.profile.adminGrantDaysRemaining,
      t.profile.adminGrantReason,
      t.profile.adminGrantReasonFallback,
      t.profile.premiumSourceAdminGrant,
      t.profile.premiumSourceSubscription,
      t.profile.premiumSourceTrial,
      t.profile.subscriptionActive,
      t.profile.subscriptionRenewsOn,
      t.profile.trialDaysRemaining,
      t.profile.trialExpiresOn,
      trialEndsAt,
      trialRemainingDays,
    ],
  );

  const premiumBenefits = useMemo(
    () => [
      t.profile.premiumBenefitPlans,
      t.profile.premiumBenefitFavorites,
      t.profile.premiumBenefitAutoFill,
    ],
    [
      t.profile.premiumBenefitAutoFill,
      t.profile.premiumBenefitFavorites,
      t.profile.premiumBenefitPlans,
    ],
  );

  const updatesAdminRows = useMemo(
    () =>
      isAdmin
        ? [
            { label: t.profile.runtimeLabel, value: runtimeVersion },
            { label: t.profile.channelLabel, value: channel },
            { label: t.profile.updateIdLabel, value: updateId },
            {
              label: t.profile.pushRegistrationStatusLabel,
              value: pushRegistrationStatus?.reason ?? t.profile.pushRegistrationEmpty,
            },
            ...(pushRegistrationStatus?.recordedAt
              ? [
                  {
                    label: t.profile.pushRegistrationDateLabel,
                    value: formatDebugTimestamp(pushRegistrationStatus.recordedAt, locale),
                  },
                ]
              : []),
            ...(pushRegistrationStatus?.details
              ? [
                  {
                    label: t.profile.pushRegistrationDetailsLabel,
                    value:
                      formatPushRegistrationDetails(pushRegistrationStatus.details) ??
                      t.profile.pushRegistrationEmpty,
                  },
                ]
              : []),
          ]
        : [],
    [
      channel,
      isAdmin,
      locale,
      pushRegistrationStatus,
      t.profile.pushRegistrationDateLabel,
      t.profile.pushRegistrationDetailsLabel,
      t.profile.pushRegistrationEmpty,
      t.profile.pushRegistrationStatusLabel,
      runtimeVersion,
      t.profile.channelLabel,
      t.profile.runtimeLabel,
      t.profile.updateIdLabel,
      updateId,
    ],
  );

  const updatesRows = useMemo(
    () => [
      { label: t.profile.updateDateLabel, value: updateDate },
      { label: t.profile.updateSourceLabel, value: updateSource },
    ],
    [
      t.profile.updateDateLabel,
      t.profile.updateSourceLabel,
      updateDate,
      updateSource,
    ],
  );

  const resolveChangelogDetail = useCallback(
    (entry: ChangelogEntry) => getChangelogDetail(entry, t.profile.changelogSnapshotFallback),
    [t.profile.changelogSnapshotFallback],
  );

  const formatChangelogVersionMeta = useCallback(
    (entry: ChangelogEntry) =>
      t.profile.changelogVersionMeta
        .replace('{version}', entry.version)
        .replace('{date}', formatDate(entry.published_at, locale)),
    [locale, t.profile.changelogVersionMeta],
  );

  return {
    locale,
    setLocale,
    t,
    isAnonymousAccount,
    loading,
    saving,
    error,
    activeProfileTab,
    setActiveProfileTab,
    fullName,
    setFullName,
    birthDateInput,
    weightKg,
    heightCm,
    waterBagLiters,
    setWaterBagLiters,
    utmbIndex,
    comfortableFlatPaceMinutes,
    comfortableFlatPaceSeconds,
    defaultCarbsPerHour,
    defaultWaterPerHour,
    defaultSodiumPerHour,
    showEstimatorModal,
    estimatorWeightKg,
    estimatorHeightCm,
    estimatorCarbLevel,
    estimatorHydrationLevel,
    estimatorSodiumLevel,
    setEstimatorCarbLevel,
    setEstimatorHydrationLevel,
    setEstimatorSodiumLevel,
    estimatedTargets,
    showChangelog,
    changelogLoading,
    changelogError,
    changelogEntries,
    checkingUpdates,
    updateCheckMessage,
    deletingAccount,
    profileTabs,
    birthDateHelpText,
    saveButtonLabel,
    carbEstimatorOptions,
    hydrationEstimatorOptions,
    sodiumEstimatorOptions,
    premiumBadges,
    premiumInfoCards,
    premiumBenefits,
    showUpgradeAction,
    upgradeLabel,
    billingActionBusy,
    isPurchasing: billing.isPurchasing,
    subscriptionHint: isWebManagedPremium ? t.profile.webManagedSubscription : null,
    canManagePaidSubscription,
    showRestorePurchases,
    isRestoring: billing.isRestoring,
    appVersion,
    appBuild,
    updatesAdminRows,
    updatesRows,
    emergencyLaunchMessage: Updates.isEmergencyLaunch ? t.profile.updateEmergencyLaunch : null,
    handleChangeBirthDate,
    handleChangeWeightKg,
    handleChangeHeightCm,
    handleChangeUtmbIndex,
    handleChangePaceMinutes,
    handleChangePaceSeconds,
    handleChangeDefaultCarbs,
    handleChangeDefaultWater,
    handleChangeDefaultSodium,
    handleChangeEstimatorWeightKg,
    handleChangeEstimatorHeightCm,
    handleOpenEstimator,
    handleCloseEstimator,
    handleApplyEstimator,
    handleSave,
    handleLogout,
    handleOpenCreateAccount,
    handleOpenExistingAccountLogin,
    handleUpgrade,
    handleManageSubscription,
    handleRestorePurchases,
    handleOpenPrivacyPolicy,
    handleDeleteAccount,
    handleCheckForUpdates,
    handleOpenChangelog,
    handleCloseChangelog,
    resolveChangelogDetail,
    formatChangelogVersionMeta,
    loadingSpinnerColor: Colors.brandPrimary,
  };
}

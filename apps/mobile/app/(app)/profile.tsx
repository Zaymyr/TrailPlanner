import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Modal,
  Platform,
  Pressable,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
  type LayoutRectangle,
} from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { Colors } from '../../constants/colors';
import { SpotlightTutorial, TutorialTarget } from '../../components/help/SpotlightTutorial';
import { ProfileAccountSection } from '../../components/profile/ProfileAccountSection';
import { ProfileEstimatorModal } from '../../components/profile/ProfileEstimatorModal';
import { ProfileLanguageSection } from '../../components/profile/ProfileLanguageSection';
import { ProfilePerformanceSection } from '../../components/profile/ProfilePerformanceSection';
import { ProfilePersonalSection } from '../../components/profile/ProfilePersonalSection';
import { ProfilePremiumSection } from '../../components/profile/ProfilePremiumSection';
import { ProfileSaveButton } from '../../components/profile/ProfileSaveButton';
import { ProfileTabs } from '../../components/profile/ProfileTabs';
import { ProfileUpdatesSection } from '../../components/profile/ProfileUpdatesSection';
import {
  estimateHourlyTargets,
  isValidHeightCm,
  isValidWeightKg,
} from '../../components/profile/profileEstimator';
import type {
  CarbEstimatorLevel,
  ChangelogEntry,
  EstimatedHourlyTargets,
  HydrationEstimatorLevel,
  ProfileTabKey,
  SodiumEstimatorLevel,
} from '../../components/profile/types';
import { usePremium } from '../../hooks/usePremium';
import {
  addHelpTutorialRequestListener,
  type SpotlightRect,
  type TutorialStep,
} from '../../lib/helpTutorial';
import { useRevenueCatBilling } from '../../hooks/useRevenueCatBilling';
import { WEB_API_BASE_URL } from '../../lib/webApi';

const ANDROID_PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'com.paceyourself.app';
const PLAY_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`;
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const TUTORIAL_MIN_TARGET_TOP = 88;
const TUTORIAL_MIN_BOTTOM_SPACE = 352;
const TUTORIAL_SCROLL_THRESHOLD = 4;
const TUTORIAL_SCROLL_FALLBACK_MS = 420;

type UserProfile = {
  full_name: string | null;
  age: number | null;
  birth_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  water_bag_liters: number | null;
  utmb_index: number | null;
  comfortable_flat_pace_min_per_km: number | null;
  default_carbs_g_per_hour: number | null;
  default_water_ml_per_hour: number | null;
  default_sodium_mg_per_hour: number | null;
  role: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
};

type ProfileTutorialTargetKey =
  | 'personal'
  | 'settings'
  | 'save'
  | 'premium'
  | 'language'
  | 'updates';

type PendingTutorialScroll = {
  targetKey: ProfileTutorialTargetKey;
  timeoutId: ReturnType<typeof setTimeout> | null;
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

function parseOptionalNonNegativeInteger(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const nextValue = Number(trimmedValue);
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    return Number.NaN;
  }

  return nextValue;
}


export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const tutorialScrollOffsetRef = useRef(0);
  const pendingTutorialScrollRef = useRef<PendingTutorialScroll | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
  const [estimatorHydrationLevel, setEstimatorHydrationLevel] = useState<HydrationEstimatorLevel>('normal');
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
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [tutorialTargetRect, setTutorialTargetRect] = useState<SpotlightRect | null>(null);
  const [tutorialViewport, setTutorialViewport] = useState({ width: 0, height: 0 });
  const [tutorialContentHeight, setTutorialContentHeight] = useState(0);
  const [tutorialTargets, setTutorialTargets] = useState<Partial<Record<ProfileTutorialTargetKey, LayoutRectangle>>>(
    {},
  );

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

  const getTabForTutorialTarget = useCallback((targetKey: ProfileTutorialTargetKey): ProfileTabKey => {
    switch (targetKey) {
      case 'personal':
        return 'personal';
      case 'settings':
        return 'performance';
      case 'premium':
      case 'language':
      case 'updates':
        return 'settings';
      case 'save':
      default:
        return activeProfileTab;
    }
  }, [activeProfileTab]);

  const tutorialSteps = useMemo<TutorialStep<ProfileTutorialTargetKey>[]>(
    () => [
      {
        screenKey: 'profile',
        targetKey: 'personal',
        title: t.helpTutorial.profile.personalTitle,
        body: t.helpTutorial.profile.personalBody,
        highlightPadding: 8,
        highlightRadius: 16,
        placement: 'bottom',
      },
      {
        screenKey: 'profile',
        targetKey: 'settings',
        title: t.helpTutorial.profile.settingsTitle,
        body: t.helpTutorial.profile.settingsBody,
        highlightPadding: 8,
        highlightRadius: 16,
      },
      {
        screenKey: 'profile',
        targetKey: 'save',
        title: t.helpTutorial.profile.saveTitle,
        body: t.helpTutorial.profile.saveBody,
        highlightPadding: 6,
        highlightRadius: 16,
      },
      {
        screenKey: 'profile',
        targetKey: 'premium',
        title: t.helpTutorial.profile.premiumTitle,
        body: t.helpTutorial.profile.premiumBody,
        highlightPadding: 10,
        highlightRadius: 22,
      },
      {
        screenKey: 'profile',
        targetKey: 'language',
        title: t.helpTutorial.profile.languageTitle,
        body: t.helpTutorial.profile.languageBody,
        highlightPadding: 8,
        highlightRadius: 16,
      },
    ],
    [t.helpTutorial],
  );

  const registerTutorialTarget = useCallback(
    (targetKey: ProfileTutorialTargetKey, layout: LayoutRectangle) => {
      setTutorialTargets((current) => {
        const previous = current[targetKey];
        if (
          previous &&
          previous.x === layout.x &&
          previous.y === layout.y &&
          previous.width === layout.width &&
          previous.height === layout.height
        ) {
          return current;
        }

        return {
          ...current,
          [targetKey]: layout,
        };
      });
    },
    [],
  );

  const currentTutorialTargetKey = tutorialSteps[tutorialStepIndex]?.targetKey ?? null;

  const clearPendingTutorialScroll = useCallback(() => {
    if (pendingTutorialScrollRef.current?.timeoutId) {
      clearTimeout(pendingTutorialScrollRef.current.timeoutId);
    }
    pendingTutorialScrollRef.current = null;
  }, []);

  const updateTutorialScrollOffset = useCallback((nextOffset: number) => {
    tutorialScrollOffsetRef.current = nextOffset;
  }, []);

  const buildTutorialRect = useCallback((layout: LayoutRectangle, scrollOffset: number): SpotlightRect => {
    return {
      x: layout.x,
      y: layout.y - scrollOffset,
      width: layout.width,
      height: layout.height,
    };
  }, []);

  const completeTutorialAlignment = useCallback(
    (targetKey: ProfileTutorialTargetKey, scrollOffset: number) => {
      const layout = tutorialTargets[targetKey];
      if (!layout) {
        setTutorialTargetRect(null);
        return;
      }

      setTutorialTargetRect(buildTutorialRect(layout, scrollOffset));
      clearPendingTutorialScroll();
    },
    [buildTutorialRect, clearPendingTutorialScroll, tutorialTargets],
  );

  const alignTutorialTarget = useCallback(
    (targetKey: ProfileTutorialTargetKey) => {
      const layout = tutorialTargets[targetKey];
      if (!layout || tutorialViewport.height <= 0) {
        setTutorialTargetRect(null);
        return;
      }

      const currentOffset = tutorialScrollOffsetRef.current;
      const visibleTop = layout.y - currentOffset;
      const visibleBottom = visibleTop + layout.height;
      const maxTargetBottom = Math.max(
        TUTORIAL_MIN_TARGET_TOP + layout.height,
        tutorialViewport.height - TUTORIAL_MIN_BOTTOM_SPACE,
      );

      let desiredOffset = currentOffset;
      if (visibleTop < TUTORIAL_MIN_TARGET_TOP) {
        desiredOffset = layout.y - TUTORIAL_MIN_TARGET_TOP;
      } else if (visibleBottom > maxTargetBottom) {
        desiredOffset = layout.y + layout.height - maxTargetBottom;
      }

      const maxScrollOffset = Math.max(0, tutorialContentHeight - tutorialViewport.height);
      desiredOffset = Math.min(Math.max(0, desiredOffset), maxScrollOffset);

      if (Math.abs(desiredOffset - currentOffset) <= TUTORIAL_SCROLL_THRESHOLD) {
        completeTutorialAlignment(targetKey, currentOffset);
        return;
      }

      clearPendingTutorialScroll();
      setTutorialTargetRect(null);

      const timeoutId = setTimeout(() => {
        completeTutorialAlignment(targetKey, tutorialScrollOffsetRef.current);
      }, TUTORIAL_SCROLL_FALLBACK_MS);

      pendingTutorialScrollRef.current = { targetKey, timeoutId };
      scrollRef.current?.scrollTo({ y: desiredOffset, animated: true });
    },
    [
      clearPendingTutorialScroll,
      completeTutorialAlignment,
      tutorialContentHeight,
      tutorialTargets,
      tutorialViewport.height,
    ],
  );

  useEffect(() => {
    const removeListener = addHelpTutorialRequestListener(({ screenKey }) => {
      if (screenKey !== 'profile') return;

      clearPendingTutorialScroll();
      setTutorialTargetRect(null);
      setTutorialStepIndex(0);
      setTutorialVisible(true);
    });

    return removeListener;
  }, [clearPendingTutorialScroll]);

  useEffect(() => {
    if (!tutorialVisible || !currentTutorialTargetKey) return;

    const nextTab = getTabForTutorialTarget(currentTutorialTargetKey);
    if (activeProfileTab !== nextTab) {
      setActiveProfileTab(nextTab);
    }

    setTutorialTargetRect(null);

    const timeoutId = setTimeout(() => {
      alignTutorialTarget(currentTutorialTargetKey);
    }, activeProfileTab === nextTab ? 0 : 40);

    return () => {
      clearTimeout(timeoutId);
      clearPendingTutorialScroll();
    };
  }, [
    activeProfileTab,
    alignTutorialTarget,
    clearPendingTutorialScroll,
    currentTutorialTargetKey,
    getTabForTutorialTarget,
    tutorialVisible,
  ]);

  const handleProfileTabChange = useCallback((nextTab: ProfileTabKey) => {
    setActiveProfileTab(nextTab);
    setTutorialTargetRect(null);
    clearPendingTutorialScroll();
    updateTutorialScrollOffset(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [clearPendingTutorialScroll, updateTutorialScrollOffset]);

  const handleOpenEstimator = useCallback(() => {
    setEstimatorWeightKg(weightKg);
    setEstimatorHeightCm(heightCm);
    setShowEstimatorModal(true);
  }, [heightCm, weightKg]);

  const handleApplyEstimator = useCallback(() => {
    if (!estimatedTargets || !isValidWeightKg(parsedEstimatorWeight) || !isValidHeightCm(parsedEstimatorHeight)) {
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

  const handleTutorialClose = useCallback(() => {
    clearPendingTutorialScroll();
    setTutorialTargetRect(null);
    setTutorialVisible(false);
  }, [clearPendingTutorialScroll]);

  const handleTutorialNext = useCallback(() => {
    setTutorialStepIndex((current) => {
      if (current >= tutorialSteps.length - 1) {
        clearPendingTutorialScroll();
        setTutorialTargetRect(null);
        setTutorialVisible(false);
        return current;
      }

      return current + 1;
    });
  }, [clearPendingTutorialScroll, tutorialSteps.length]);

  const handleTutorialPrevious = useCallback(() => {
    clearPendingTutorialScroll();
    setTutorialStepIndex((current) => Math.max(0, current - 1));
  }, [clearPendingTutorialScroll]);

  const handleTutorialScrollEvent = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      tutorialScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const handleTutorialScrollSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settledOffset = event.nativeEvent.contentOffset.y;
      tutorialScrollOffsetRef.current = settledOffset;

      const pending = pendingTutorialScrollRef.current;
      if (!pending) return;

      completeTutorialAlignment(pending.targetKey, settledOffset);
    },
    [completeTutorialAlignment],
  );

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
    const parsedWeightKg = parseOptionalNonNegativeInteger(weightKg);
    if (Number.isNaN(parsedWeightKg) || (parsedWeightKg !== null && (parsedWeightKg < 20 || parsedWeightKg > 250))) {
      setSaving(false);
      setError(t.profile.weightInvalid);
      return;
    }
    const parsedHeightCm = parseOptionalNonNegativeInteger(heightCm);
    if (Number.isNaN(parsedHeightCm) || (parsedHeightCm !== null && (parsedHeightCm < 100 || parsedHeightCm > 250))) {
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

  async function openExternalUrl(url: string | null, fallbackMessage: string, title = t.profile.subscriptionLabel) {
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
  }

  const inAppBillingEnabled = billing.isAvailable;
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

    await openExternalUrl(`${WEB_API_BASE_URL}/premium`, t.profile.premiumFallback);
  }

  async function handleManageSubscription() {
    if (paidPremiumSource !== 'web' && inAppBillingEnabled) {
      const fallbackStoreUrl = Platform.OS === 'ios' ? IOS_SUBSCRIPTIONS_URL : PLAY_SUBSCRIPTIONS_URL;
      const storeUrl = billing.managementUrl ?? fallbackStoreUrl;
      const openedStore = await openExternalUrl(storeUrl, t.profile.subscriptionFallback);
      if (openedStore) {
        return;
      }
    }

    await openExternalUrl(`${WEB_API_BASE_URL}/profile`, t.profile.subscriptionFallback);
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

  async function handleOpenPrivacyPolicy() {
    await openExternalUrl(
      `${WEB_API_BASE_URL}/legal/privacy`,
      t.profile.privacyPolicyFallback,
      t.profile.accountSectionTitle,
    );
  }

  async function performDeleteAccount() {
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
  }

  function handleDeleteAccount() {
    Alert.alert(
      t.profile.deleteAccountTitle,
      t.profile.deleteAccountMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.profile.deleteAccountConfirm,
          style: 'destructive',
          onPress: () => void performDeleteAccount(),
        },
      ]
    );
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
  const showTrialActive = Boolean(!hasPaidPremium && !showAdminGrant && isTrialActive && trialEndsAt);
  const showTrialExpired = Boolean(!isPremium && !isTrialActive && trialEndsAt);
  const showFree = !isPremium && !trialEndsAt;
  const showPremiumBadge = isPremium && !showTrialActive;
  const trialRemainingDays = trialEndsAt ? getRemainingDays(trialEndsAt) : 0;
  const canManagePaidSubscription = hasPaidPremium;
  const showUpgradeAction = !hasPaidPremium && !showAdminGrant;
  const profileTabs: Array<{ key: ProfileTabKey; label: string }> = [
    { key: 'personal', label: t.profile.personalTabLabel },
    { key: 'performance', label: t.profile.performanceTabLabel },
    { key: 'settings', label: t.profile.settingsTabLabel },
  ];

  const carbEstimatorOptions: Array<{ value: CarbEstimatorLevel; label: string }> = [
    { value: 'beginner', label: t.profile.estimatorCarbBeginner },
    { value: 'moderate', label: t.profile.estimatorCarbModerate },
    { value: 'gels', label: t.profile.estimatorCarbGels },
    { value: 'high', label: t.profile.estimatorCarbHigh },
  ];
  const hydrationEstimatorOptions: Array<{ value: HydrationEstimatorLevel; label: string }> = [
    { value: 'low', label: t.profile.estimatorHydrationLow },
    { value: 'normal', label: t.profile.estimatorHydrationNormal },
    { value: 'thirsty', label: t.profile.estimatorHydrationThirsty },
    { value: 'very_thirsty', label: t.profile.estimatorHydrationVeryThirsty },
  ];
  const sodiumEstimatorOptions: Array<{ value: SodiumEstimatorLevel; label: string }> = [
    { value: 'low', label: t.profile.estimatorSodiumLow },
    { value: 'normal', label: t.profile.estimatorSodiumNormal },
    { value: 'salty', label: t.profile.estimatorSodiumSalty },
    { value: 'very_salty', label: t.profile.estimatorSodiumVerySalty },
  ];
  const showRestorePurchases = inAppBillingEnabled && !isWebManagedPremium && !isPremium;
  const birthDateHelpText =
    computedAge !== null ? t.profile.ageCalculated.replace('{age}', String(computedAge)) : t.profile.birthDateHelp;
  const saveButtonLabel = saved ? t.profile.saved : t.common.save;
  const premiumBadges = [
    showPremiumBadge ? { tone: 'premium' as const, label: t.profile.premiumLabel } : null,
    showTrialActive ? { tone: 'trial' as const, label: t.profile.trialLabel } : null,
    showTrialExpired
      ? { tone: 'free' as const, label: t.profile.trialExpiredLabel }
      : showFree
        ? { tone: 'free' as const, label: t.profile.freeLabel }
        : null,
  ].filter((badge): badge is { tone: 'premium' | 'trial' | 'free'; label: string } => badge !== null);
  const premiumInfoCards = [
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
            ? t.profile.subscriptionRenewsOn.replace('{date}', formatDate(subscriptionRenewalAt, locale))
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
          meta: t.profile.adminGrantDaysRemaining.replace('{days}', String(premiumGrant.remainingDays)),
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
  );
  const premiumBenefits = [
    t.profile.premiumBenefitPlans,
    t.profile.premiumBenefitFavorites,
    t.profile.premiumBenefitAutoFill,
  ];
  const updatesAdminRows = isAdmin
    ? [
        { label: t.profile.runtimeLabel, value: runtimeVersion },
        { label: t.profile.channelLabel, value: channel },
        { label: t.profile.updateIdLabel, value: updateId },
      ]
    : [];
  const updatesRows = [
    { label: t.profile.updateDateLabel, value: updateDate },
    { label: t.profile.updateSourceLabel, value: updateSource },
  ];

  return (
    <View
      onLayout={(event) =>
        setTutorialViewport({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        onContentSizeChange={(_, height) => setTutorialContentHeight(height)}
        onMomentumScrollEnd={handleTutorialScrollSettled}
        onScroll={handleTutorialScrollEvent}
        onScrollEndDrag={handleTutorialScrollSettled}
        ref={scrollRef}
        scrollEventThrottle={16}
        style={styles.container}
      >
        <ProfileTabs activeTab={activeProfileTab} tabs={profileTabs} onChange={handleProfileTabChange} />

        {activeProfileTab === 'personal' ? (
          <TutorialTarget onMeasure={registerTutorialTarget} targetKey="personal">
            <ProfilePersonalSection
              title={t.profile.personalSectionTitle}
              subtitle={t.profile.personalSectionSubtitle}
              firstNameLabel={t.profile.firstNameLabel}
              firstNamePlaceholder={t.profile.namePlaceholder}
              birthDateLabel={t.profile.birthDateLabel}
              birthDatePlaceholder={t.profile.birthDatePlaceholder}
              birthDateHelpText={birthDateHelpText}
              weightLabel={t.profile.weightLabel}
              weightPlaceholder={t.profile.weightPlaceholder}
              heightLabel={t.profile.heightLabel}
              heightPlaceholder={t.profile.heightPlaceholder}
              fullName={fullName}
              birthDateInput={birthDateInput}
              weightKg={weightKg}
              heightCm={heightCm}
              onChangeFullName={setFullName}
              onChangeBirthDate={(value) => setBirthDateInput(normalizeBirthDateInput(value))}
              onChangeWeightKg={(value) => setWeightKg(value.replace(/\D/g, '').slice(0, 3))}
              onChangeHeightCm={(value) => setHeightCm(value.replace(/\D/g, '').slice(0, 3))}
            />
          </TutorialTarget>
        ) : null}

        {activeProfileTab === 'performance' ? (
          <TutorialTarget onMeasure={registerTutorialTarget} targetKey="settings">
            <ProfilePerformanceSection
              title={t.profile.performanceSectionTitle}
              subtitle={t.profile.performanceSectionSubtitle}
              effortTitle={t.profile.performanceEffortSectionTitle}
              effortHint={t.profile.performanceEffortSectionSubtitle}
              waterBagLabel={t.profile.waterBagLabel}
              utmbIndexLabel={t.profile.utmbIndexLabel}
              comfortableFlatPaceLabel={t.profile.comfortableFlatPaceLabel}
              paceMinutesLabel={t.profile.comfortableFlatPaceMinutesLabel}
              paceSecondsLabel={t.profile.comfortableFlatPaceSecondsLabel}
              planDefaultsTitle={t.profile.planDefaultsSectionTitle}
              planDefaultsHint={t.profile.planDefaultsSectionSubtitle}
              estimatorInlineHint={t.profile.estimatorInlineHint}
              estimatorButtonLabel={t.profile.estimatorButton}
              defaultCarbsLabel={t.profile.defaultCarbsPerHourLabel}
              defaultWaterLabel={t.profile.defaultWaterPerHourLabel}
              defaultSodiumLabel={t.profile.defaultSodiumPerHourLabel}
              waterBagOptions={WATER_BAG_OPTIONS}
              waterBagLiters={waterBagLiters}
              utmbIndex={utmbIndex}
              paceMinutes={comfortableFlatPaceMinutes}
              paceSeconds={comfortableFlatPaceSeconds}
              defaultCarbsPerHour={defaultCarbsPerHour}
              defaultWaterPerHour={defaultWaterPerHour}
              defaultSodiumPerHour={defaultSodiumPerHour}
              onSelectWaterBag={setWaterBagLiters}
              onChangeUtmbIndex={(value) => setUtmbIndex(value.replace(/\D/g, '').slice(0, 4))}
              onChangePaceMinutes={(value) =>
                setComfortableFlatPaceMinutes(value.replace(/\D/g, '').slice(0, 2))
              }
              onChangePaceSeconds={(value) =>
                setComfortableFlatPaceSeconds(value.replace(/\D/g, '').slice(0, 2))
              }
              onChangeDefaultCarbs={(value) => setDefaultCarbsPerHour(value.replace(/\D/g, '').slice(0, 3))}
              onChangeDefaultWater={(value) => setDefaultWaterPerHour(value.replace(/\D/g, '').slice(0, 4))}
              onChangeDefaultSodium={(value) => setDefaultSodiumPerHour(value.replace(/\D/g, '').slice(0, 4))}
              onOpenEstimator={handleOpenEstimator}
            />
          </TutorialTarget>
        ) : null}

        {activeProfileTab === 'settings' ? (
          <>
            <TutorialTarget onMeasure={registerTutorialTarget} targetKey="premium">
              <ProfilePremiumSection
                subscriptionLabel={t.profile.subscriptionLabel}
                badges={premiumBadges}
                infoCards={premiumInfoCards}
                premiumBenefitsTitle={t.profile.premiumBenefitsTitle}
                premiumBenefits={premiumBenefits}
                showPremiumBenefits={showUpgradeAction}
                showUpgradeAction={showUpgradeAction}
                upgradeLabel={upgradeLabel}
                billingActionBusy={billingActionBusy}
                isPurchasing={billing.isPurchasing}
                onUpgrade={() => void handleUpgrade()}
                subscriptionHint={isWebManagedPremium ? t.profile.webManagedSubscription : null}
                canManageSubscription={canManagePaidSubscription}
                manageSubscriptionLabel={t.profile.manageSubscription}
                onManageSubscription={() => void handleManageSubscription()}
                showRestorePurchases={showRestorePurchases}
                restorePurchasesLabel={t.profile.restorePurchases}
                isRestoring={billing.isRestoring}
                onRestorePurchases={() => void handleRestorePurchases()}
              />
            </TutorialTarget>

            <TutorialTarget onMeasure={registerTutorialTarget} targetKey="language">
              <ProfileLanguageSection
                title={t.profile.languageLabel}
                selectedLocale={locale}
                languageFrLabel={t.profile.languageFr}
                languageEnLabel={t.profile.languageEn}
                onSelectLocale={setLocale}
                privacyPolicyLabel={t.profile.privacyPolicyButton}
                onOpenPrivacyPolicy={() => void handleOpenPrivacyPolicy()}
              />
            </TutorialTarget>

            <TutorialTarget onMeasure={registerTutorialTarget} targetKey="updates">
              <ProfileUpdatesSection
                title={t.profile.updatesSectionTitle}
                versionText={t.profile.versionLabel.replace('{version}', appVersion)}
                buildText={isAdmin ? t.profile.buildLabel.replace('{build}', appBuild) : null}
                adminRows={updatesAdminRows}
                rows={updatesRows}
                emergencyLaunchMessage={Updates.isEmergencyLaunch ? t.profile.updateEmergencyLaunch : null}
                updateCheckButtonLabel={t.profile.updateCheckButton}
                checkingUpdates={checkingUpdates}
                updateCheckMessage={updateCheckMessage}
                changelogButtonLabel={t.profile.changelogButton}
                onCheckForUpdates={() => void handleCheckForUpdates()}
                onOpenChangelog={handleOpenChangelog}
              />
            </TutorialTarget>

            <ProfileAccountSection
              title={t.profile.accountSectionTitle}
              logoutLabel={t.profile.logoutCta}
              deleteLabel={t.profile.deleteAccountButton}
              deleting={deletingAccount}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TutorialTarget onMeasure={registerTutorialTarget} targetKey="save">
          <ProfileSaveButton label={saveButtonLabel} loading={saving} onPress={handleSave} />
        </TutorialTarget>
      </ScrollView>

      <SpotlightTutorial
        activeStepIndex={tutorialStepIndex}
        closeLabel={t.helpTutorial.close}
        doneLabel={t.helpTutorial.done}
        loadingLabel={t.helpTutorial.loadingTarget}
        nextLabel={t.helpTutorial.next}
        onClose={handleTutorialClose}
        onNext={handleTutorialNext}
        onPrevious={handleTutorialPrevious}
        previousLabel={t.helpTutorial.previous}
        steps={tutorialSteps}
        targetRect={tutorialTargetRect}
        viewportHeight={tutorialViewport.height}
        viewportWidth={tutorialViewport.width}
        visible={tutorialVisible}
      />

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
        onChangeEstimatorWeightKg={(value) => setEstimatorWeightKg(value.replace(/\D/g, '').slice(0, 3))}
        onChangeEstimatorHeightCm={(value) => setEstimatorHeightCm(value.replace(/\D/g, '').slice(0, 3))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  profileTabsBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileTabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  profileTabButtonActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  profileTabButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  profileTabButtonTextActive: {
    color: Colors.brandPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  profileSectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  personalSectionCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  performanceSectionCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalSectionIconBadge: {
    backgroundColor: Colors.brandSurface,
  },
  performanceSectionIconBadge: {
    backgroundColor: '#EFE3C8',
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  profileSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  profileSectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  profileFieldGroup: {
    marginTop: 12,
  },
  profileFieldGroupCompact: {
    marginTop: 0,
  },
  profileSubcard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    gap: 12,
  },
  planDefaultsSubcard: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  profileSubsection: {
    gap: 4,
  },
  profileSubsectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  profileSubsectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brandPrimary,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 0,
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
  bodyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: Colors.surfaceSecondary,
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
  waterBagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  performanceGroup: {
    gap: 10,
  },
  performanceGroupTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  performanceGroupHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
  },
  performanceMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceMetricBlock: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 132,
  },
  metricTextInput: {
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  compactPaceCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  compactPaceInputGroup: {
    width: 58,
    gap: 4,
  },
  compactPaceLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  compactPaceInput: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  compactPaceSeparator: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    paddingBottom: 8,
  },
  compactPaceInlineUnit: {
    marginLeft: 'auto',
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    overflow: 'hidden',
  },
  profileSectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  profileInlineSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  estimateTargetsButton: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  estimateTargetsButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  defaultTargetsStack: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
  },
  defaultTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  defaultTargetRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  defaultTargetLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  defaultTargetInputShell: {
    width: 116,
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
  defaultTargetInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 0,
  },
  defaultTargetUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 24,
  },
  waterBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    fontSize: 13,
    fontWeight: '600',
  },
  waterBtnTextActive: {
    color: Colors.textOnBrand,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  settingsCardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  estimatorContent: {
    gap: 16,
    paddingBottom: 20,
  },
  estimatorSection: {
    gap: 10,
  },
  estimatorSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  estimatorOptionsList: {
    gap: 8,
  },
  estimatorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  estimatorOptionSelected: {
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  estimatorRadio: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  estimatorRadioSelected: {
    borderColor: Colors.brandPrimary,
  },
  estimatorRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  estimatorOptionText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  estimatorOptionTextSelected: {
    color: Colors.brandPrimary,
  },
  estimatorResultCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    padding: 14,
    gap: 10,
  },
  estimatorResultTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  estimatorResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  estimatorResultLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  estimatorResultValue: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  estimatorMissingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  estimatorNoticeCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
  },
  estimatorNoticeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
  tutorialSectionGroup: {
    marginTop: 12,
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
  deleteAccountButton: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: Colors.warningSurface,
  },
  deleteAccountButtonText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '700',
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

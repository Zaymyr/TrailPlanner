import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/themed/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { PlanLoadingScreen } from '../../components/PlanLoadingScreen';
import type { Product } from '../../components/nutrition/types';
import { ProfileEstimatorModal } from '../../components/profile/ProfileEstimatorModal';
import {
  OnboardingCompletionStep,
  OnboardingOverviewStep,
  OnboardingShell,
  OnboardingTourChoice,
  OnboardingWorkflowStep,
} from '../../components/onboarding/OnboardingIntroSteps';
import {
  OnboardingNutritionTargetsStep,
  OnboardingPerformanceStep,
  OnboardingPersonalStep,
} from '../../components/onboarding/OnboardingProfileSteps';
import { OnboardingNutritionProductsStep } from '../../components/onboarding/OnboardingNutritionProductsStep';
import {
  OnboardingRaceSelectionStep,
  type OnboardingRaceEventGroup as RaceEventGroup,
  type OnboardingRaceOption as RaceOption,
} from '../../components/onboarding/OnboardingRaceSelectionStep';
import { estimateHourlyTargets, isValidHeightCm, isValidWeightKg } from '../../components/profile/profileEstimator';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import {
  parseComfortableFlatPace,
  parseOptionalNonNegativeInteger,
  splitPaceMinutesPerKm,
  WATER_BAG_OPTIONS,
} from '../../components/profile/profileHelpers';
import type { CarbEstimatorLevel, HydrationEstimatorLevel, SodiumEstimatorLevel } from '../../components/profile/types';
import { ensureAppSession, isAnonymousSession } from '../../lib/appSession';
import { loadPlanProductsBootstrap } from '../../components/plan-form/usePlanProducts';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { noteReviewOnboardingCompleted, noteReviewPlanCreated } from '../../lib/appReview';
import { markOnboardingJustCompleted } from '../../lib/onboardingGate';
import { createOnboardingDemoPlan } from '../../lib/onboardingDemoPlan';
import { captureAnalyticsEvent } from '../../lib/posthog';
import {
  saveOnboardingProgress,
  skipOnboardingChoice,
  skipOnboardingKind,
  startOnboarding,
} from '../../lib/onboardingStatus';
import {
  buildGpxImportErrorMessage,
  createPrivateRace,
  pickAndParseGpxDocument,
  type GpxFeedback,
  type ImportedGpxDocument
} from '../../lib/race-import';
import {
  clearPendingOnboardingTransition,
  getPendingOnboardingTransition,
  setPendingOnboardingTransition,
  updatePendingOnboardingTransition
} from '../../lib/onboardingTransition';
import {
  setActivePlanEditSession,
  setPendingPlanEditHelp,
  setPlanEditDraft,
  setPlanEditProductsBootstrap
} from '../../lib/planEditSession';

function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

type RaceOptionWithElevation = RaceOption & { elevation_gain_m: number };

type OnboardingProfileSavePayload = {
  userId: string;
  fullName: string;
  waterBagLiters: number;
  parsedUtmbIndex: number | null;
  comfortableFlatPaceMinPerKm: number | null;
  parsedWeightKg: number | null;
  parsedHeightCm: number | null;
  parsedDefaultCarbsPerHour: number | null;
  parsedDefaultWaterPerHour: number | null;
  parsedDefaultSodiumPerHour: number | null;
  selectedProductIds: string[];
};

type ExistingOnboardingProfileRow = {
  full_name: string | null;
  water_bag_liters: number | null;
  utmb_index: number | null;
  comfortable_flat_pace_min_per_km: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  default_carbs_g_per_hour: number | null;
  default_water_ml_per_hour: number | null;
  default_sodium_mg_per_hour: number | null;
};

function getRaceShortLabel(raceName: string, eventName: string) {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-–—·]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function sortRaceOptions(races: RaceOption[]) {
  return [...races].sort((left, right) => {
    if (left.distance_km !== right.distance_km) {
      return left.distance_km - right.distance_km;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortRaceEvents(events: RaceEventGroup[]) {
  const getTimestamp = (value: string | null) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };

  return [...events].sort((left, right) => {
    const timestampDiff = getTimestamp(left.race_date) - getTimestamp(right.race_date);
    if (timestampDiff !== 0) return timestampDiff;
    return left.name.localeCompare(right.name);
  });
}

function isMissingUserForeignKeyError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: string; details?: string | null; message?: string | null };
  if (candidate.code !== '23503') return false;

  const haystack = `${candidate.details ?? ''} ${candidate.message ?? ''}`.toLowerCase();
  return haystack.includes('table "users"') || haystack.includes("table 'users'") || haystack.includes('auth.users');
}

export default function OnboardingScreen() {
  const { locale, t } = useI18n();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const pendingTransition = getPendingOnboardingTransition();
  const [step, setStep] = useState(0);
  const [skippingOnboarding, setSkippingOnboarding] = useState(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [fullName, setFullName] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState(1.5);
  const [session, setSession] = useState<Session | null>(null);
  const [authChoiceLoading, setAuthChoiceLoading] = useState(false);
  const [authChoiceError, setAuthChoiceError] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [comfortableFlatPaceMinutes, setComfortableFlatPaceMinutes] = useState('');
  const [comfortableFlatPaceSeconds, setComfortableFlatPaceSeconds] = useState('');
  const [utmbIndex, setUtmbIndex] = useState('');
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
  const [raceEventGroups, setRaceEventGroups] = useState<RaceEventGroup[]>([]);
  const [personalRaceOptions, setPersonalRaceOptions] = useState<RaceOption[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedRaceEvent, setSelectedRaceEvent] = useState<RaceEventGroup | null>(null);
  const [raceSearch, setRaceSearch] = useState('');
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [raceLoadError, setRaceLoadError] = useState<string | null>(null);
  const [hasLoadedRaceOptions, setHasLoadedRaceOptions] = useState(false);
  const [importingRaceGpx, setImportingRaceGpx] = useState(false);
  const [raceImportFeedback, setRaceImportFeedback] = useState<GpxFeedback | null>(null);
  const [pendingRaceGpxDocument, setPendingRaceGpxDocument] = useState<ImportedGpxDocument | null>(null);
  const [pendingRaceGpxName, setPendingRaceGpxName] = useState('');
  const [nutritionProducts, setNutritionProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [expandedNutritionBrands, setExpandedNutritionBrands] = useState<string[]>([]);
  const [nutritionSearch, setNutritionSearch] = useState('');
  const [loadingNutritionProducts, setLoadingNutritionProducts] = useState(false);
  const [nutritionLoadError, setNutritionLoadError] = useState<string | null>(null);
  const [hasLoadedNutritionProducts, setHasLoadedNutritionProducts] = useState(false);
  const [saving, setSaving] = useState(Boolean(pendingTransition));
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(
    pendingTransition?.planName ?? null,
  );
  const [loadingProgress, setLoadingProgress] = useState(pendingTransition?.progress ?? 0.08);
  const [profileError, setProfileError] = useState<string | null>(null);
  const router = useRouter();
  const hydratedExistingDataUserIdRef = useRef<string | null>(null);
  const completionPlanId: string | null = null;
  const completedRaceIdParam: string | null = null;
  const completedRaceNameParam: string | null = null;
  const completedHasSelectedProductsParam = false;
  const totalSteps = 6;
  const isGuestOnboardingSession = isAnonymousSession(session);
  const {
    appleModule,
    appleAvailable,
    handleAppleLogin,
    isAppleAuthCanceled,
  } = useAppleAuth({ session });
  const { googleModule, googleAvailable, handleGoogleLogin } = useGoogleAuth({
    noOauthUrlMessage: t.auth.noOauthUrl,
    session,
  });
  const parsedEstimatorWeight = useMemo(
    () => parseOptionalNonNegativeInteger(estimatorWeightKg),
    [estimatorWeightKg],
  );
  const parsedEstimatorHeight = useMemo(
    () => parseOptionalNonNegativeInteger(estimatorHeightCm),
    [estimatorHeightCm],
  );
  const estimatedTargets = useMemo(() => {
    if (!isValidWeightKg(parsedEstimatorWeight) || !isValidHeightCm(parsedEstimatorHeight)) {
      return null;
    }

    return estimateHourlyTargets({
      weightKg: parsedEstimatorWeight,
      heightCm: parsedEstimatorHeight,
      carbLevel: estimatorCarbLevel,
      hydrationLevel: estimatorHydrationLevel,
      sodiumLevel: estimatorSodiumLevel,
    });
  }, [
    estimatorCarbLevel,
    estimatorHydrationLevel,
    estimatorSodiumLevel,
    parsedEstimatorHeight,
    parsedEstimatorWeight,
  ]);
  const allRaceOptions = useMemo(
    () => [...personalRaceOptions, ...raceEventGroups.flatMap((event) => event.races)],
    [personalRaceOptions, raceEventGroups],
  );
  const selectedRace = useMemo((): RaceOptionWithElevation | null => {
    const race = allRaceOptions.find((candidate) => candidate.id === selectedRaceId) ?? null;
    return race?.elevation_gain_m === null ? null : race as RaceOptionWithElevation;
  }, [allRaceOptions, selectedRaceId]);
  const selectedRaceSummary = useMemo(() => {
    if (!selectedRace) return null;

    const parentEvent = raceEventGroups.find((event) =>
      event.races.some((race) => race.id === selectedRace.id),
    );

    if (!parentEvent) {
      return selectedRace.name;
    }

    return `${parentEvent.name} • ${getRaceShortLabel(selectedRace.name, parentEvent.name)}`;
  }, [raceEventGroups, selectedRace]);
  const publicRaceOptions = useMemo(() => [] as RaceOption[], []);
  const isOnboardingStatePristine = useMemo(
    () =>
      fullName.trim().length === 0 &&
      weightKg.length === 0 &&
      heightCm.length === 0 &&
      comfortableFlatPaceMinutes.length === 0 &&
      comfortableFlatPaceSeconds.length === 0 &&
      utmbIndex.length === 0 &&
      defaultCarbsPerHour.length === 0 &&
      defaultWaterPerHour.length === 0 &&
      defaultSodiumPerHour.length === 0 &&
      waterBagLiters === 1.5 &&
      selectedProductIds.length === 0,
    [
      comfortableFlatPaceMinutes,
      comfortableFlatPaceSeconds,
      defaultCarbsPerHour,
      defaultSodiumPerHour,
      defaultWaterPerHour,
      fullName,
      heightCm,
      selectedProductIds.length,
      utmbIndex,
      waterBagLiters,
      weightKg,
    ],
  );
  const carbEstimatorOptions = useMemo(
    () => [
      { value: 'beginner' as const, label: t.profile.estimatorCarbBeginner },
      { value: 'moderate' as const, label: t.profile.estimatorCarbModerate },
      { value: 'gels' as const, label: t.profile.estimatorCarbGels },
      { value: 'high' as const, label: t.profile.estimatorCarbHigh },
    ],
    [
      t.profile.estimatorCarbBeginner,
      t.profile.estimatorCarbGels,
      t.profile.estimatorCarbHigh,
      t.profile.estimatorCarbModerate,
    ],
  );
  const hydrationEstimatorOptions = useMemo(
    () => [
      { value: 'low' as const, label: t.profile.estimatorHydrationLow },
      { value: 'normal' as const, label: t.profile.estimatorHydrationNormal },
      { value: 'thirsty' as const, label: t.profile.estimatorHydrationThirsty },
      { value: 'very_thirsty' as const, label: t.profile.estimatorHydrationVeryThirsty },
    ],
    [
      t.profile.estimatorHydrationLow,
      t.profile.estimatorHydrationNormal,
      t.profile.estimatorHydrationThirsty,
      t.profile.estimatorHydrationVeryThirsty,
    ],
  );
  const sodiumEstimatorOptions = useMemo(
    () => [
      { value: 'low' as const, label: t.profile.estimatorSodiumLow },
      { value: 'normal' as const, label: t.profile.estimatorSodiumNormal },
      { value: 'salty' as const, label: t.profile.estimatorSodiumSalty },
      { value: 'very_salty' as const, label: t.profile.estimatorSodiumVerySalty },
    ],
    [
      t.profile.estimatorSodiumLow,
      t.profile.estimatorSodiumNormal,
      t.profile.estimatorSodiumSalty,
      t.profile.estimatorSodiumVerySalty,
    ],
  );
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

  useEffect(() => {
    let mounted = true;

    void ensureAppSession()
      .then((nextSession) => {
        if (mounted) {
          setSession(nextSession);
        }
      })
      .catch((error) => {
        console.error('Unable to resolve onboarding session:', error);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (mounted) {
        setSession(nextSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id ?? null;

    if (!userId || isAnonymousSession(session)) {
      hydratedExistingDataUserIdRef.current = null;
      return;
    }

    if (!isOnboardingStatePristine) {
      return;
    }

    if (hydratedExistingDataUserIdRef.current === userId) {
      return;
    }

    hydratedExistingDataUserIdRef.current = userId;
    let cancelled = false;

    void (async () => {
      const [profileResult, favoritesResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select(
            'full_name, water_bag_liters, utmb_index, comfortable_flat_pace_min_per_km, weight_kg, height_cm, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour',
          )
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_favorite_products')
          .select('product_id')
          .eq('user_id', userId),
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.error) {
        console.error('Unable to hydrate onboarding profile:', profileResult.error);
      } else if (profileResult.data) {
        const profile = profileResult.data as ExistingOnboardingProfileRow;
        const flatPaceFields = splitPaceMinutesPerKm(profile.comfortable_flat_pace_min_per_km);

        setFullName(profile.full_name ?? '');
        setWaterBagLiters(profile.water_bag_liters ?? 1.5);
        setUtmbIndex(
          typeof profile.utmb_index === 'number' && Number.isFinite(profile.utmb_index)
            ? String(Math.round(profile.utmb_index))
            : '',
        );
        setComfortableFlatPaceMinutes(flatPaceFields.minutes);
        setComfortableFlatPaceSeconds(flatPaceFields.seconds);
        setWeightKg(
          typeof profile.weight_kg === 'number' && Number.isFinite(profile.weight_kg)
            ? String(Math.round(profile.weight_kg))
            : '',
        );
        setHeightCm(
          typeof profile.height_cm === 'number' && Number.isFinite(profile.height_cm)
            ? String(Math.round(profile.height_cm))
            : '',
        );
        setDefaultCarbsPerHour(
          typeof profile.default_carbs_g_per_hour === 'number' &&
            Number.isFinite(profile.default_carbs_g_per_hour)
            ? String(Math.round(profile.default_carbs_g_per_hour))
            : '',
        );
        setDefaultWaterPerHour(
          typeof profile.default_water_ml_per_hour === 'number' &&
            Number.isFinite(profile.default_water_ml_per_hour)
            ? String(Math.round(profile.default_water_ml_per_hour))
            : '',
        );
        setDefaultSodiumPerHour(
          typeof profile.default_sodium_mg_per_hour === 'number' &&
            Number.isFinite(profile.default_sodium_mg_per_hour)
            ? String(Math.round(profile.default_sodium_mg_per_hour))
            : '',
        );
      }

      if (favoritesResult.error) {
        console.error('Unable to hydrate onboarding favorites:', favoritesResult.error);
      } else if (favoritesResult.data) {
        setSelectedProductIds(
          Array.from(
            new Set(
              (favoritesResult.data as Array<{ product_id: string | null }>)
                .map((favorite) => favorite.product_id)
                .filter((productId): productId is string => typeof productId === 'string' && productId.length > 0),
            ),
          ),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnboardingStatePristine, session]);

  async function loadRaceOptions() {
    setLoadingRaces(true);
    setRaceLoadError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;

      const [eventsResult, orphanRacesResult, personalRacesResult] = await Promise.all([
        supabase
          .from('race_events')
          .select(`
            id,
            name,
            location,
            race_date,
            thumbnail_url,
            races!inner (
              id,
              name,
              distance_km,
              elevation_gain_m,
              race_date,
              thumbnail_url,
              created_by,
              is_public,
              location_text
            )
          `)
          .eq('is_live', true)
          .eq('races.is_live', true)
          .order('name'),
        supabase
          .from('races')
          .select('id, name, distance_km, elevation_gain_m, location_text, race_date, is_public, created_by, thumbnail_url')
          .eq('is_live', true)
          .is('event_id', null)
          .eq('is_public', true)
          .order('race_date', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true }),
        userId
          ? supabase
              .from('races')
              .select('id, name, distance_km, elevation_gain_m, location_text, race_date, is_public, created_by, thumbnail_url')
              .eq('is_public', false)
              .eq('created_by', userId)
              .order('race_date', { ascending: true, nullsFirst: false })
              .order('name', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (eventsResult.error) {
        throw eventsResult.error;
      }

      if (orphanRacesResult.error) {
        throw orphanRacesResult.error;
      }

      if (personalRacesResult.error) {
        throw personalRacesResult.error;
      }

      const nextEvents = sortRaceEvents(
        ((eventsResult.data ?? []) as Array<
          Omit<RaceEventGroup, 'location' | 'races'> & {
            location: string | null;
            races?: RaceOption[] | null;
          }
        >).map((event) => ({
          ...event,
          races: sortRaceOptions(
            ((event.races ?? []) as RaceOption[]).map((race) => ({
              ...race,
              location_text: race.location_text ?? event.location ?? null,
              race_date: race.race_date ?? event.race_date ?? null,
              is_public: race.is_public ?? true,
              created_by: race.created_by ?? null,
            })),
          ),
        })),
      );

      const orphanRaceOptions = sortRaceOptions((orphanRacesResult.data as RaceOption[] | null) ?? []);
      if (orphanRaceOptions.length > 0) {
        nextEvents.push({
          id: '__orphans__',
          name: t.catalog.otherRaces,
          location: null,
          race_date: null,
          thumbnail_url: null,
          races: orphanRaceOptions,
        });
      }

      setRaceEventGroups(nextEvents);
      setPersonalRaceOptions(sortRaceOptions((personalRacesResult.data as RaceOption[] | null) ?? []));
    } catch (error) {
      console.error('Unable to load onboarding races:', error);
      setRaceLoadError(t.onboarding.raceLoadingError);
    } finally {
      setLoadingRaces(false);
      setHasLoadedRaceOptions(true);
    }
  }

  async function loadNutritionProducts() {
    setLoadingNutritionProducts(true);
    setNutritionLoadError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;

      let query = supabase
        .from('products')
        .select('id, name, brand, image_url, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by, is_official')
        .eq('is_archived', false)
        .order('name');

      query = userId ? query.or(`is_live.eq.true,created_by.eq.${userId}`) : query.eq('is_live', true);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const nextProducts = ((data as Product[] | null) ?? []).filter(
        (product) => (product.carbs_g ?? 0) > 0 || (product.sodium_mg ?? 0) > 0,
      );
      setNutritionProducts(nextProducts);
    } catch (error) {
      console.error('Unable to load onboarding nutrition products:', error);
      setNutritionLoadError(t.onboarding.nutritionLoadingError);
    } finally {
      setLoadingNutritionProducts(false);
      setHasLoadedNutritionProducts(true);
    }
  }

  useEffect(() => {
    if (step !== 5) return;

    if (hasLoadedRaceOptions || loadingRaces) return;

    void loadRaceOptions();
  }, [hasLoadedRaceOptions, loadingRaces, step]);

  useEffect(() => {
    if (step !== 6) return;

    if (hasLoadedNutritionProducts || loadingNutritionProducts) return;

    void loadNutritionProducts();
  }, [hasLoadedNutritionProducts, loadingNutritionProducts, step]);

  async function handleStartWithGoogle() {
    setAuthChoiceError(null);
    setAuthChoiceLoading(true);
    captureAnalyticsEvent('onboarding auth choice selected', { choice: 'google' });

    try {
      await handleGoogleLogin();
      setStep(2);
    } catch (error) {
      if (
        googleModule?.isErrorWithCode(error) &&
        (error.code === googleModule.statusCodes.SIGN_IN_CANCELLED ||
          error.code === googleModule.statusCodes.IN_PROGRESS)
      ) {
        return;
      }

      console.error('Google onboarding sign-in error:', error);
      setAuthChoiceError(t.auth.googleError);
    } finally {
      setAuthChoiceLoading(false);
    }
  }

  async function handleStartWithApple() {
    if (!appleModule || !appleAvailable) return;

    setAuthChoiceError(null);
    setAuthChoiceLoading(true);
    captureAnalyticsEvent('onboarding auth choice selected', { choice: 'apple' });

    try {
      await handleAppleLogin();
      setStep(2);
    } catch (error) {
      if (isAppleAuthCanceled(error)) {
        return;
      }

      console.error('Apple onboarding sign-in error:', error);
      setAuthChoiceError(t.auth.appleError);
    } finally {
      setAuthChoiceLoading(false);
    }
  }

  function handleContinueWithoutAccount() {
    setAuthChoiceError(null);
    captureAnalyticsEvent('onboarding auth choice selected', { choice: 'guest' });
    setStep(2);
  }

  function validatePersonalStep(): {
    parsedWeightKg: number | null;
    parsedHeightCm: number | null;
  } | null {
    const parsedWeightKg = parseOptionalNonNegativeInteger(weightKg);
    if (
      Number.isNaN(parsedWeightKg) ||
      (parsedWeightKg !== null && (parsedWeightKg < 20 || parsedWeightKg > 250))
    ) {
      setProfileError(t.profile.weightInvalid);
      return null;
    }

    const parsedHeightCm = parseOptionalNonNegativeInteger(heightCm);
    if (
      Number.isNaN(parsedHeightCm) ||
      (parsedHeightCm !== null && (parsedHeightCm < 100 || parsedHeightCm > 250))
    ) {
      setProfileError(t.profile.heightInvalid);
      return null;
    }

    setProfileError(null);
    return {
      parsedWeightKg,
      parsedHeightCm,
    };
  }

  function validatePerformanceStep(): {
    comfortableFlatPaceMinPerKm: number | null;
    parsedUtmbIndex: number | null;
    parsedDefaultCarbsPerHour: number | null;
    parsedDefaultWaterPerHour: number | null;
    parsedDefaultSodiumPerHour: number | null;
  } | null {
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

    const parsedDefaultCarbsPerHour = parseOptionalNonNegativeInteger(defaultCarbsPerHour);
    const parsedDefaultWaterPerHour = parseOptionalNonNegativeInteger(defaultWaterPerHour);
    const parsedDefaultSodiumPerHour = parseOptionalNonNegativeInteger(defaultSodiumPerHour);
    if (
      Number.isNaN(parsedDefaultCarbsPerHour) ||
      Number.isNaN(parsedDefaultWaterPerHour) ||
      Number.isNaN(parsedDefaultSodiumPerHour)
    ) {
      setProfileError(t.profile.defaultTargetsInvalid);
      return null;
    }

    setProfileError(null);
    return {
      comfortableFlatPaceMinPerKm,
      parsedUtmbIndex,
      parsedDefaultCarbsPerHour,
      parsedDefaultWaterPerHour,
      parsedDefaultSodiumPerHour,
    };
  }

  async function saveOnboardingProfileAndFavorites({
    userId,
    fullName: nextFullName,
    waterBagLiters: nextWaterBagLiters,
    parsedUtmbIndex,
    comfortableFlatPaceMinPerKm,
    parsedWeightKg,
    parsedHeightCm,
    parsedDefaultCarbsPerHour,
    parsedDefaultWaterPerHour,
    parsedDefaultSodiumPerHour,
    selectedProductIds: nextSelectedProductIds,
  }: OnboardingProfileSavePayload) {
    const profileUpsert = supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        full_name: nextFullName.trim() || null,
        water_bag_liters: nextWaterBagLiters,
        utmb_index: parsedUtmbIndex,
        comfortable_flat_pace_min_per_km: comfortableFlatPaceMinPerKm,
        weight_kg: parsedWeightKg,
        height_cm: parsedHeightCm,
        default_carbs_g_per_hour: parsedDefaultCarbsPerHour,
        default_water_ml_per_hour: parsedDefaultWaterPerHour,
        default_sodium_mg_per_hour: parsedDefaultSodiumPerHour,
        onboarding_completed_at: new Date().toISOString(),
        plan_onboarding_status: 'completed',
      },
      { onConflict: 'user_id' },
    );

    if (nextSelectedProductIds.length === 0) {
      const { error } = await profileUpsert;
      if (error) throw error;
      return;
    }

    const [profileResult, favoritesResult] = await Promise.all([
      profileUpsert,
      supabase.from('user_favorite_products').upsert(
        nextSelectedProductIds.map((productId) => ({
          user_id: userId,
          product_id: productId,
        })),
        {
          onConflict: 'user_id,product_id',
          ignoreDuplicates: true,
        },
      ),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (favoritesResult.error) throw favoritesResult.error;
  }

  async function finishOnboarding() {
    const personalStep = validatePersonalStep();
    if (!personalStep) {
      return;
    }

    const performanceStep = validatePerformanceStep();
    if (!performanceStep) {
      return;
    }

    setSaving(true);
    setLoadingPlanName(selectedRace?.name ?? null);
    setLoadingProgress(0.08);
    setPendingOnboardingTransition({
      planName: selectedRace?.name ?? null,
      progress: 0.08,
    });
    let nextRoute: string | null = '/(app)/plans';
    let onboardingCompleted = false;

    try {
      setLoadingProgress(0.16);
      updatePendingOnboardingTransition({ progress: 0.16 });
      const session = await ensureAppSession();
      let userId = session?.user?.id ?? null;
      const canRecoverGuestSession = isAnonymousSession(session);

      if (userId) {
        setLoadingProgress(0.3);
        updatePendingOnboardingTransition({ progress: 0.3 });
        await saveOnboardingProfileAndFavorites({
          userId,
          fullName,
          waterBagLiters,
          parsedUtmbIndex: performanceStep.parsedUtmbIndex,
          comfortableFlatPaceMinPerKm: performanceStep.comfortableFlatPaceMinPerKm,
          parsedWeightKg: personalStep.parsedWeightKg,
          parsedHeightCm: personalStep.parsedHeightCm,
          parsedDefaultCarbsPerHour: performanceStep.parsedDefaultCarbsPerHour,
          parsedDefaultWaterPerHour: performanceStep.parsedDefaultWaterPerHour,
          parsedDefaultSodiumPerHour: performanceStep.parsedDefaultSodiumPerHour,
          selectedProductIds,
        });
        onboardingCompleted = true;

        if (selectedRace) {
          setLoadingPlanName(selectedRace.name);
          setLoadingProgress(0.48);
          updatePendingOnboardingTransition({
            planName: selectedRace.name,
            progress: 0.48,
          });
          const profileDefaults = {
            comfortable_flat_pace_min_per_km: performanceStep.comfortableFlatPaceMinPerKm,
            default_carbs_g_per_hour: performanceStep.parsedDefaultCarbsPerHour,
            default_water_ml_per_hour: performanceStep.parsedDefaultWaterPerHour,
            default_sodium_mg_per_hour: performanceStep.parsedDefaultSodiumPerHour,
            water_bag_liters: waterBagLiters,
          };

          let demoPlan:
            | Awaited<ReturnType<typeof createOnboardingDemoPlan>>
            | null = null;

          try {
            demoPlan = await createOnboardingDemoPlan({
              userId,
              race: selectedRace,
              profileDefaults,
              selectedProductIds,
            });
          } catch (error) {
            if (canRecoverGuestSession && isMissingUserForeignKeyError(error)) {
              await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

              const recoveredSession = await ensureAppSession();
              const recoveredUserId = recoveredSession?.user?.id ?? null;

              if (recoveredUserId && recoveredUserId !== userId) {
                userId = recoveredUserId;

                await saveOnboardingProfileAndFavorites({
                  userId,
                  fullName,
                  waterBagLiters,
                  parsedUtmbIndex: performanceStep.parsedUtmbIndex,
                  comfortableFlatPaceMinPerKm: performanceStep.comfortableFlatPaceMinPerKm,
                  parsedWeightKg: personalStep.parsedWeightKg,
                  parsedHeightCm: personalStep.parsedHeightCm,
                  parsedDefaultCarbsPerHour: performanceStep.parsedDefaultCarbsPerHour,
                  parsedDefaultWaterPerHour: performanceStep.parsedDefaultWaterPerHour,
                  parsedDefaultSodiumPerHour: performanceStep.parsedDefaultSodiumPerHour,
                  selectedProductIds,
                });

                demoPlan = await createOnboardingDemoPlan({
                  userId,
                  race: selectedRace,
                  profileDefaults,
                  selectedProductIds,
                });
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }

          if (demoPlan) {
            setLoadingPlanName(demoPlan.values.name || selectedRace.name);
            setLoadingProgress(0.78);
            updatePendingOnboardingTransition({
              planName: demoPlan.values.name || selectedRace.name,
              progress: 0.78,
            });
            const planProductsBootstrap = await loadPlanProductsBootstrap(userId);
            setPlanEditDraft(demoPlan.id, {
              elevationProfile: demoPlan.elevationProfile,
              lastSavedSnapshot: JSON.stringify(demoPlan.values),
              planName: demoPlan.values.name,
              values: demoPlan.values,
            });
            setPlanEditProductsBootstrap(demoPlan.id, planProductsBootstrap);
            setActivePlanEditSession(demoPlan.id);
            setPendingPlanEditHelp(demoPlan.id);
            setLoadingProgress(1);
            updatePendingOnboardingTransition({ progress: 1 });
            await noteReviewPlanCreated();
            captureAnalyticsEvent('plan created', {
              source: 'onboarding',
              distance_km: selectedRace.distance_km,
              elevation_gain_m: selectedRace.elevation_gain_m,
              favorite_product_count: selectedProductIds.length,
            });
            nextRoute = `/(app)/plan/${demoPlan.id}/edit?showHelp=1`;
          }
        }
      }
    } catch (error) {
      console.error('Unable to finish onboarding:', error);
    } finally {
      if (onboardingCompleted) {
        await noteReviewOnboardingCompleted();
        captureAnalyticsEvent('onboarding completed', {
          created_plan: nextRoute.includes('/plan/'),
          favorite_product_count: selectedProductIds.length,
          has_race: Boolean(selectedRace),
        });
      }

      if (nextRoute) {
        const currentUserId = (await supabase.auth.getSession()).data.session?.user?.id ?? null;
        if (currentUserId) {
          markOnboardingJustCompleted(currentUserId);
        }
        router.replace(nextRoute);
        return;
      }

      setSaving(false);
      setLoadingPlanName(null);
      setLoadingProgress(0.08);
      clearPendingOnboardingTransition();
    }
  }

  async function skipOnboarding() {
    setSkippingOnboarding(true);

    try {
      const currentSession = await ensureAppSession();
      const userId = currentSession?.user?.id ?? null;

      if (!userId) {
        throw new Error('Unable to resolve a session while skipping onboarding');
      }

      await skipOnboardingKind('plan', `setup_${Math.max(step, 1)}`);
      markOnboardingJustCompleted(userId);
      clearPendingOnboardingTransition();
      router.replace('/(app)/catalog');
    } catch (error) {
      console.error('Unable to skip onboarding:', error);
      Alert.alert(t.common.error, t.onboarding.skipOnboardingError);
      setSkippingOnboarding(false);
    }
  }

  function requestSkipOnboarding() {
    Alert.alert(
      t.onboarding.skipOnboardingConfirmTitle,
      t.onboarding.skipOnboardingConfirmBody,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.onboarding.skipOnboardingCta,
          style: 'default',
          onPress: () => {
            void skipOnboarding();
          },
        },
      ],
    );
  }

  function handlePersonalContinue() {
    const personalStep = validatePersonalStep();
    if (!personalStep) return;
    setStep(3);
  }

  async function handleNotifStep() {
    await finishOnboarding();
  }

  function handlePerformanceContinue() {
    const performanceStep = validatePerformanceStep();
    if (!performanceStep) return;
    setStep(4);
  }

  async function handleTargetsContinue() {
    const personalStep = validatePersonalStep();
    if (!personalStep) return;
    const performanceStep = validatePerformanceStep();
    if (!performanceStep) return;

    setSaving(true);
    try {
      const currentSession = await ensureAppSession();
      const userId = currentSession?.user.id;
      if (!userId) throw new Error('Unable to resolve onboarding user');

      const { error } = await supabase.from('user_profiles').upsert(
        {
          user_id: userId,
          full_name: fullName.trim() || null,
          water_bag_liters: waterBagLiters,
          utmb_index: performanceStep.parsedUtmbIndex,
          comfortable_flat_pace_min_per_km: performanceStep.comfortableFlatPaceMinPerKm,
          weight_kg: personalStep.parsedWeightKg,
          height_cm: personalStep.parsedHeightCm,
          default_carbs_g_per_hour: performanceStep.parsedDefaultCarbsPerHour,
          default_water_ml_per_hour: performanceStep.parsedDefaultWaterPerHour,
          default_sodium_mg_per_hour: performanceStep.parsedDefaultSodiumPerHour,
          plan_onboarding_status: 'in_progress',
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;

      await saveOnboardingProgress({ kind: 'plan', stage: 'catalog' });
      router.replace('/(app)/catalog?onboarding=plan');
    } catch (error) {
      console.error('Unable to continue plan onboarding in catalog:', error);
      Alert.alert(t.common.error, t.onboarding.skipOnboardingError);
      setSaving(false);
    }
  }

  async function handleChooseOnboarding(kind: 'plan' | 'racebook') {
    setChoiceBusy(true);
    try {
      await startOnboarding(kind);
      router.replace(
        kind === 'plan'
          ? '/(app)/onboarding?flow=plan'
          : '/(app)/catalog?onboarding=racebook',
      );
    } catch (error) {
      console.error('Unable to start onboarding:', error);
      Alert.alert(t.common.error, t.onboarding.skipOnboardingError);
      setChoiceBusy(false);
    }
  }

  async function handleSkipChoice() {
    setChoiceBusy(true);
    try {
      await skipOnboardingChoice();
      router.replace('/(app)/catalog');
    } catch (error) {
      console.error('Unable to skip onboarding choice:', error);
      Alert.alert(t.common.error, t.onboarding.skipOnboardingError);
      setChoiceBusy(false);
    }
  }

  function handleSelectRace(raceId: string) {
    setSelectedRaceId(raceId);
    setSelectedRaceEvent(null);
    setRaceImportFeedback(null);
    setStep(6);
  }

  async function handleImportRaceFromGpx() {
    setImportingRaceGpx(true);
    setRaceImportFeedback(null);

    try {
      const picked = await pickAndParseGpxDocument(t);
      if (!picked) {
        return;
      }

      if (picked.parsed.stats.distanceKm <= 0) {
        setRaceImportFeedback({
          tone: 'warning',
          message: `${picked.feedback.message} ${t.races.validationDistancePositive}`,
        });
        return;
      }
      setPendingRaceGpxDocument(picked);
      setPendingRaceGpxName(picked.suggestedRaceName);
    } catch (error) {
      setRaceImportFeedback({
        tone: 'warning',
        message: buildGpxImportErrorMessage(error, t),
      });
    } finally {
      setImportingRaceGpx(false);
    }
  }

  function handleCancelRaceGpxPreview() {
    if (importingRaceGpx) return;
    setPendingRaceGpxDocument(null);
    setPendingRaceGpxName('');
  }

  async function handleConfirmRaceGpxImport() {
    if (!pendingRaceGpxDocument) return;

    setImportingRaceGpx(true);
    setRaceImportFeedback(null);

    try {
      const { race } = await createPrivateRace({
        name: pendingRaceGpxName.trim() || pendingRaceGpxDocument.suggestedRaceName,
        distanceKm: pendingRaceGpxDocument.parsed.stats.distanceKm,
        elevationGainM: Math.round(pendingRaceGpxDocument.parsed.stats.gainM),
        elevationLossM: Math.round(pendingRaceGpxDocument.parsed.stats.lossM),
        gpxContent: pendingRaceGpxDocument.content,
        aidStations: [],
      });

      const nextRace: RaceOption = {
        id: race.id,
        name: race.name,
        distance_km: race.distance_km,
        elevation_gain_m: race.elevation_gain_m,
        location_text: race.location_text ?? null,
        race_date: null,
        is_public: race.is_public,
        created_by: race.created_by ?? null,
        thumbnail_url: null,
      };

      setPersonalRaceOptions((current) =>
        sortRaceOptions([nextRace, ...current.filter((raceOption) => raceOption.id !== nextRace.id)]),
      );
      setSelectedRaceId(nextRace.id);
      setSelectedRaceEvent(null);
      setRaceSearch('');
      setRaceImportFeedback(
        pendingRaceGpxDocument.feedback.tone === 'warning' ? pendingRaceGpxDocument.feedback : null,
      );
      setPendingRaceGpxDocument(null);
      setPendingRaceGpxName('');
      setStep(6);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message === 'Session expired.'
            ? t.raceRequests.sessionExpired
            : error.message
          : t.races.createFailed;
      setRaceImportFeedback({ tone: 'warning', message });
    } finally {
      setImportingRaceGpx(false);
    }
  }

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function handleNutritionContinue() {
    void finishOnboarding();
  }

  function handleBackToRaceChoice() {
    setStep(5);
  }

  function toggleNutritionBrand(brandLabel: string) {
    setExpandedNutritionBrands((current) =>
      current.includes(brandLabel)
        ? current.filter((label) => label !== brandLabel)
        : [...current, brandLabel],
    );
  }

  function handleOpenDemoPlan() {
    if (!completionPlanId) {
      router.replace('/(app)/plans');
      return;
    }

    router.replace(`/(app)/plan/${completionPlanId}/edit?showHelp=1`);
  }

  function handleCreateAnotherPlan() {
    const nextRaceId = selectedRace?.id ?? completedRaceIdParam;

    if (nextRaceId) {
      router.replace(`/(app)/plan/new?raceId=${nextRaceId}`);
      return;
    }

    router.replace('/(app)/plan/new');
  }

  function handleOpenEstimator() {
    setEstimatorWeightKg(weightKg);
    setEstimatorHeightCm(heightCm);
    setShowEstimatorModal(true);
  }

  function handleApplyEstimator() {
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
    setProfileError(null);
  }

  function renderEstimatorModal() {
    return (
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
        onChangeEstimatorWeightKg={(value) => setEstimatorWeightKg(sanitizeDigits(value, 3))}
        onChangeEstimatorHeightCm={(value) => setEstimatorHeightCm(sanitizeDigits(value, 3))}
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
    );
  }

  if (saving) {
    const visiblePlanName = loadingPlanName ?? selectedRace?.name ?? null;
    return (
      <PlanLoadingScreen
        planName={visiblePlanName}
        progress={loadingProgress}
        variant="create"
      />
    );
  }

  if (completionPlanId) {
    const raceName = selectedRace?.name ?? completedRaceNameParam;
    const summaryLines = [
      ...(raceName ? [t.onboarding.completionRaceLine.replace('{name}', raceName)] : []),
      selectedProductIds.length > 0 || completedHasSelectedProductsParam
        ? t.onboarding.completionFilledLine
        : t.onboarding.completionEmptyLine,
      t.onboarding.completionEditLine,
    ];

    return (
      <OnboardingCompletionStep
        totalSteps={totalSteps}
        stepLabel={t.onboarding.stepLabel}
        title={t.onboarding.completionTitle}
        subtitle={t.onboarding.completionSubtitle}
        summaryTitle={t.onboarding.completionSummaryTitle}
        summaryLines={summaryLines}
        primaryLabel={t.onboarding.completionContinueCta}
        newPlanLabel={t.onboarding.completionNewPlanCta}
        onContinue={handleOpenDemoPlan}
        onNewPlan={handleCreateAnotherPlan}
      />
    );
  }

  if (flow !== 'plan') {
    const copy = t.onboarding.tours;

    return (
      <OnboardingTourChoice
        busy={choiceBusy}
        stepLabel={t.onboarding.stepLabel}
        title={copy.choiceTitle}
        subtitle={copy.choiceSubtitle}
        planTitle={copy.planChoiceTitle}
        planBody={copy.planChoiceBody}
        racebookTitle={copy.racebookChoiceTitle}
        racebookBody={copy.racebookChoiceBody}
        discoverLaterLabel={copy.discoverLater}
        onChoosePlan={() => void handleChooseOnboarding('plan')}
        onChooseRacebook={() => void handleChooseOnboarding('racebook')}
        onDiscoverLater={() => void handleSkipChoice()}
      />
    );
  }

  if (step === 0) {
    return (
      <OnboardingOverviewStep
        totalSteps={totalSteps}
        stepLabel={t.onboarding.stepLabel}
        skipLabel={t.onboarding.skipOnboardingCta}
        skipDisabled={skippingOnboarding}
        onSkip={requestSkipOnboarding}
        kicker={t.onboarding.welcomeKicker}
        title={t.onboarding.welcomeTitle}
        subtitle={t.onboarding.welcomeSubtitle}
        phases={overviewPhases}
        startLabel={t.onboarding.startCta}
        onStart={() => setStep(2)}
        accountContent={isGuestOnboardingSession ? (
          <View style={styles.authChoiceCard}>
            <View style={styles.authChoiceBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={Colors.brandPrimary}
              />
            </View>

            <Text style={styles.authChoiceTitle}>{t.onboarding.welcomeAccountTitle}</Text>
            <Text style={styles.authChoiceBody}>{t.onboarding.welcomeAccountBody}</Text>

            {appleModule && appleAvailable ? (
              <View
                pointerEvents={authChoiceLoading ? 'none' : 'auto'}
                style={[styles.appleStartButtonWrap, authChoiceLoading && styles.buttonDisabled]}
              >
                <appleModule.AppleAuthenticationButton
                  buttonStyle={appleModule.AppleAuthenticationButtonStyle.BLACK}
                  buttonType={appleModule.AppleAuthenticationButtonType.CONTINUE}
                  cornerRadius={16}
                  onPress={() => void handleStartWithApple()}
                  style={styles.appleStartButton}
                />
              </View>
            ) : null}

            {googleAvailable ? (
              <TouchableOpacity
                style={[styles.googleStartButton, authChoiceLoading && styles.buttonDisabled]}
                onPress={() => void handleStartWithGoogle()}
                disabled={authChoiceLoading}
              >
                <Ionicons name="logo-google" size={18} color={Colors.brandPrimary} />
                <Text style={styles.googleStartButtonText}>
                  {authChoiceLoading ? t.auth.loggingIn : t.onboarding.welcomeAccountGoogleCta}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.secondaryButton, authChoiceLoading && styles.buttonDisabled]}
              onPress={handleContinueWithoutAccount}
              disabled={authChoiceLoading}
            >
              <Text style={styles.secondaryButtonText}>
                {t.onboarding.welcomeAccountGuestCta}
              </Text>
            </TouchableOpacity>

            {authChoiceError ? <Text style={styles.errorText}>{authChoiceError}</Text> : null}

            <Text style={styles.authChoiceHint}>{t.onboarding.welcomeAccountHint}</Text>
          </View>
        ) : undefined}
      />
    );
  }

  if (step === 1) {
    return (
      <OnboardingWorkflowStep
        totalSteps={totalSteps}
        stepLabel={t.onboarding.stepLabel}
        skipLabel={t.onboarding.skipOnboardingCta}
        skipDisabled={skippingOnboarding}
        onSkip={requestSkipOnboarding}
        kicker={t.onboarding.workflowKicker}
        title={t.onboarding.workflowTitle}
        subtitle={t.onboarding.workflowSubtitle}
        groups={workflowGroups}
        startLabel={t.onboarding.startCta}
        onStart={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return (
      <OnboardingPersonalStep
        step={2}
        totalSteps={totalSteps}
        stepLabel={t.onboarding.stepLabel}
        skipLabel={t.onboarding.skipOnboardingCta}
        skipDisabled={skippingOnboarding}
        onSkip={requestSkipOnboarding}
        title={t.profile.personalSectionTitle}
        subtitle={t.profile.personalSectionSubtitle}
        sectionTitle={t.profile.personalSectionTitle}
        sectionSubtitle={t.profile.personalSectionSubtitle}
        firstNameLabel={t.onboarding.firstNameLabel}
        firstNamePlaceholder={t.onboarding.firstNamePlaceholder}
        fullName={fullName}
        onChangeFullName={(value) => {
          setFullName(value);
          if (profileError) setProfileError(null);
        }}
        weightLabel={t.profile.weightLabel}
        weightPlaceholder={t.profile.weightPlaceholder}
        weightKg={weightKg}
        onChangeWeightKg={(value) => {
          setWeightKg(sanitizeDigits(value, 3));
          if (profileError) setProfileError(null);
        }}
        heightLabel={t.profile.heightLabel}
        heightPlaceholder={t.profile.heightPlaceholder}
        heightCm={heightCm}
        onChangeHeightCm={(value) => {
          setHeightCm(sanitizeDigits(value, 3));
          if (profileError) setProfileError(null);
        }}
        error={profileError}
        continueLabel={t.onboarding.continueCta}
        onContinue={handlePersonalContinue}
      />
    );
  }

  if (step === 3) {
    return (
      <>
        <OnboardingPerformanceStep
          step={3}
          totalSteps={totalSteps}
          stepLabel={t.onboarding.stepLabel}
          skipLabel={t.onboarding.skipOnboardingCta}
          skipDisabled={skippingOnboarding}
          onSkip={requestSkipOnboarding}
          title={t.profile.performanceSectionTitle}
          subtitle={t.onboarding.performanceStepSubtitle}
          waterBagLabel={t.onboarding.waterBagLabel}
          waterBagOptions={WATER_BAG_OPTIONS}
          waterBagLiters={waterBagLiters}
          onChangeWaterBagLiters={setWaterBagLiters}
          comfortableFlatPaceLabel={t.onboarding.comfortableFlatPaceLabel}
          comfortableFlatPaceMinutesLabel={t.onboarding.comfortableFlatPaceMinutesLabel}
          comfortableFlatPaceMinutes={comfortableFlatPaceMinutes}
          onChangeComfortableFlatPaceMinutes={(value) => {
            setComfortableFlatPaceMinutes(sanitizeDigits(value, 2));
            if (profileError) setProfileError(null);
          }}
          comfortableFlatPaceSecondsLabel={t.onboarding.comfortableFlatPaceSecondsLabel}
          comfortableFlatPaceSeconds={comfortableFlatPaceSeconds}
          onChangeComfortableFlatPaceSeconds={(value) => {
            setComfortableFlatPaceSeconds(sanitizeDigits(value, 2));
            if (profileError) setProfileError(null);
          }}
          utmbIndexLabel={t.onboarding.utmbIndexLabel}
          utmbIndexPlaceholder={t.onboarding.utmbIndexPlaceholder}
          utmbIndex={utmbIndex}
          onChangeUtmbIndex={(value) => {
            setUtmbIndex(sanitizeDigits(value, 4));
            if (profileError) setProfileError(null);
          }}
          error={profileError}
          continueLabel={t.onboarding.continueCta}
          onContinue={handlePerformanceContinue}
        />

        {renderEstimatorModal()}
      </>
    );
  }

  if (step === 4) {
    return (
      <>
        <OnboardingNutritionTargetsStep
          step={4}
          totalSteps={totalSteps}
          stepLabel={t.onboarding.stepLabel}
          skipLabel={t.onboarding.skipOnboardingCta}
          skipDisabled={skippingOnboarding}
          onSkip={requestSkipOnboarding}
          title={t.onboarding.nutritionTargetsTitle}
          subtitle={t.onboarding.nutritionTargetsSubtitle}
          estimatorLabel={t.profile.estimatorButton}
          onOpenEstimator={handleOpenEstimator}
          carbsLabel={t.profile.defaultCarbsPerHourLabel}
          carbsValue={defaultCarbsPerHour}
          onChangeCarbs={(value) => {
            setDefaultCarbsPerHour(sanitizeDigits(value, 3));
            if (profileError) setProfileError(null);
          }}
          waterLabel={t.profile.defaultWaterPerHourLabel}
          waterValue={defaultWaterPerHour}
          onChangeWater={(value) => {
            setDefaultWaterPerHour(sanitizeDigits(value, 4));
            if (profileError) setProfileError(null);
          }}
          sodiumLabel={t.profile.defaultSodiumPerHourLabel}
          sodiumValue={defaultSodiumPerHour}
          onChangeSodium={(value) => {
            setDefaultSodiumPerHour(sanitizeDigits(value, 4));
            if (profileError) setProfileError(null);
          }}
          error={profileError}
          continueLabel={t.onboarding.continueCta}
          onContinue={handleTargetsContinue}
        />

        {renderEstimatorModal()}
      </>
    );
  }

  if (step === 5) {
    return (
      <OnboardingRaceSelectionStep
        copy={t}
        locale={locale}
        totalSteps={totalSteps}
        skippingOnboarding={skippingOnboarding}
        onSkip={requestSkipOnboarding}
        raceSearch={raceSearch}
        onChangeRaceSearch={setRaceSearch}
        loadingRaces={loadingRaces}
        raceLoadError={raceLoadError}
        onRetryRaces={() => {
          setHasLoadedRaceOptions(false);
          void loadRaceOptions();
        }}
        personalRaceOptions={personalRaceOptions}
        raceEventGroups={raceEventGroups}
        publicRaceOptions={publicRaceOptions}
        selectedRaceId={selectedRaceId}
        selectedRaceSummary={selectedRaceSummary}
        selectedRaceEvent={selectedRaceEvent}
        onOpenRaceEvent={setSelectedRaceEvent}
        onCloseRaceEvent={() => setSelectedRaceEvent(null)}
        onSelectRace={handleSelectRace}
        importingRaceGpx={importingRaceGpx}
        raceImportFeedback={raceImportFeedback}
        onImportRaceGpx={() => void handleImportRaceFromGpx()}
        pendingRaceGpxDocument={pendingRaceGpxDocument}
        pendingRaceGpxName={pendingRaceGpxName}
        onChangePendingRaceGpxName={setPendingRaceGpxName}
        onCancelRaceGpxPreview={handleCancelRaceGpxPreview}
        onConfirmRaceGpxImport={() => void handleConfirmRaceGpxImport()}
      />
    );
  }
  if (step === 6) {
    return (
      <OnboardingNutritionProductsStep
        copy={t}
        locale={locale}
        totalSteps={totalSteps}
        skippingOnboarding={skippingOnboarding}
        onSkip={requestSkipOnboarding}
        selectedRaceSummary={selectedRaceSummary}
        onChangeRace={handleBackToRaceChoice}
        raceImportFeedback={raceImportFeedback}
        products={nutritionProducts}
        selectedProductIds={selectedProductIds}
        expandedBrands={expandedNutritionBrands}
        search={nutritionSearch}
        onChangeSearch={setNutritionSearch}
        onToggleBrand={toggleNutritionBrand}
        onToggleProduct={toggleProductSelection}
        loading={loadingNutritionProducts}
        loadError={nutritionLoadError}
        onRetry={() => {
          setHasLoadedNutritionProducts(false);
          void loadNutritionProducts();
        }}
        saving={saving}
        onContinue={handleNutritionContinue}
      />
    );
  }
  if (step === 7) {
    return (
      <>
        <OnboardingShell step={7} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
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
              <Text style={styles.primaryButtonText}>
                {selectedRace ? t.onboarding.notificationsDemoPlanCta : t.onboarding.notificationsCta}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={finishOnboarding} disabled={saving}>
            <Text style={styles.secondaryButtonText}>{t.onboarding.skipCta}</Text>
          </TouchableOpacity>
        </OnboardingShell>

        {renderEstimatorModal()}
      </>
    );
  }

  return (
    <>
      <OnboardingShell step={7} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
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

      {renderEstimatorModal()}
    </>
  );
}

const styles = StyleSheet.create({
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
  authChoiceCard: {
    gap: 12,
  },
  authChoiceBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  authChoiceTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  authChoiceBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  authChoiceHint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
  googleStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.surfaceSecondary,
  },
  googleStartButtonText: {
    color: Colors.brandPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  appleStartButton: {
    width: '100%',
    height: 54,
  },
  appleStartButtonWrap: {
    alignSelf: 'stretch',
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

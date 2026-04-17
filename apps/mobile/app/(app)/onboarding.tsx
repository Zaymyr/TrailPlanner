import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { PlanLoadingScreen } from '../../components/PlanLoadingScreen';
import type { FuelType, Product } from '../../components/nutrition/types';
import { ProfileEstimatorModal } from '../../components/profile/ProfileEstimatorModal';
import {
  estimateHourlyTargets,
  isValidHeightCm,
  isValidWeightKg,
} from '../../components/profile/profileEstimator';
import {
  parseComfortableFlatPace,
  parseOptionalNonNegativeInteger,
  WATER_BAG_OPTIONS,
} from '../../components/profile/profileHelpers';
import type {
  CarbEstimatorLevel,
  HydrationEstimatorLevel,
  SodiumEstimatorLevel,
} from '../../components/profile/types';
import { ensureAppSession, isAnonymousSession } from '../../lib/appSession';
import { loadPlanProductsBootstrap } from '../../components/plan-form/usePlanProducts';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { noteReviewOnboardingCompleted, noteReviewPlanCreated } from '../../lib/appReview';
import { markOnboardingJustCompleted } from '../../lib/onboardingGate';
import { createOnboardingDemoPlan } from '../../lib/onboardingDemoPlan';
import {
  clearPendingOnboardingTransition,
  getPendingOnboardingTransition,
  setPendingOnboardingTransition,
  updatePendingOnboardingTransition,
} from '../../lib/onboardingTransition';
import {
  setActivePlanEditSession,
  setPendingPlanEditHelp,
  setPlanEditDraft,
  setPlanEditProductsBootstrap,
} from '../../lib/planEditSession';

function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

type RaceOption = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  location_text: string | null;
  race_date: string | null;
  is_public: boolean;
  created_by: string | null;
  thumbnail_url?: string | null;
};

type RaceEventGroup = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url?: string | null;
  races: RaceOption[];
};

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

const PRODUCT_PRIORITY: Record<FuelType, number> = {
  gel: 0,
  drink_mix: 1,
  electrolyte: 2,
  bar: 3,
  real_food: 4,
  capsule: 5,
  other: 6,
};

function formatRaceDate(isoDate: string | null, locale: 'fr' | 'en') {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatEventDate(isoDate: string | null, locale: 'fr' | 'en') {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function formatElevation(elevationGainM: number) {
  return Math.round(elevationGainM).toString();
}

function getRaceShortLabel(raceName: string, eventName: string) {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-–—·]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function getEventImageUrl(event: Pick<RaceEventGroup, 'thumbnail_url' | 'races'>): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

function getEventDistanceRange(races: RaceOption[]) {
  if (races.length === 0) return null;

  const distances = races.map((race) => race.distance_km);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  if (Math.abs(maxDistance - minDistance) < 0.05) {
    return `${formatDistance(maxDistance)} km`;
  }

  return `${formatDistance(minDistance)}-${formatDistance(maxDistance)} km`;
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

function inferNutritionBrand(productName: string) {
  const fromDelimiter = productName.split(' - ')[0]?.trim();
  const source = fromDelimiter || productName;
  const firstToken = source
    .split(/\s+/)
    .map((part) => part.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, ''))
    .find(Boolean);

  return firstToken || source.trim() || 'Other';
}

function getFuelTypeLabel(fuelType: FuelType, locale: 'fr' | 'en') {
  const labels =
    locale === 'fr'
      ? {
          gel: 'Gel',
          drink_mix: 'Boisson',
          electrolyte: 'Électrolyte',
          capsule: 'Capsule',
          bar: 'Barre',
          real_food: 'Aliment',
          other: 'Autre',
        }
      : {
          gel: 'Gel',
          drink_mix: 'Drink mix',
          electrolyte: 'Electrolyte',
          capsule: 'Capsule',
          bar: 'Bar',
          real_food: 'Real food',
          other: 'Other',
        };

  return labels[fuelType];
}

function formatProductMeta(product: Product, locale: 'fr' | 'en') {
  const parts = [getFuelTypeLabel(product.fuel_type, locale)];
  const carbs = Math.round(product.carbs_g ?? 0);
  const sodium = Math.round(product.sodium_mg ?? 0);

  if (carbs > 0) {
    parts.push(locale === 'fr' ? `${carbs} g glucides` : `${carbs} g carbs`);
  }

  if (sodium > 0) {
    parts.push(`${sodium} mg sodium`);
  }

  return parts.join(' • ');
}

function isMissingUserForeignKeyError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: string; details?: string | null; message?: string | null };
  if (candidate.code !== '23503') return false;

  const haystack = `${candidate.details ?? ''} ${candidate.message ?? ''}`.toLowerCase();
  return haystack.includes('table "users"') || haystack.includes("table 'users'") || haystack.includes('auth.users');
}

function OnboardingShell({
  children,
  step,
  totalSteps,
  stepLabel,
}: {
  children: React.ReactNode;
  step: number;
  totalSteps: number;
  stepLabel: string;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topGlow} />
      <ScrollView
        contentContainerStyle={styles.shellScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.hero}>
            <Text style={styles.logo}>Pace Yourself</Text>
            <Text style={styles.stepIndicator}>
              {stepLabel.replace('{step}', String(step)).replace('{total}', String(totalSteps))}
            </Text>
            <View style={styles.progressRow}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View
                  key={`progress-${index + 1}`}
                  style={[
                    styles.progressSegment,
                    index < step ? styles.progressSegmentActive : styles.progressSegmentInactive,
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.card}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function OnboardingScreen() {
  const { locale, t } = useI18n();
  const pendingTransition = getPendingOnboardingTransition();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [waterBagLiters, setWaterBagLiters] = useState(1.5);
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
  const completionPlanId: string | null = null;
  const completedRaceIdParam: string | null = null;
  const completedRaceNameParam: string | null = null;
  const completedHasSelectedProductsParam = false;
  const totalSteps = 6;
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
  const selectedRace = useMemo(
    () => allRaceOptions.find((race) => race.id === selectedRaceId) ?? null,
    [allRaceOptions, selectedRaceId],
  );
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
  const filteredRaceEventGroups = useMemo(() => {
    const normalizedSearch = raceSearch.trim().toLowerCase();

    return raceEventGroups
      .map((event) => {
        const eventMatchesName =
          normalizedSearch.length === 0 ||
          event.name.toLowerCase().includes(normalizedSearch) ||
          (event.location ?? '').toLowerCase().includes(normalizedSearch);

        const races = sortRaceOptions(
          event.races.filter((race) => {
            if (eventMatchesName) {
              return true;
            }

            const location = race.location_text?.toLowerCase() ?? '';
            return (
              race.name.toLowerCase().includes(normalizedSearch) ||
              location.includes(normalizedSearch)
            );
          }),
        );

        return { ...event, races };
      })
      .filter((event) => event.races.length > 0);
  }, [raceEventGroups, raceSearch]);
  const filteredPersonalRaceOptions = useMemo(() => {
    const normalizedSearch = raceSearch.trim().toLowerCase();

    return personalRaceOptions.filter((race) => {
      if (!normalizedSearch) {
        return true;
      }

      const location = race.location_text?.toLowerCase() ?? '';
      return (
        race.name.toLowerCase().includes(normalizedSearch) ||
        location.includes(normalizedSearch)
      );
    });
  }, [personalRaceOptions, raceSearch]);
  const publicRaceOptions = useMemo(() => [] as RaceOption[], []);
  const filteredNutritionProducts = useMemo(() => {
    const normalizedSearch = nutritionSearch.trim().toLowerCase();

    return nutritionProducts
      .filter((product) => {
        if (!normalizedSearch) {
          return true;
        }

        const brandLabel = inferNutritionBrand(product.name).toLowerCase();
        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          brandLabel.includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        const leftPriority = PRODUCT_PRIORITY[left.fuel_type] ?? 99;
        const rightPriority = PRODUCT_PRIORITY[right.fuel_type] ?? 99;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        const leftDensity = (left.carbs_g ?? 0) + (left.sodium_mg ?? 0) / 100;
        const rightDensity = (right.carbs_g ?? 0) + (right.sodium_mg ?? 0) / 100;
        if (leftDensity !== rightDensity) {
          return rightDensity - leftDensity;
        }

        return left.name.localeCompare(right.name);
      });
  }, [nutritionProducts, nutritionSearch, selectedProductIds]);
  const groupedNutritionProducts = useMemo(
    () =>
      Array.from(
        filteredNutritionProducts.reduce((groups, product) => {
          const brandLabel =
            inferNutritionBrand(product.name) || (locale === 'fr' ? 'Autres marques' : 'Other brands');
          const currentGroup = groups.get(brandLabel) ?? [];
          currentGroup.push(product);
          groups.set(brandLabel, currentGroup);
          return groups;
        }, new Map<string, Product[]>()),
      )
        .map(([brandLabel, products]) => ({
          brandLabel,
          products,
          selectedCount: products.filter((product) => selectedProductIds.includes(product.id)).length,
        }))
        .sort((left, right) => left.brandLabel.localeCompare(right.brandLabel)),
    [filteredNutritionProducts, locale, selectedProductIds],
  );
  const hiddenNutritionProducts = useMemo(() => [] as Product[], []);
  const selectedRaceEventDate = selectedRaceEvent
    ? formatEventDate(selectedRaceEvent.race_date, locale)
    : null;
  const selectedRaceEventMeta = selectedRaceEvent
    ? [selectedRaceEvent.location, selectedRaceEventDate].filter(Boolean).join(' • ')
    : null;
  const selectedRaceEventImage = selectedRaceEvent ? getEventImageUrl(selectedRaceEvent) : null;
  const selectedRaceEventDistanceRange = selectedRaceEvent
    ? getEventDistanceRange(selectedRaceEvent.races)
    : null;
  const selectedRaceEventFormatsLabel = selectedRaceEvent
    ? selectedRaceEvent.races.length === 1
      ? t.catalog.singleFormatLabel
      : t.catalog.multipleFormatsLabel.replace('{count}', String(selectedRaceEvent.races.length))
    : null;
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
            races (
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
              .eq('is_live', true)
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
        .select('id, name, image_url, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by')
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
    const profileUpsert = supabase.from('user_profiles').upsert({
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
    });

    if (nextSelectedProductIds.length === 0) {
      await profileUpsert;
      return;
    }

    await Promise.all([
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
            nextRoute = `/(app)/plan/${demoPlan.id}/edit?showHelp=1`;
          }
        }
      }
    } catch (error) {
      console.error('Unable to finish onboarding:', error);
    } finally {
      await noteReviewOnboardingCompleted();
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

  function handleTargetsContinue() {
    const performanceStep = validatePerformanceStep();
    if (!performanceStep) return;
    setStep(5);
  }

  function handleRaceContinue() {
    setStep(6);
  }

  function handleSelectRace(raceId: string) {
    setSelectedRaceId(raceId);
    setSelectedRaceEvent(null);
    setStep(6);
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
    const loadingTitle = visiblePlanName
      ? t.plans.planLoadingNamed.replace('{name}', visiblePlanName)
      : t.plans.planLoadingGeneric;

    return (
      <PlanLoadingScreen
        planName={visiblePlanName}
        progress={loadingProgress}
        stage={t.plans.planLoadingStage}
        title={loadingTitle}
      />
    );
  }

  if (completionPlanId) {
    return (
      <OnboardingShell step={6} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <View style={styles.notificationIconWrap}>
          <Text style={styles.notificationIcon}>âœ“</Text>
        </View>
        <Text style={styles.title}>{t.onboarding.completionTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.completionSubtitle}</Text>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t.onboarding.completionSummaryTitle}</Text>
          {selectedRace?.name || completedRaceNameParam ? (
            <Text style={styles.noticeText}>
              {t.onboarding.completionRaceLine.replace('{name}', selectedRace?.name ?? completedRaceNameParam ?? '')}
            </Text>
          ) : null}
          <Text style={styles.noticeText}>
            {(selectedProductIds.length > 0 || completedHasSelectedProductsParam)
              ? t.onboarding.completionFilledLine
              : t.onboarding.completionEmptyLine}
          </Text>
          <Text style={styles.noticeText}>{t.onboarding.completionEditLine}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleOpenDemoPlan}>
          <Text style={styles.primaryButtonText}>{t.onboarding.completionContinueCta}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleCreateAnotherPlan}>
          <Text style={styles.secondaryButtonText}>{t.onboarding.completionNewPlanCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  if (step === 0) {
    return (
      <OnboardingShell step={1} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.kicker}>{t.onboarding.welcomeKicker}</Text>
        <Text style={styles.title}>{t.onboarding.welcomeTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.welcomeSubtitle}</Text>

        <View style={styles.phaseList}>
          {overviewPhases.map((item) => (
            <View key={item.title} style={styles.phaseCard}>
              <View style={styles.phaseBadge}>
                <Text style={styles.phaseBadgeText}>{item.index}</Text>
              </View>
              <View style={styles.phaseBody}>
                <Text style={styles.phaseTitle}>{item.title}</Text>
                <Text style={styles.phaseText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
          <Text style={styles.primaryButtonText}>{t.onboarding.startCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  if (step === 1) {
    return (
      <OnboardingShell step={2} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.kicker}>{t.onboarding.workflowKicker}</Text>
        <Text style={styles.title}>{t.onboarding.workflowTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.workflowSubtitle}</Text>

        <View style={styles.timelineGroups}>
          {workflowGroups.map((group) => (
            <View key={group.label} style={styles.timelineGroup}>
              <Text style={styles.timelineGroupLabel}>{group.label}</Text>

              <View style={styles.timelineGroupBody}>
                {group.items.map((item) => {
                  const globalIndex = workflowSteps.findIndex((workflowStep) => workflowStep.title === item.title);
                  const isLast = group.items[group.items.length - 1]?.title === item.title;

                  return (
                    <View key={item.title} style={styles.timelineItem}>
                      <View style={styles.timelineMarkerColumn}>
                        <View style={styles.timelineBadge}>
                          <Text style={styles.timelineBadgeText}>{globalIndex + 1}</Text>
                        </View>
                        {!isLast ? <View style={styles.timelineLine} /> : null}
                      </View>

                      <View style={styles.timelineCard}>
                        <Text style={styles.timelineTitle}>{item.title}</Text>
                        <Text style={styles.timelineText}>{item.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
          <Text style={styles.primaryButtonText}>{t.onboarding.startCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <>
        <OnboardingShell step={2} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
          <Text style={styles.title}>{t.profile.personalSectionTitle}</Text>
          <Text style={styles.subtitle}>{t.profile.personalSectionSubtitle}</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.profile.personalSectionTitle}</Text>
            <Text style={styles.sectionSubtitle}>{t.profile.personalSectionSubtitle}</Text>

            <Text style={styles.label}>{t.onboarding.firstNameLabel}</Text>
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                if (profileError) setProfileError(null);
              }}
              placeholder={t.onboarding.firstNamePlaceholder}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              textContentType="givenName"
            />

            <View style={styles.bodyMetricsRow}>
              <View style={styles.bodyMetricField}>
                <Text style={styles.label}>{t.profile.weightLabel}</Text>
                <View style={styles.metricInputShell}>
                  <TextInput
                    style={styles.metricInput}
                    value={weightKg}
                    onChangeText={(value) => {
                      setWeightKg(sanitizeDigits(value, 3));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder={t.profile.weightPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.metricInputUnit}>kg</Text>
                </View>
              </View>

              <View style={styles.bodyMetricField}>
                <Text style={styles.label}>{t.profile.heightLabel}</Text>
                <View style={styles.metricInputShell}>
                  <TextInput
                    style={styles.metricInput}
                    value={heightCm}
                    onChangeText={(value) => {
                      setHeightCm(sanitizeDigits(value, 3));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder={t.profile.heightPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.metricInputUnit}>cm</Text>
                </View>
              </View>
            </View>
          </View>

          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handlePersonalContinue}>
            <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
          </TouchableOpacity>
        </OnboardingShell>
      </>
    );
  }

  if (step === 3) {
    return (
      <>
        <OnboardingShell step={3} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
          <Text style={styles.title}>{t.profile.performanceSectionTitle}</Text>
          <Text style={styles.subtitle}>{t.onboarding.performanceStepSubtitle}</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.label}>{t.onboarding.waterBagLabel}</Text>
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

            <Text style={styles.label}>{t.onboarding.comfortableFlatPaceLabel}</Text>
            <View style={styles.paceInputRow}>
              <View style={styles.paceInputGroup}>
                <Text style={styles.paceInputLabel}>{t.onboarding.comfortableFlatPaceMinutesLabel}</Text>
                <TextInput
                  style={styles.textInput}
                  value={comfortableFlatPaceMinutes}
                  onChangeText={(value) => {
                    setComfortableFlatPaceMinutes(sanitizeDigits(value, 2));
                    if (profileError) setProfileError(null);
                  }}
                  placeholder="6"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.paceInputGroup}>
                <Text style={styles.paceInputLabel}>{t.onboarding.comfortableFlatPaceSecondsLabel}</Text>
                <TextInput
                  style={styles.textInput}
                  value={comfortableFlatPaceSeconds}
                  onChangeText={(value) => {
                    setComfortableFlatPaceSeconds(sanitizeDigits(value, 2));
                    if (profileError) setProfileError(null);
                  }}
                  placeholder="00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            <Text style={styles.label}>{t.onboarding.utmbIndexLabel}</Text>
            <TextInput
              style={styles.textInput}
              value={utmbIndex}
              onChangeText={(value) => {
                setUtmbIndex(sanitizeDigits(value, 4));
                if (profileError) setProfileError(null);
              }}
              placeholder={t.onboarding.utmbIndexPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handlePerformanceContinue}>
            <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
          </TouchableOpacity>
        </OnboardingShell>

        {renderEstimatorModal()}
      </>
    );
  }

  if (step === 4) {
    return (
      <>
        <OnboardingShell step={4} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
          <Text style={styles.title}>{t.onboarding.nutritionTargetsTitle}</Text>
          <Text style={styles.subtitle}>{t.onboarding.nutritionTargetsSubtitle}</Text>

          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.estimateButton} onPress={handleOpenEstimator}>
              <Text style={styles.estimateButtonText}>{t.profile.estimatorButton}</Text>
            </TouchableOpacity>

            <View style={styles.targetsStack}>
              <View style={[styles.targetRow, styles.targetRowBordered]}>
                <Text style={styles.targetLabel}>{t.profile.defaultCarbsPerHourLabel}</Text>
                <View style={styles.targetInputShell}>
                  <TextInput
                    style={styles.targetInput}
                    value={defaultCarbsPerHour}
                    onChangeText={(value) => {
                      setDefaultCarbsPerHour(sanitizeDigits(value, 3));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="70"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.targetUnit}>g</Text>
                </View>
              </View>

              <View style={[styles.targetRow, styles.targetRowBordered]}>
                <Text style={styles.targetLabel}>{t.profile.defaultWaterPerHourLabel}</Text>
                <View style={styles.targetInputShell}>
                  <TextInput
                    style={styles.targetInput}
                    value={defaultWaterPerHour}
                    onChangeText={(value) => {
                      setDefaultWaterPerHour(sanitizeDigits(value, 4));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="500"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={styles.targetUnit}>ml</Text>
                </View>
              </View>

              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>{t.profile.defaultSodiumPerHourLabel}</Text>
                <View style={styles.targetInputShell}>
                  <TextInput
                    style={styles.targetInput}
                    value={defaultSodiumPerHour}
                    onChangeText={(value) => {
                      setDefaultSodiumPerHour(sanitizeDigits(value, 4));
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="600"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={styles.targetUnit}>mg</Text>
                </View>
              </View>
            </View>
          </View>

          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleTargetsContinue}>
            <Text style={styles.primaryButtonText}>{t.onboarding.continueCta}</Text>
          </TouchableOpacity>
        </OnboardingShell>

        {renderEstimatorModal()}
      </>
    );
  }

  if (step === 5) {
    return (
      <>
        <OnboardingShell step={5} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.title}>{t.onboarding.raceTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.raceSubtitle}</Text>
        <Text style={styles.predictionHint}>{t.onboarding.raceHint}</Text>

        <View style={styles.sectionCard}>
          {selectedRaceSummary ? (
            <View style={styles.inlineInfoRow}>
              <View style={styles.selectionCountPill}>
                <Text style={styles.selectionCountText}>{selectedRaceSummary}</Text>
              </View>
            </View>
          ) : null}

          <TextInput
            style={styles.textInput}
            value={raceSearch}
            onChangeText={setRaceSearch}
            placeholder={t.onboarding.raceSearchPlaceholder}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />

          {loadingRaces ? (
            <View style={styles.raceCenteredState}>
              <ActivityIndicator color={Colors.brandPrimary} />
              <Text style={styles.raceStateText}>{t.onboarding.raceLoading}</Text>
            </View>
          ) : raceLoadError ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.errorText}>{raceLoadError}</Text>
              <TouchableOpacity
                style={styles.retryButtonInline}
                onPress={() => {
                  setHasLoadedRaceOptions(false);
                  void loadRaceOptions();
                }}
              >
                <Text style={styles.retryButtonInlineText}>{t.common.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : filteredPersonalRaceOptions.length === 0 && filteredRaceEventGroups.length === 0 ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.emptyTitle}>{t.onboarding.raceEmptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{t.onboarding.raceEmptySubtitle}</Text>
            </View>
          ) : (
            <View style={styles.raceEventList}>
              {filteredPersonalRaceOptions.length > 0 ? (
                <View style={styles.raceGroup}>
                  <Text style={styles.raceGroupLabel}>{t.races.myRaces}</Text>
                  {filteredPersonalRaceOptions.map((race) => {
                    const selected = race.id === selectedRaceId;
                    const raceMeta = [race.location_text, formatRaceDate(race.race_date, locale)]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <TouchableOpacity
                        key={race.id}
                        style={[
                          styles.raceChoiceCard,
                          selected && styles.raceChoiceCardSelected,
                        ]}
                        onPress={() => handleSelectRace(race.id)}
                      >
                        <View style={styles.raceChoiceHeader}>
                          <Text style={styles.raceChoiceTitle}>{race.name}</Text>
                          {selected ? (
                            <View style={styles.raceSelectedBadge}>
                              <Text style={styles.raceSelectedBadgeText}>
                                {t.onboarding.raceSelectedBadge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.raceChoiceStats}>
                          {race.distance_km} km • D+ {race.elevation_gain_m} m
                        </Text>
                        {raceMeta ? <Text style={styles.raceChoiceMeta}>{raceMeta}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {filteredRaceEventGroups.map((event) => {
                const eventImageUrl = getEventImageUrl(event);
                const dateStr = formatEventDate(event.race_date, locale);
                const headerMeta = [event.location, dateStr].filter(Boolean).join(' • ');
                const distanceRange = getEventDistanceRange(event.races);
                const selectedEventRace = event.races.find((race) => race.id === selectedRaceId) ?? null;
                const primaryRace = event.races[0] ?? null;
                const formatsLabel =
                  event.races.length === 1
                    ? t.catalog.singleFormatLabel
                    : t.catalog.multipleFormatsLabel.replace('{count}', String(event.races.length));

                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventHeader}>
                      <View style={styles.eventBadge}>
                        <Ionicons name="flag-outline" size={18} color={Colors.brandPrimary} />
                      </View>
                      <View style={styles.eventHeaderText}>
                        <Text style={styles.eventName}>{event.name}</Text>
                        {headerMeta ? <Text style={styles.eventMeta}>{headerMeta}</Text> : null}
                      </View>
                      {eventImageUrl ? (
                        <Image source={{ uri: eventImageUrl }} style={styles.eventThumbnail} resizeMode="cover" />
                      ) : null}
                    </View>

                    <View style={styles.eventSummaryRow}>
                      <View style={styles.summaryPill}>
                        <Text style={styles.summaryPillText}>{formatsLabel}</Text>
                      </View>
                      {distanceRange ? (
                        <View style={styles.summaryPill}>
                          <Text style={styles.summaryPillText}>{distanceRange}</Text>
                        </View>
                      ) : null}
                    </View>

                    {selectedEventRace ? (
                      <Text style={styles.eventSupportText}>
                        {`${getRaceShortLabel(selectedEventRace.name, event.name)} • ${formatDistance(selectedEventRace.distance_km)} km • D+ ${formatElevation(selectedEventRace.elevation_gain_m)} m`}
                      </Text>
                    ) : primaryRace ? (
                      <Text style={styles.eventSupportText}>
                        {event.races.length === 1
                          ? `${getRaceShortLabel(primaryRace.name, event.name)} • ${formatDistance(primaryRace.distance_km)} km • D+ ${formatElevation(primaryRace.elevation_gain_m)} m`
                          : t.catalog.chooseFormatHint}
                      </Text>
                    ) : null}

                    <TouchableOpacity style={styles.eventPrimaryButton} onPress={() => setSelectedRaceEvent(event)}>
                      <Text style={styles.eventPrimaryButtonText}>{t.catalog.viewFormats}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {publicRaceOptions.length > 0 ? (
                <View style={styles.raceGroup}>
                  <Text style={styles.raceGroupLabel}>{t.races.publicRaces}</Text>
                  {publicRaceOptions.map((race) => {
                    const selected = race.id === selectedRaceId;
                    const raceMeta = [race.location_text, formatRaceDate(race.race_date, locale)]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <TouchableOpacity
                        key={race.id}
                        style={[
                          styles.raceChoiceCard,
                          selected && styles.raceChoiceCardSelected,
                        ]}
                        onPress={() => setSelectedRaceId(race.id)}
                      >
                        <View style={styles.raceChoiceHeader}>
                          <Text style={styles.raceChoiceTitle}>{race.name}</Text>
                          {selected ? (
                            <View style={styles.raceSelectedBadge}>
                              <Text style={styles.raceSelectedBadgeText}>
                                {t.onboarding.raceSelectedBadge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.raceChoiceStats}>
                          {race.distance_km} km • D+ {race.elevation_gain_m} m
                        </Text>
                        {raceMeta ? <Text style={styles.raceChoiceMeta}>{raceMeta}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )}
        </View>

        </OnboardingShell>

        <Modal
          visible={Boolean(selectedRaceEvent)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedRaceEvent(null)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.sheetOverlay} onPress={() => setSelectedRaceEvent(null)} />
            <SafeAreaView style={styles.sheetCard}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.sheetTitle}>{selectedRaceEvent?.name}</Text>
                  {selectedRaceEventMeta ? <Text style={styles.sheetSubtitle}>{selectedRaceEventMeta}</Text> : null}
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setSelectedRaceEvent(null)}>
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedRaceEventImage ? (
                <Image source={{ uri: selectedRaceEventImage }} style={styles.sheetImage} resizeMode="cover" />
              ) : null}

              <View style={styles.eventSummaryRow}>
                {selectedRaceEventFormatsLabel ? (
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryPillText}>{selectedRaceEventFormatsLabel}</Text>
                  </View>
                ) : null}
                {selectedRaceEventDistanceRange ? (
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryPillText}>{selectedRaceEventDistanceRange}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.sheetHint}>{t.catalog.chooseFormatHint}</Text>

              <ScrollView contentContainerStyle={styles.sheetContent}>
                {selectedRaceEvent?.races.map((race) => {
                  const selected = race.id === selectedRaceId;

                  return (
                    <TouchableOpacity
                      key={race.id}
                      style={[styles.formatRow, selected && styles.formatRowSelected]}
                      onPress={() => handleSelectRace(race.id)}
                    >
                      <View style={styles.formatRowContent}>
                        <Text style={styles.formatTitle}>
                          {selectedRaceEvent ? getRaceShortLabel(race.name, selectedRaceEvent.name) : race.name}
                        </Text>
                        <Text style={styles.formatSubtitle}>
                          {`${formatDistance(race.distance_km)} km • D+ ${formatElevation(race.elevation_gain_m)} m`}
                        </Text>
                      </View>

                      {selected ? (
                        <View style={styles.raceSelectedBadge}>
                          <Text style={styles.raceSelectedBadgeText}>
                            {t.onboarding.raceSelectedBadge}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.formatActionButton}>
                          <Text style={styles.formatActionButtonText}>{t.catalog.selectRace}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </>
    );
  }

  if (step === 6) {
    const selectedCountLabel = t.onboarding.nutritionSelectedCount.replace(
      '{count}',
      String(selectedProductIds.length),
    );

    return (
      <OnboardingShell step={6} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <Text style={styles.title}>{t.onboarding.nutritionTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.nutritionSubtitle}</Text>
        <Text style={styles.predictionHint}>{t.onboarding.nutritionHint}</Text>

        <View style={styles.sectionCard}>
          {selectedRaceSummary ? (
            <View style={styles.selectionActionRow}>
              <View style={styles.selectionCountPill}>
                <Text style={styles.selectionCountText}>{selectedRaceSummary}</Text>
              </View>

              <TouchableOpacity style={styles.retryButtonInline} onPress={handleBackToRaceChoice}>
                <Text style={styles.retryButtonInlineText}>{t.onboarding.changeRaceCta}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inlineInfoRow}>
            <View style={styles.selectionCountPill}>
              <Text style={styles.selectionCountText}>{selectedCountLabel}</Text>
            </View>
          </View>

          <TextInput
            style={styles.textInput}
            value={nutritionSearch}
            onChangeText={setNutritionSearch}
            placeholder={t.onboarding.nutritionSearchPlaceholder}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />

          {loadingNutritionProducts ? (
            <View style={styles.raceCenteredState}>
              <ActivityIndicator color={Colors.brandPrimary} />
              <Text style={styles.raceStateText}>{t.onboarding.nutritionLoading}</Text>
            </View>
          ) : nutritionLoadError ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.errorText}>{nutritionLoadError}</Text>
              <TouchableOpacity
                style={styles.retryButtonInline}
                onPress={() => {
                  setHasLoadedNutritionProducts(false);
                  void loadNutritionProducts();
                }}
              >
                <Text style={styles.retryButtonInlineText}>{t.common.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : groupedNutritionProducts.length === 0 ? (
            <View style={styles.raceCenteredState}>
              <Text style={styles.emptyTitle}>{t.onboarding.nutritionEmptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{t.onboarding.nutritionEmptySubtitle}</Text>
            </View>
          ) : (
            <View style={styles.productList}>
              {groupedNutritionProducts.map((group) => {
                const brandExpanded =
                  nutritionSearch.trim().length > 0 || expandedNutritionBrands.includes(group.brandLabel);

                return (
                  <View key={group.brandLabel} style={styles.productBrandGroup}>
                    <TouchableOpacity
                      style={styles.productBrandHeader}
                      onPress={() => toggleNutritionBrand(group.brandLabel)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.productBrandTitle}>{group.brandLabel}</Text>

                      <View style={styles.productBrandHeaderActions}>
                        <View style={styles.productBrandCountPill}>
                          <Text style={styles.productBrandCountText}>
                            {group.selectedCount > 0
                              ? `${group.selectedCount}/${group.products.length}`
                              : String(group.products.length)}
                          </Text>
                        </View>
                        <Ionicons
                          name={brandExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={Colors.textSecondary}
                        />
                      </View>
                    </TouchableOpacity>

                    {brandExpanded ? (
                      <View style={styles.productBrandItems}>
                        {group.products.map((product) => {
                          const selected = selectedProductIds.includes(product.id);

                          return (
                            <TouchableOpacity
                              key={product.id}
                              style={[
                                styles.productChoiceCard,
                                selected && styles.productChoiceCardSelected,
                              ]}
                              onPress={() => toggleProductSelection(product.id)}
                            >
                              <View style={styles.productChoiceContentRow}>
                                <View style={styles.productChoiceMedia}>
                                  {product.image_url ? (
                                    <Image
                                      source={{ uri: product.image_url }}
                                      style={styles.productChoiceImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View style={styles.productChoiceImagePlaceholder}>
                                      <Ionicons name="image-outline" size={18} color={Colors.textMuted} />
                                    </View>
                                  )}
                                </View>

                                <View style={styles.productChoiceBody}>
                                  <View style={styles.raceChoiceHeader}>
                                    <Text style={styles.productChoiceTitle}>{product.name}</Text>
                                    {selected ? (
                                      <View style={styles.raceSelectedBadge}>
                                        <Text style={styles.raceSelectedBadgeText}>
                                          {t.onboarding.nutritionSelectedBadge}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text style={styles.productChoiceMeta}>{formatProductMeta(product, locale)}</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {hiddenNutritionProducts.map((product) => {
                const selected = selectedProductIds.includes(product.id);

                return (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.productChoiceCard,
                      selected && styles.productChoiceCardSelected,
                    ]}
                    onPress={() => toggleProductSelection(product.id)}
                  >
                    <View style={styles.productChoiceContentRow}>
                      <View style={styles.productChoiceMedia}>
                        {product.image_url ? (
                          <Image
                            source={{ uri: product.image_url }}
                            style={styles.productChoiceImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.productChoiceImagePlaceholder}>
                            <Ionicons name="image-outline" size={18} color={Colors.textMuted} />
                          </View>
                        )}
                      </View>

                      <View style={styles.productChoiceBody}>
                        <View style={styles.raceChoiceHeader}>
                          <Text style={styles.productChoiceTitle}>{product.name}</Text>
                          {selected ? (
                            <View style={styles.raceSelectedBadge}>
                              <Text style={styles.raceSelectedBadgeText}>
                                {t.onboarding.nutritionSelectedBadge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.productChoiceMeta}>{formatProductMeta(product, locale)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (selectedProductIds.length === 0 || saving) && styles.buttonDisabled,
          ]}
          onPress={handleNutritionContinue}
          disabled={selectedProductIds.length === 0 || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnBrand} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {selectedProductIds.length > 0
                ? t.onboarding.nutritionContinueCta
                : t.onboarding.continueCta}
            </Text>
          )}
        </TouchableOpacity>

      </OnboardingShell>
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

  if (completionPlanId) {
    return (
      <OnboardingShell step={6} totalSteps={totalSteps} stepLabel={t.onboarding.stepLabel}>
        <View style={styles.notificationIconWrap}>
          <Text style={styles.notificationIcon}>✓</Text>
        </View>
        <Text style={styles.title}>{t.onboarding.completionTitle}</Text>
        <Text style={styles.subtitle}>{t.onboarding.completionSubtitle}</Text>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t.onboarding.completionSummaryTitle}</Text>
          {selectedRace?.name || completedRaceNameParam ? (
            <Text style={styles.noticeText}>
              {t.onboarding.completionRaceLine.replace('{name}', selectedRace?.name ?? completedRaceNameParam ?? '')}
            </Text>
          ) : null}
          <Text style={styles.noticeText}>
            {(selectedProductIds.length > 0 || completedHasSelectedProductsParam)
              ? t.onboarding.completionFilledLine
              : t.onboarding.completionEmptyLine}
          </Text>
          <Text style={styles.noticeText}>{t.onboarding.completionEditLine}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleOpenDemoPlan}>
          <Text style={styles.primaryButtonText}>{t.onboarding.completionContinueCta}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleCreateAnotherPlan}>
          <Text style={styles.secondaryButtonText}>{t.onboarding.completionNewPlanCta}</Text>
        </TouchableOpacity>
      </OnboardingShell>
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
  shellScrollContent: {
    flexGrow: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  progressSegmentActive: {
    backgroundColor: Colors.brandPrimary,
  },
  progressSegmentInactive: {
    backgroundColor: Colors.surfaceMuted,
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
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  kicker: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  predictionHint: {
    color: Colors.brandPrimary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 20,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: Colors.brandSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  summaryText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  phaseList: {
    gap: 14,
    marginBottom: 28,
  },
  phaseCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phaseBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  phaseBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '700',
  },
  phaseBody: {
    flex: 1,
  },
  phaseTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  phaseText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  timelineGroups: {
    gap: 16,
    marginBottom: 28,
  },
  timelineGroup: {
    gap: 10,
  },
  timelineGroupLabel: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timelineGroupBody: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  timelineMarkerColumn: {
    alignItems: 'center',
    width: 30,
  },
  timelineBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.brandBorder,
    marginTop: 6,
    marginBottom: -6,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  timelineTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineText: {
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
  paceInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
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
  waterBagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  bodyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
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
    backgroundColor: Colors.surface,
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
  estimateButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    marginTop: 4,
    marginBottom: 14,
  },
  estimateButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
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
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  targetsStack: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  targetRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  targetLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  targetInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 116,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  targetInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  targetUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  raceCenteredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  raceStateText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButtonInline: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  retryButtonInlineText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  inlineInfoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  selectionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  raceList: {
    gap: 16,
  },
  raceEventList: {
    gap: 18,
  },
  raceGroup: {
    gap: 10,
  },
  raceGroupLabel: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  raceChoiceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 6,
  },
  raceChoiceCardSelected: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
  },
  raceChoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  raceChoiceTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  raceChoiceStats: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  raceChoiceMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  eventCard: {
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  eventHeaderText: {
    flex: 1,
    gap: 3,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  eventThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  eventSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  eventSupportText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  eventPrimaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  eventPrimaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  selectionCountPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  selectionCountText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  raceSelectedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  raceSelectedBadgeText: {
    color: Colors.textOnBrand,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18, 24, 16, 0.24)',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    maxHeight: '82%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 14,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetHeaderText: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetImage: {
    width: '100%',
    height: 132,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  sheetHint: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  sheetContent: {
    gap: 10,
    paddingBottom: 12,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  formatRowSelected: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
  },
  formatRowContent: {
    flex: 1,
    gap: 4,
  },
  formatTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  formatSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  formatActionButton: {
    minWidth: 112,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  formatActionButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  productList: {
    gap: 10,
  },
  productBrandGroup: {
    gap: 10,
  },
  productBrandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  productBrandHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productBrandTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  productBrandCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  productBrandCountText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  productBrandItems: {
    gap: 10,
  },
  productChoiceCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  productChoiceCardSelected: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
  },
  productChoiceContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productChoiceMedia: {
    flexShrink: 0,
  },
  productChoiceImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  productChoiceImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productChoiceBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  productChoiceTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  productChoiceMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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

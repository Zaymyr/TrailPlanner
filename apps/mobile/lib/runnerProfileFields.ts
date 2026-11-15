// Mobile-local mirror of packages/shared/src/runnerProfile.ts.
// The Expo app must not import the shared workspace package at runtime (mobile dependency CI check); keep both copies in sync.

export type RunnerProfileFieldKey =
  | 'full_name'
  | 'comfortable_flat_pace_min_per_km'
  | 'water_bag_liters'
  | 'default_carbs_g_per_hour'
  | 'birth_date'
  | 'height_cm'
  | 'weight_kg'
  | 'utmb_index'
  | 'default_water_ml_per_hour'
  | 'default_sodium_mg_per_hour';

export type RunnerProfileValues = Partial<{
  full_name: string | null;
  comfortable_flat_pace_min_per_km: number | null;
  water_bag_liters: number | null;
  default_carbs_g_per_hour: number | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  utmb_index: number | null;
  default_water_ml_per_hour: number | null;
  default_sodium_mg_per_hour: number | null;
}>;

export type RunnerProfileFieldDefinition = Readonly<{
  key: RunnerProfileFieldKey;
  labelKey: string;
  labels: Readonly<{ fr: string; en: string }>;
  unit: string | null;
  required: boolean;
}>;

/** Canonical profile field order and metadata shared by every runner client. */
export const RUNNER_PROFILE_FIELDS = [
  {
    key: 'full_name',
    labelKey: 'runnerProfile.fullName',
    labels: { fr: 'Prénom', en: 'First name' },
    unit: null,
    required: true,
  },
  {
    key: 'comfortable_flat_pace_min_per_km',
    labelKey: 'runnerProfile.comfortableFlatPace',
    labels: { fr: 'Allure confortable sur le plat', en: 'Comfortable flat pace' },
    unit: 'min/km',
    required: true,
  },
  {
    key: 'water_bag_liters',
    labelKey: 'runnerProfile.waterBag',
    labels: { fr: 'Capacité en eau', en: 'Water capacity' },
    unit: 'L',
    required: true,
  },
  {
    key: 'default_carbs_g_per_hour',
    labelKey: 'runnerProfile.carbsPerHour',
    labels: { fr: 'Cible de glucides', en: 'Carbohydrate target' },
    unit: 'g/h',
    required: true,
  },
  {
    key: 'birth_date', labelKey: 'runnerProfile.birthDate',
    labels: { fr: 'Date de naissance', en: 'Date of birth' }, unit: null, required: false,
  },
  {
    key: 'height_cm', labelKey: 'runnerProfile.height',
    labels: { fr: 'Taille', en: 'Height' }, unit: 'cm', required: false,
  },
  {
    key: 'weight_kg', labelKey: 'runnerProfile.weight',
    labels: { fr: 'Poids', en: 'Weight' }, unit: 'kg', required: false,
  },
  {
    key: 'utmb_index', labelKey: 'runnerProfile.utmbIndex',
    labels: { fr: 'Indice UTMB', en: 'UTMB Index' }, unit: null, required: false,
  },
  {
    key: 'default_water_ml_per_hour',
    labelKey: 'runnerProfile.waterPerHour',
    labels: { fr: "Cible d'eau", en: 'Water target' },
    unit: 'ml/h',
    required: false,
  },
  {
    key: 'default_sodium_mg_per_hour',
    labelKey: 'runnerProfile.sodiumPerHour',
    labels: { fr: 'Cible de sodium', en: 'Sodium target' },
    unit: 'mg/h',
    required: false,
  },
] as const satisfies readonly RunnerProfileFieldDefinition[];

export const RUNNER_PROFILE_REQUIRED_FIELDS = RUNNER_PROFILE_FIELDS.filter(
  (field) => field.required,
);

export function isRunnerProfileReady(
  profile: RunnerProfileValues | null | undefined,
): profile is RunnerProfileValues & {
  full_name: string;
  comfortable_flat_pace_min_per_km: number;
  water_bag_liters: number;
  default_carbs_g_per_hour: number;
} {
  if (!profile || !profile.full_name?.trim()) return false;

  const pace = profile.comfortable_flat_pace_min_per_km;
  const waterBag = profile.water_bag_liters;
  const carbs = profile.default_carbs_g_per_hour;

  return (
    typeof pace === 'number' && Number.isFinite(pace) && pace > 0 &&
    typeof waterBag === 'number' && Number.isFinite(waterBag) && waterBag >= 0 &&
    typeof carbs === 'number' && Number.isFinite(carbs) && carbs >= 0
  );
}

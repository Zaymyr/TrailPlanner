import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { loadOnboardingProgress, parseOnboardingStatuses } from './onboardingStatus';

const onboardingBypassUntilByUserId = new Map<string, number>();

type OnboardingGateProfileRow = {
  plan_onboarding_status: string | null;
  racebook_onboarding_status: string | null;
  onboarding_completed_at: string | null;
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

function hasSavedOnboardingProfileData(profile: OnboardingGateProfileRow | null) {
  if (!profile) {
    return false;
  }

  return (
    profile.onboarding_completed_at != null ||
    (profile.full_name?.trim().length ?? 0) > 0 ||
    profile.water_bag_liters != null ||
    profile.utmb_index != null ||
    profile.comfortable_flat_pace_min_per_km != null ||
    profile.weight_kg != null ||
    profile.height_cm != null ||
    profile.default_carbs_g_per_hour != null ||
    profile.default_water_ml_per_hour != null ||
    profile.default_sodium_mg_per_hour != null
  );
}

export function markOnboardingJustCompleted(userId: string, ttlMs = 60_000) {
  onboardingBypassUntilByUserId.set(userId, Date.now() + ttlMs);
}

export async function shouldOpenOnboarding(session: Session | null | undefined) {
  if (!session?.user.id) {
    return false;
  }

  const bypassUntil = onboardingBypassUntilByUserId.get(session.user.id) ?? 0;
  if (bypassUntil > Date.now()) {
    return false;
  }

  onboardingBypassUntilByUserId.delete(session.user.id);

  const profileResult = await supabase
    .from('user_profiles')
    .select(
      'plan_onboarding_status, racebook_onboarding_status, onboarding_completed_at, full_name, water_bag_liters, utmb_index, comfortable_flat_pace_min_per_km, weight_kg, height_cm, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour',
    )
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (profileResult.error) {
    console.error('Unable to resolve onboarding gate profile:', profileResult.error);
    return false;
  }

  const profile = (profileResult.data as OnboardingGateProfileRow | null) ?? null;
  if (profile?.plan_onboarding_status || profile?.racebook_onboarding_status) {
    const statuses = parseOnboardingStatuses(profile);
    return statuses.plan === 'pending' && statuses.racebook === 'pending';
  }

  if (hasSavedOnboardingProfileData(profile)) {
    return false;
  }

  const favoritesResult = await supabase
    .from('user_favorite_products')
    .select('product_id', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  if (favoritesResult.error) {
    console.error('Unable to resolve onboarding gate favorites:', favoritesResult.error);
    return false;
  }

  return (favoritesResult.count ?? 0) === 0;
}

export async function getPostAuthRoute(session: Session | null | undefined) {
  if (!session?.user.id) return '/(app)/catalog';

  const { data, error } = await supabase
    .from('user_profiles')
    .select('plan_onboarding_status, racebook_onboarding_status')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !data) {
    return (await shouldOpenOnboarding(session)) ? '/(app)/onboarding' : '/(app)/catalog';
  }

  const statuses = parseOnboardingStatuses(data);
  if (statuses.plan === 'pending' && statuses.racebook === 'pending') {
    return '/(app)/onboarding';
  }

  const progress = await loadOnboardingProgress();
  if (!progress || statuses[progress.kind] !== 'in_progress') return '/(app)/catalog';

  if (progress.kind === 'racebook') {
    return progress.stage === 'racebook' && progress.selectedRaceId
      ? `/(app)/race/${progress.selectedRaceId}/racebook?onboarding=racebook`
      : '/(app)/catalog?onboarding=racebook';
  }

  if (progress.stage === 'setup') return '/(app)/onboarding?flow=plan';
  if (progress.stage === 'nutrition') return '/(app)/nutrition?onboarding=plan';
  if (progress.stage === 'plan' && progress.selectedRaceId) {
    return `/(app)/plan/new?catalogRaceId=${progress.selectedRaceId}&onboarding=plan`;
  }
  return '/(app)/catalog?onboarding=plan';
}

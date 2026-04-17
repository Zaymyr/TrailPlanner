import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

const onboardingBypassUntilByUserId = new Map<string, number>();

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

  const { data } = await supabase
    .from('user_profiles')
    .select('water_bag_liters')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return data === null || data?.water_bag_liters == null;
}

export async function getPostAuthRoute(session: Session | null | undefined) {
  return (await shouldOpenOnboarding(session)) ? '/(app)/onboarding' : '/(app)/plans';
}

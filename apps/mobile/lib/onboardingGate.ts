import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

export async function shouldOpenOnboarding(session: Session | null | undefined) {
  if (!session?.user.id) {
    return false;
  }

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

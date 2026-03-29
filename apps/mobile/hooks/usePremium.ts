import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PremiumState {
  isPremium: boolean;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  isLoading: boolean;
}

export function usePremium(): PremiumState {
  const [state, setState] = useState<PremiumState>({
    isPremium: false,
    isTrialActive: false,
    trialEndsAt: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkPremium() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const uid = user.id;

      const [profileResult, subResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('trial_ends_at')
          .eq('user_id', uid)
          .maybeSingle(),
        supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', uid)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      if (cancelled) return;

      // Read role from JWT app_metadata (set by Supabase admin)
      const appMeta = user.app_metadata ?? {};
      const isAdmin =
        appMeta['role'] === 'admin' ||
        (Array.isArray(appMeta['roles']) && appMeta['roles'].includes('admin'));

      const trialEndsAt = profileResult.data?.trial_ends_at ?? null;
      const isTrialActive = trialEndsAt
        ? new Date(trialEndsAt).getTime() > Date.now()
        : false;
      const hasActiveSubscription =
        !subResult.error && subResult.data?.status === 'active';

      const isPremium = isAdmin || isTrialActive || hasActiveSubscription;

      setState({
        isPremium,
        isTrialActive,
        trialEndsAt,
        isLoading: false,
      });
    }

    void checkPremium();
    return () => { cancelled = true; };
  }, []);

  return state;
}

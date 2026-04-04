import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { CustomerInfo } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import {
  addRevenueCatCustomerInfoListener,
  canUseRevenueCat,
  getRevenueCatCustomerInfo,
  hasRevenueCatPremiumEntitlement,
} from '../lib/revenueCat';

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
    let removeCustomerInfoListener: (() => void) | null = null;

    async function checkPremium(userOverride?: User | null, customerInfoOverride?: CustomerInfo | null) {
      const user =
        userOverride !== undefined
          ? userOverride
          : (await supabase.auth.getUser()).data.user;

      if (!user) {
        if (!cancelled) {
          setState({
            isPremium: false,
            isTrialActive: false,
            trialEndsAt: null,
            isLoading: false,
          });
        }
        return;
      }

      if (cancelled) return;

      const uid = user.id;

      const [profileResult, subResult, revenueCatCustomerInfo] = await Promise.all([
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
        customerInfoOverride !== undefined
          ? Promise.resolve(customerInfoOverride)
          : canUseRevenueCat()
            ? getRevenueCatCustomerInfo(uid).catch((error) => {
                console.warn('Unable to load RevenueCat premium state.', error);
                return null;
              })
            : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const trialEndsAt = profileResult.data?.trial_ends_at ?? null;
      const isTrialActive = trialEndsAt
        ? new Date(trialEndsAt).getTime() > Date.now()
        : false;
      const hasActiveSubscription =
        !subResult.error && subResult.data?.status === 'active';
      const hasActiveRevenueCatEntitlement = hasRevenueCatPremiumEntitlement(revenueCatCustomerInfo);

      const isPremium = isTrialActive || hasActiveSubscription || hasActiveRevenueCatEntitlement;

      setState({
        isPremium,
        isTrialActive,
        trialEndsAt,
        isLoading: false,
      });
    }

    async function attachRevenueCatListener(user: User | null) {
      removeCustomerInfoListener?.();
      removeCustomerInfoListener = null;

      if (!user || !canUseRevenueCat()) return;

      removeCustomerInfoListener =
        (await addRevenueCatCustomerInfoListener(user.id, (customerInfo) => {
          void checkPremium(user, customerInfo);
        })) ?? null;
    }

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await attachRevenueCatListener(user);
      await checkPremium(user);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const nextUser = session?.user ?? null;
      void attachRevenueCatListener(nextUser);
      void checkPremium(nextUser);
    });

    return () => {
      cancelled = true;
      removeCustomerInfoListener?.();
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

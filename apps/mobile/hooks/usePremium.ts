import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { CustomerInfo } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import {
  addRevenueCatCustomerInfoListener,
  canUseRevenueCat,
  getRevenueCatCustomerInfo,
  getRevenueCatPremiumExpiration,
  hasRevenueCatPremiumEntitlement,
} from '../lib/revenueCat';
import { getCurrentRevenueCatProviderHint, syncRevenueCatSubscriptionToServer } from '../lib/revenueCatSync';
import { ensureTrialStatusForSession } from '../lib/trial';
import { addPremiumStatusChangeListener } from '../lib/premiumEvents';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim() ?? '';

export type PaidPremiumSource = 'web' | 'google' | 'apple' | null;

export type ActivePremiumGrant = {
  startsAt: string;
  endsAt: string;
  initialDurationDays: number;
  reason: string;
  remainingDays: number;
};

interface PremiumState {
  isPremium: boolean;
  hasPaidPremium: boolean;
  paidPremiumSource: PaidPremiumSource;
  subscriptionRenewalAt: string | null;
  premiumGrant: ActivePremiumGrant | null;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  isLoading: boolean;
}

type ServerEntitlementsResponse = {
  entitlements?: {
    isPremium?: boolean;
    trialEndsAt?: string | null;
  };
};

type SubscriptionRow = {
  current_period_end?: string | null;
  price_id?: string | null;
  status?: string | null;
  provider?: string | null;
};

type PremiumGrantRow = {
  ends_at?: string | null;
  initial_duration_days?: number | null;
  reason?: string | null;
  starts_at?: string | null;
};

function getPremiumGrantEndAt(grant: PremiumGrantRow) {
  const startsAt = grant.starts_at ? Date.parse(grant.starts_at) : Number.NaN;

  if (!Number.isFinite(startsAt)) {
    return null;
  }

  const explicitEndAt = grant.ends_at ? Date.parse(grant.ends_at) : Number.NaN;
  if (Number.isFinite(explicitEndAt)) {
    return new Date(explicitEndAt);
  }

  if (!grant.initial_duration_days || grant.initial_duration_days <= 0) {
    return null;
  }

  const computedEndAt =
    startsAt + grant.initial_duration_days * 24 * 60 * 60 * 1000;

  return new Date(computedEndAt);
}

function buildActivePremiumGrant(grant: PremiumGrantRow): ActivePremiumGrant | null {
  const startsAt = grant.starts_at ? Date.parse(grant.starts_at) : Number.NaN;
  const endsAt = getPremiumGrantEndAt(grant);
  const now = Date.now();

  if (!Number.isFinite(startsAt) || startsAt > now || !endsAt || endsAt.getTime() <= now) {
    return null;
  }

  return {
    startsAt: grant.starts_at ?? new Date(startsAt).toISOString(),
    endsAt: endsAt.toISOString(),
    initialDurationDays: grant.initial_duration_days ?? 0,
    reason: grant.reason?.trim() ?? '',
    remainingDays: Math.max(0, Math.ceil((endsAt.getTime() - now) / (24 * 60 * 60 * 1000))),
  };
}

async function fetchActivePremiumGrant(userId: string) {
  const result = await supabase
    .from('premium_grants')
    .select('starts_at, ends_at, initial_duration_days, reason')
    .eq('user_id', userId)
    .order('starts_at', { ascending: false });

  if (result.error) {
    return null;
  }

  return ((result.data as PremiumGrantRow[] | null) ?? [])
    .map(buildActivePremiumGrant)
    .find((grant): grant is ActivePremiumGrant => grant !== null) ?? null;
}

async function fetchServerEntitlements(accessToken: string | null) {
  if (!WEB_URL || !accessToken) return null;

  try {
    const response = await fetch(`${WEB_URL}/api/entitlements`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as ServerEntitlementsResponse | null;
    const entitlements = payload?.entitlements;

    if (!entitlements) {
      return null;
    }

    return {
      isPremium: Boolean(entitlements.isPremium),
      trialEndsAt: entitlements.trialEndsAt ?? null,
    };
  } catch (error) {
    console.warn('Unable to load server entitlements.', error);
    return null;
  }
}

async function fetchServerSubscription(userId: string) {
  const result = await supabase
    .from('subscriptions')
    .select('status, provider, current_period_end, price_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error) {
    return null;
  }

  return (result.data as SubscriptionRow | null) ?? null;
}

function isActiveSubscription(subscription: SubscriptionRow | null) {
  if (!subscription?.status) return false;

  const normalizedStatus = subscription.status.trim().toLowerCase();

  if (normalizedStatus !== 'active' && normalizedStatus !== 'trialing') {
    return false;
  }

  if (!subscription.current_period_end) {
    return true;
  }

  const periodEnd = Date.parse(subscription.current_period_end);
  return Number.isFinite(periodEnd) ? periodEnd > Date.now() : false;
}

export function usePremium(): PremiumState {
  const [state, setState] = useState<PremiumState>({
    isPremium: false,
    hasPaidPremium: false,
    paidPremiumSource: null,
    subscriptionRenewalAt: null,
    premiumGrant: null,
    isTrialActive: false,
    trialEndsAt: null,
    isLoading: true,
  });
  const revenueCatSyncInFlightRef = useRef(false);

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
            hasPaidPremium: false,
            paidPremiumSource: null,
            subscriptionRenewalAt: null,
            premiumGrant: null,
            isTrialActive: false,
            trialEndsAt: null,
            isLoading: false,
          });
        }
        return;
      }

      if (cancelled) return;

      const uid = user.id;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;

      if (session) {
        await ensureTrialStatusForSession(session);
      }

      const [profileResult, subscriptionRow, serverEntitlements, activePremiumGrant, revenueCatCustomerInfo] =
        await Promise.all([
        supabase
          .from('user_profiles')
          .select('trial_ends_at')
          .eq('user_id', uid)
          .maybeSingle(),
        fetchServerSubscription(uid),
        fetchServerEntitlements(accessToken),
        fetchActivePremiumGrant(uid),
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

      let resolvedServerEntitlements = serverEntitlements;
      let resolvedSubscriptionRow = subscriptionRow;
      const hasActiveRevenueCatEntitlement = hasRevenueCatPremiumEntitlement(revenueCatCustomerInfo);
      const hasSyncedSubscription = isActiveSubscription(resolvedSubscriptionRow);

      if (
        hasActiveRevenueCatEntitlement &&
        accessToken &&
        !revenueCatSyncInFlightRef.current &&
        (!hasSyncedSubscription || !resolvedServerEntitlements?.isPremium)
      ) {
        revenueCatSyncInFlightRef.current = true;

        try {
          const syncResult = await syncRevenueCatSubscriptionToServer(
            accessToken,
            getCurrentRevenueCatProviderHint()
          );

          if (syncResult?.synced) {
            const [nextSubscriptionRow, nextServerEntitlements] = await Promise.all([
              fetchServerSubscription(uid),
              fetchServerEntitlements(accessToken),
            ]);

            resolvedSubscriptionRow = nextSubscriptionRow ?? resolvedSubscriptionRow;
            resolvedServerEntitlements = nextServerEntitlements ?? resolvedServerEntitlements;
          }
        } finally {
          revenueCatSyncInFlightRef.current = false;
        }
      }

      if (cancelled) return;

      const trialEndsAt = resolvedServerEntitlements?.trialEndsAt ?? profileResult.data?.trial_ends_at ?? null;
      const isTrialActive = trialEndsAt
        ? new Date(trialEndsAt).getTime() > Date.now()
        : false;
      const hasActiveSubscription = isActiveSubscription(resolvedSubscriptionRow);
      const hasPaidPremium = hasActiveSubscription || hasActiveRevenueCatEntitlement;
      const subscriptionRenewalAt = hasActiveSubscription
        ? (resolvedSubscriptionRow?.current_period_end ?? getRevenueCatPremiumExpiration(revenueCatCustomerInfo))
        : hasActiveRevenueCatEntitlement
          ? getRevenueCatPremiumExpiration(revenueCatCustomerInfo)
          : null;
      const subscriptionProvider =
        hasActiveSubscription && typeof resolvedSubscriptionRow?.provider === 'string'
          ? (resolvedSubscriptionRow?.provider ?? '').trim().toLowerCase()
          : '';
      const paidPremiumSource: PaidPremiumSource = hasActiveSubscription
        ? subscriptionProvider === 'google' || subscriptionProvider === 'apple'
          ? (subscriptionProvider as PaidPremiumSource)
          : 'web'
        : hasActiveRevenueCatEntitlement
          ? Platform.OS === 'android'
            ? 'google'
            : Platform.OS === 'ios'
              ? 'apple'
              : null
          : null;

      const fallbackPremium = isTrialActive || hasActiveSubscription || activePremiumGrant !== null;
      const isPremium = (resolvedServerEntitlements?.isPremium ?? fallbackPremium) || hasActiveRevenueCatEntitlement;

      setState({
        isPremium,
        hasPaidPremium,
        paidPremiumSource,
        subscriptionRenewalAt,
        premiumGrant: activePremiumGrant,
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

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkPremium();
      }
    });
    const removePremiumStatusChangeListener = addPremiumStatusChangeListener(({ customerInfo }) => {
      void checkPremium(undefined, customerInfo);
    });

    return () => {
      cancelled = true;
      revenueCatSyncInFlightRef.current = false;
      removeCustomerInfoListener?.();
      removePremiumStatusChangeListener();
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return state;
}

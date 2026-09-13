import { useSyncExternalStore } from 'react';
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
import { WEB_API_BASE_URL } from '../lib/webApi';

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

const DEFAULT_PREMIUM_STATE: PremiumState = {
  isPremium: false,
  hasPaidPremium: false,
  paidPremiumSource: null,
  subscriptionRenewalAt: null,
  premiumGrant: null,
  isTrialActive: false,
  trialEndsAt: null,
  isLoading: true,
};

let premiumStateCache: PremiumState = DEFAULT_PREMIUM_STATE;

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
  if (!accessToken) return null;

  try {
    const response = await fetch(`${WEB_API_BASE_URL}/api/entitlements`, {
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

const premiumStateListeners = new Set<() => void>();
let stopPremiumMonitor: (() => void) | null = null;
let premiumMonitorGeneration = 0;
let revenueCatSyncInFlight = false;
let revenueCatListenerGeneration = 0;
let removeRevenueCatCustomerInfoListener: (() => void) | null = null;

type PremiumCheckRequest = {
  customerInfoOverride: CustomerInfo | null | undefined;
  userOverride: User | null | undefined;
  version: number;
};

let pendingPremiumCheck: PremiumCheckRequest | null = null;
let premiumCheckLoop: Promise<void> | null = null;
let premiumCheckVersion = 0;

function arePremiumGrantsEqual(left: ActivePremiumGrant | null, right: ActivePremiumGrant | null) {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.startsAt === right.startsAt &&
    left.endsAt === right.endsAt &&
    left.initialDurationDays === right.initialDurationDays &&
    left.reason === right.reason &&
    left.remainingDays === right.remainingDays
  );
}

function arePremiumStatesEqual(left: PremiumState, right: PremiumState) {
  return (
    left.isPremium === right.isPremium &&
    left.hasPaidPremium === right.hasPaidPremium &&
    left.paidPremiumSource === right.paidPremiumSource &&
    left.subscriptionRenewalAt === right.subscriptionRenewalAt &&
    arePremiumGrantsEqual(left.premiumGrant, right.premiumGrant) &&
    left.isTrialActive === right.isTrialActive &&
    left.trialEndsAt === right.trialEndsAt &&
    left.isLoading === right.isLoading
  );
}

function applyPremiumState(nextState: PremiumState) {
  if (arePremiumStatesEqual(premiumStateCache, nextState)) return;

  premiumStateCache = nextState;
  premiumStateListeners.forEach((listener) => listener());
}

async function checkPremium(
  request: PremiumCheckRequest,
  monitorGeneration: number,
) {
  const isCurrentMonitor = () =>
    stopPremiumMonitor !== null &&
    monitorGeneration === premiumMonitorGeneration &&
    request.version === premiumCheckVersion;
  const user =
    request.userOverride !== undefined
      ? request.userOverride
      : (await supabase.auth.getUser()).data.user;

  if (!isCurrentMonitor()) return;

  if (!user) {
    applyPremiumState({
      isPremium: false,
      hasPaidPremium: false,
      paidPremiumSource: null,
      subscriptionRenewalAt: null,
      premiumGrant: null,
      isTrialActive: false,
      trialEndsAt: null,
      isLoading: false,
    });
    return;
  }

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
      request.customerInfoOverride !== undefined
        ? Promise.resolve(request.customerInfoOverride)
        : canUseRevenueCat()
          ? getRevenueCatCustomerInfo(uid).catch((error) => {
              console.warn('Unable to load RevenueCat premium state.', error);
              return null;
            })
          : Promise.resolve(null),
    ]);

  if (!isCurrentMonitor()) return;

  let resolvedServerEntitlements = serverEntitlements;
  let resolvedSubscriptionRow = subscriptionRow;
  const hasActiveRevenueCatEntitlement = hasRevenueCatPremiumEntitlement(revenueCatCustomerInfo);
  const hasSyncedSubscription = isActiveSubscription(resolvedSubscriptionRow);

  if (
    hasActiveRevenueCatEntitlement &&
    accessToken &&
    !revenueCatSyncInFlight &&
    (!hasSyncedSubscription || !resolvedServerEntitlements?.isPremium)
  ) {
    revenueCatSyncInFlight = true;

    try {
      const syncResult = await syncRevenueCatSubscriptionToServer(
        accessToken,
        getCurrentRevenueCatProviderHint(),
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
      revenueCatSyncInFlight = false;
    }
  }

  if (!isCurrentMonitor()) return;

  const trialEndsAt = resolvedServerEntitlements?.trialEndsAt ?? profileResult.data?.trial_ends_at ?? null;
  const isTrialActive = trialEndsAt ? new Date(trialEndsAt).getTime() > Date.now() : false;
  const hasActiveSubscription = isActiveSubscription(resolvedSubscriptionRow);
  const hasPaidPremium = hasActiveSubscription || hasActiveRevenueCatEntitlement;
  const subscriptionRenewalAt = hasActiveSubscription
    ? (resolvedSubscriptionRow?.current_period_end ?? getRevenueCatPremiumExpiration(revenueCatCustomerInfo))
    : hasActiveRevenueCatEntitlement
      ? getRevenueCatPremiumExpiration(revenueCatCustomerInfo)
      : null;
  const subscriptionProvider =
    hasActiveSubscription && typeof resolvedSubscriptionRow?.provider === 'string'
      ? (resolvedSubscriptionRow.provider ?? '').trim().toLowerCase()
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

  applyPremiumState({
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

function queuePremiumCheck(
  userOverride?: User | null,
  customerInfoOverride?: CustomerInfo | null,
) {
  pendingPremiumCheck = {
    userOverride,
    customerInfoOverride,
    version: ++premiumCheckVersion,
  };
  if (premiumCheckLoop) return premiumCheckLoop;

  premiumCheckLoop = (async () => {
    while (pendingPremiumCheck) {
      const request = pendingPremiumCheck;
      pendingPremiumCheck = null;
      try {
        await checkPremium(request, premiumMonitorGeneration);
      } catch (error) {
        console.warn('Unable to refresh shared premium state.', error);
      }
    }
  })().finally(() => {
    premiumCheckLoop = null;
  });

  return premiumCheckLoop;
}

async function attachRevenueCatListener(user: User | null) {
  const listenerGeneration = ++revenueCatListenerGeneration;
  removeRevenueCatCustomerInfoListener?.();
  removeRevenueCatCustomerInfoListener = null;

  if (!user || !canUseRevenueCat()) return;

  const removeListener =
    (await addRevenueCatCustomerInfoListener(user.id, (customerInfo) => {
      void queuePremiumCheck(user, customerInfo);
    })) ?? null;

  if (listenerGeneration !== revenueCatListenerGeneration || stopPremiumMonitor === null) {
    removeListener?.();
    return;
  }

  removeRevenueCatCustomerInfoListener = removeListener;
}

function startPremiumMonitor() {
  if (stopPremiumMonitor) return;

  const monitorGeneration = ++premiumMonitorGeneration;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    const nextUser = session?.user ?? null;
    void attachRevenueCatListener(nextUser);
    void queuePremiumCheck(nextUser);
  });
  const appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void queuePremiumCheck();
    }
  });
  const removePremiumStatusChangeListener = addPremiumStatusChangeListener(({ customerInfo }) => {
    void queuePremiumCheck(undefined, customerInfo);
  });

  stopPremiumMonitor = () => {
    premiumMonitorGeneration += 1;
    revenueCatListenerGeneration += 1;
    premiumCheckVersion += 1;
    pendingPremiumCheck = null;
    removeRevenueCatCustomerInfoListener?.();
    removeRevenueCatCustomerInfoListener = null;
    removePremiumStatusChangeListener();
    subscription.unsubscribe();
    appStateSubscription.remove();
    stopPremiumMonitor = null;
  };

  void (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (monitorGeneration !== premiumMonitorGeneration || !stopPremiumMonitor) return;
    await attachRevenueCatListener(user);
    await queuePremiumCheck(user);
  })();
}

function subscribeToPremiumState(listener: () => void) {
  premiumStateListeners.add(listener);
  startPremiumMonitor();

  return () => {
    premiumStateListeners.delete(listener);
    if (premiumStateListeners.size === 0) {
      stopPremiumMonitor?.();
    }
  };
}

function getPremiumStateSnapshot() {
  return premiumStateCache;
}

export function usePremium(): PremiumState {
  return useSyncExternalStore(
    subscribeToPremiumState,
    getPremiumStateSnapshot,
    getPremiumStateSnapshot,
  );
}

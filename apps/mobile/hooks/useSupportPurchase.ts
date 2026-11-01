import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  getRevenueCatSupportProduct,
  getRevenueCatSupportProductId,
  isRevenueCatPurchaseCancelled,
  purchaseRevenueCatSupport,
} from '../lib/revenueCat';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { WEB_API_BASE_URL } from '../lib/webApi';

type SupportState = {
  available: boolean;
  error: string | null;
  loading: boolean;
  priceString: string | null;
  purchased: boolean;
  purchasing: boolean;
  productId: string | null;
};

type SupportStatusResponse = {
  canPurchase?: boolean;
  productId?: string | null;
  purchased?: boolean;
};

const INITIAL_STATE: SupportState = {
  available: false,
  error: null,
  loading: false,
  priceString: null,
  purchased: false,
  purchasing: false,
  productId: null,
};

function getProvider() {
  if (Platform.OS === 'ios') return 'apple' as const;
  if (Platform.OS === 'android') return 'google' as const;
  return null;
}

async function getSessionForUser(userId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id === userId ? session : null;
}

async function callSupportApi(
  accessToken: string,
  provider: 'apple' | 'google',
  options?: { body: Record<string, unknown> },
  signal?: AbortSignal,
) {
  const response = await fetchWithTimeout(
    options
      ? `${WEB_API_BASE_URL}/api/runner/support`
      : `${WEB_API_BASE_URL}/api/runner/support?provider=${provider}`,
    options
      ? {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(options.body),
          signal,
        }
      : { headers: { Authorization: `Bearer ${accessToken}` }, signal },
  );
  const payload = await response.json().catch(() => null) as SupportStatusResponse | null;
  return { ok: response.ok, payload, status: response.status };
}

function getSupportErrorMessage(error: unknown, locale: string) {
  const code = error instanceof Error ? error.message : 'support_purchase_failed';
  const isFrench = locale === 'fr';
  if (code === 'support_auth_required') {
    return isFrench ? 'Connecte-toi pour soutenir Pace Yourself.' : 'Sign in to support Pace Yourself.';
  }
  if (code === 'support_purchase_not_authorized') {
    return isFrench ? 'Cet achat de soutien n’est pas disponible pour ce compte.' : 'This support purchase is not available for this account.';
  }
  if (code === 'support_product_mismatch') {
    return isFrench ? 'Le produit de soutien n’est pas disponible sur cette version de l’app.' : 'The support product is not available in this version of the app.';
  }
  if (code === 'support_purchase_unverified') {
    return isFrench ? 'Ton achat est en cours de vérification. Réessaie dans quelques instants.' : 'Your purchase is still being verified. Try again in a moment.';
  }
  if (code === 'support_status_unavailable') {
    return isFrench ? 'Impossible de vérifier ton soutien pour le moment.' : 'Unable to verify your support right now.';
  }
  return isFrench ? 'Impossible de finaliser l’achat de soutien pour le moment.' : 'Unable to complete the support purchase right now.';
}

export function useSupportPurchase(userId: string | null) {
  const { locale } = useI18n();
  const [state, setState] = useState<SupportState>({ ...INITIAL_STATE, loading: Boolean(userId) });
  const purchaseLock = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const provider = getProvider();
    activeUserIdRef.current = userId;

    if (!userId || !provider || !WEB_API_BASE_URL) {
      setState(INITIAL_STATE);
      return () => {
        cancelled = true;
        controller.abort();
        if (activeUserIdRef.current === userId) activeUserIdRef.current = null;
      };
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    void (async () => {
      try {
        const session = await getSessionForUser(userId);
        if (!session) throw new Error('support_auth_required');
        const status = await callSupportApi(session.access_token, provider, undefined, controller.signal);
        if (!status.ok || !status.payload) throw new Error('support_status_unavailable');

        let purchased = status.payload.purchased === true;
        if (!purchased) {
          const reconciled = await callSupportApi(session.access_token, provider, {
            body: { action: 'reconcile', provider },
          }, controller.signal);
          purchased = reconciled.ok && reconciled.payload?.purchased === true;
        }

        const serverProductId = status.payload.productId ?? null;
        const clientProductId = getRevenueCatSupportProductId();
        const product = serverProductId && clientProductId === serverProductId
          ? await getRevenueCatSupportProduct(userId, serverProductId).catch(() => null)
          : null;
        if (cancelled) return;
        setState({
          available: !purchased && status.payload.canPurchase === true && Boolean(product),
          error: null,
          loading: false,
          priceString: product?.priceString ?? null,
          purchased,
          purchasing: false,
          productId: serverProductId,
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          ...INITIAL_STATE,
          error: getSupportErrorMessage(error, locale),
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (activeUserIdRef.current === userId) activeUserIdRef.current = null;
    };
  }, [locale, userId]);

  const purchase = useCallback(async () => {
    const provider = getProvider();
    if (!userId || !provider || !state.available || state.purchased || purchaseLock.current !== null) return;
    const purchaseUserId = userId;
    const isCurrentUser = () => activeUserIdRef.current === purchaseUserId;
    purchaseLock.current = purchaseUserId;
    if (isCurrentUser()) setState((current) => ({ ...current, purchasing: true, error: null }));

    let intentId: string | null = null;
    let storeCompleted = false;

    try {
      const session = await getSessionForUser(purchaseUserId);
      if (!session) throw new Error('support_auth_required');
      const authorization = await callSupportApi(session.access_token, provider, {
        body: { action: 'authorize', provider },
      });
      const authorizationPayload = authorization.payload as SupportStatusResponse & { intentId?: string } | null;
      const productId = authorizationPayload?.productId ?? null;
      if (!authorization.ok || !authorizationPayload?.intentId || !productId) {
        throw new Error('support_purchase_not_authorized');
      }
      intentId = authorizationPayload.intentId;
      if (getRevenueCatSupportProductId() !== productId) throw new Error('support_product_mismatch');
      if (!isCurrentUser() || !(await getSessionForUser(purchaseUserId))) {
        throw new Error('support_auth_required');
      }

      const result = await purchaseRevenueCatSupport(purchaseUserId, productId);
      const transactionId = result?.transaction?.transactionIdentifier ?? null;
      if (!transactionId) throw new Error('support_purchase_unverified');
      storeCompleted = true;
      const synced = await callSupportApi(session.access_token, provider, {
        body: {
          action: 'sync',
          provider,
          intentId,
          transactionId,
        },
      });
      if (!synced.ok || synced.payload?.purchased !== true) throw new Error('support_purchase_unverified');
      if (isCurrentUser()) {
        setState((current) => ({
          ...current,
          available: false,
          error: null,
          purchased: true,
          purchasing: false,
        }));
      }
    } catch (error) {
      if (isRevenueCatPurchaseCancelled(error)) {
        const session = await getSessionForUser(purchaseUserId).catch(() => null);
        if (session && intentId) {
          await callSupportApi(session.access_token, provider, {
            body: { action: 'cancel', provider, intentId },
          }).catch(() => null);
        }
        if (isCurrentUser()) setState((current) => ({ ...current, purchasing: false, error: null }));
      } else {
        const session = await getSessionForUser(purchaseUserId).catch(() => null);
        const reconciled = session
          ? await callSupportApi(session.access_token, provider, {
              body: { action: 'reconcile', provider },
            }).catch(() => null)
          : null;
        if (reconciled?.ok && reconciled.payload?.purchased === true) {
          if (isCurrentUser()) {
            setState((current) => ({
              ...current,
              available: false,
              error: null,
              purchased: true,
              purchasing: false,
            }));
          }
        } else {
          if (!storeCompleted && session && intentId) {
            await callSupportApi(session.access_token, provider, {
              body: { action: 'cancel', provider, intentId },
            }).catch(() => null);
          }
          if (isCurrentUser()) {
            setState((current) => ({
              ...current,
              error: getSupportErrorMessage(error, locale),
              purchasing: false,
            }));
          }
        }
      }
    } finally {
      if (purchaseLock.current === purchaseUserId) purchaseLock.current = null;
    }
  }, [locale, state.available, state.purchased, userId]);

  return {
    priceString: state.priceString,
    loading: state.loading,
    purchasing: state.purchasing,
    purchased: state.purchased,
    error: state.error,
    available: state.available,
    purchase,
  };
}

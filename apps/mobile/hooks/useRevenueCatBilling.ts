import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import {
  addRevenueCatCustomerInfoListener,
  canUseRevenueCat,
  getRevenueCatCurrentOffering,
  getRevenueCatCourseProduct,
  getRevenueCatCustomerInfo,
  getRevenueCatPremiumEntitlement,
  hasRevenueCatPremiumEntitlement,
  isRevenueCatPurchaseCancelled,
  isRevenueCatPurchaseUnavailable,
  pickRevenueCatPrimaryPackage,
  purchaseRevenueCatPackage,
  purchaseRevenueCatCourse,
  restoreRevenueCatPurchases,
} from '../lib/revenueCat';
import { getCurrentRevenueCatProviderHint, syncRevenueCatSubscriptionToServer } from '../lib/revenueCatSync';
import { emitPremiumStatusChange } from '../lib/premiumEvents';
import { captureAnalyticsEvent } from '../lib/posthog';
import { WEB_API_BASE_URL } from '../lib/webApi';

type PurchasePlacement = 'feature_gate' | 'profile';

type PurchaseResult =
  | { status: 'purchased' }
  | { status: 'unverified' }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

type RestoreResult = 'restored' | 'cancelled' | 'unavailable';

function getBillingStore() {
  if (Platform.OS === 'ios') return 'app_store';
  if (Platform.OS === 'android') return 'play_store';
  return Platform.OS;
}

type BillingState = {
  isAvailable: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  currentPackage: PurchasesPackage | null;
  managementUrl: string | null;
  isPremium: boolean;
  coursePriceString: string | null;
};

const DEFAULT_STATE: BillingState = {
  isAvailable: canUseRevenueCat(),
  isLoading: canUseRevenueCat(),
  isPurchasing: false,
  isRestoring: false,
  customerInfo: null,
  offering: null,
  currentPackage: null,
  managementUrl: null,
  isPremium: false,
  coursePriceString: null,
};

export function useRevenueCatBilling() {
  const [state, setState] = useState<BillingState>(DEFAULT_STATE);

  async function loadBillingSnapshot(userId: string) {
    const [customerInfo, offering, courseProduct] = await Promise.all([
      getRevenueCatCustomerInfo(userId).catch((error) => {
        console.warn('Unable to load RevenueCat customer info.', error);
        return null;
      }),
      getRevenueCatCurrentOffering(userId).catch((error) => {
        console.warn('Unable to load RevenueCat offering.', error);
        return null;
      }),
      getRevenueCatCourseProduct(userId).catch(() => null),
    ]);

    return {
      customerInfo,
      offering,
      currentPackage: pickRevenueCatPrimaryPackage(offering),
      coursePriceString: courseProduct?.priceString ?? null,
    };
  }

  async function syncRevenueCatStateToServer(customerInfo: CustomerInfo | null | undefined) {
    if (!customerInfo) return;

    if (hasRevenueCatPremiumEntitlement(customerInfo)) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await syncRevenueCatSubscriptionToServer(session?.access_token ?? null, getCurrentRevenueCatProviderHint());
    }

    emitPremiumStatusChange({ customerInfo });
  }

  useEffect(() => {
    let cancelled = false;
    let removeCustomerInfoListener: (() => void) | null = null;

    async function refresh() {
      if (!canUseRevenueCat()) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            isAvailable: false,
            isLoading: false,
            offering: null,
            currentPackage: null,
            managementUrl: null,
            isPremium: false,
            customerInfo: null,
          }));
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            isAvailable: true,
            isLoading: false,
            offering: null,
            currentPackage: null,
            managementUrl: null,
            isPremium: false,
            customerInfo: null,
          }));
        }
        return;
      }

      const { customerInfo, offering, currentPackage, coursePriceString } = await loadBillingSnapshot(user.id);

      if (cancelled) return;

      await syncRevenueCatStateToServer(customerInfo);

      setState((current) => ({
        ...current,
        isAvailable: true,
        isLoading: false,
        customerInfo,
        offering,
        currentPackage,
        managementUrl: customerInfo?.managementURL ?? null,
        isPremium: hasRevenueCatPremiumEntitlement(customerInfo),
        coursePriceString,
      }));

      removeCustomerInfoListener?.();
      removeCustomerInfoListener =
        (await addRevenueCatCustomerInfoListener(user.id, (nextCustomerInfo) => {
          if (cancelled) return;

          void syncRevenueCatStateToServer(nextCustomerInfo);

          setState((current) => ({
            ...current,
            customerInfo: nextCustomerInfo,
            managementUrl: nextCustomerInfo.managementURL ?? null,
            isPremium: hasRevenueCatPremiumEntitlement(nextCustomerInfo),
          }));
        })) ?? null;
    }

    void refresh();

    return () => {
      cancelled = true;
      removeCustomerInfoListener?.();
    };
  }, []);

  async function refresh() {
    setState((current) => ({ ...current, isLoading: current.isAvailable }));

    if (!canUseRevenueCat()) {
      setState((current) => ({ ...current, isAvailable: false, isLoading: false }));
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState((current) => ({
        ...current,
        isLoading: false,
        customerInfo: null,
        offering: null,
        currentPackage: null,
        managementUrl: null,
        isPremium: false,
      }));
      return;
    }

    const { customerInfo, offering, currentPackage, coursePriceString } = await loadBillingSnapshot(user.id);

    await syncRevenueCatStateToServer(customerInfo);

    setState((current) => ({
      ...current,
      isAvailable: true,
      isLoading: false,
      customerInfo,
      offering,
      currentPackage,
      managementUrl: customerInfo?.managementURL ?? null,
      isPremium: hasRevenueCatPremiumEntitlement(customerInfo),
      coursePriceString,
    }));
  }

  async function purchase(placement: PurchasePlacement): Promise<PurchaseResult> {
    const baseAnalyticsProperties = {
      billing_provider: 'revenuecat',
      placement,
      store: getBillingStore(),
    };

    captureAnalyticsEvent('premium checkout started', {
      ...baseAnalyticsProperties,
      package_id: state.currentPackage?.identifier,
      product_id: state.currentPackage?.product.identifier,
    });

    if (!canUseRevenueCat()) {
      captureAnalyticsEvent('premium checkout unavailable', {
        ...baseAnalyticsProperties,
        reason: 'revenuecat_unavailable',
      });
      return { status: 'unavailable' };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      captureAnalyticsEvent('premium checkout unavailable', {
        ...baseAnalyticsProperties,
        reason: 'missing_user',
      });
      return { status: 'unavailable' };
    }

    setState((current) => ({ ...current, isPurchasing: true }));

    try {
      let selectedPackage = state.currentPackage;
      let currentCustomerInfo = state.customerInfo;

      if (!selectedPackage) {
        const refreshedSnapshot = await loadBillingSnapshot(user.id);
        selectedPackage = refreshedSnapshot.currentPackage;
        currentCustomerInfo = refreshedSnapshot.customerInfo;

        setState((current) => ({
          ...current,
          customerInfo: refreshedSnapshot.customerInfo,
          offering: refreshedSnapshot.offering,
          currentPackage: refreshedSnapshot.currentPackage,
          managementUrl: refreshedSnapshot.customerInfo?.managementURL ?? current.managementUrl,
          isPremium: hasRevenueCatPremiumEntitlement(refreshedSnapshot.customerInfo),
          coursePriceString: refreshedSnapshot.coursePriceString,
        }));
      }

      if (!selectedPackage) {
        setState((current) => ({
          ...current,
          isPurchasing: false,
          managementUrl: currentCustomerInfo?.managementURL ?? current.managementUrl,
        }));
        captureAnalyticsEvent('premium checkout unavailable', {
          ...baseAnalyticsProperties,
          reason: 'missing_package',
        });
        return { status: 'unavailable' };
      }

      const provider = Platform.OS === 'ios' ? 'apple' : 'google';
      const authorization = await fetch(`${WEB_API_BASE_URL}/api/runner/purchase-authorization?provider=${provider}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
      const authorizationPayload = authorization?.ok
        ? await authorization.json().catch(() => null) as { allowed?: boolean; productId?: string } | null
        : null;
      const configuredAnnual = authorizationPayload?.allowed === true
        && authorizationPayload.productId === selectedPackage.product.identifier
        && selectedPackage.product.currencyCode?.toUpperCase() === 'EUR'
        && Math.abs(selectedPackage.product.price - 29.99) < 0.001;
      if (!configuredAnnual) {
        setState((current) => ({ ...current, isPurchasing: false }));
        captureAnalyticsEvent('premium checkout unavailable', { ...baseAnalyticsProperties, reason: 'purchase_not_authorized' });
        return { status: 'unavailable' };
      }

      const result = await purchaseRevenueCatPackage(user.id, selectedPackage);
      const customerInfo = result?.customerInfo ?? null;

      await syncRevenueCatStateToServer(customerInfo);

      setState((current) => ({
        ...current,
        isPurchasing: false,
        customerInfo,
        managementUrl: customerInfo?.managementURL ?? current.managementUrl,
        isPremium: hasRevenueCatPremiumEntitlement(customerInfo) || current.isPremium,
      }));

      if (!result) {
        captureAnalyticsEvent('premium checkout unavailable', {
          ...baseAnalyticsProperties,
          package_id: selectedPackage.identifier,
          product_id: selectedPackage.product.identifier,
          reason: 'empty_purchase_result',
        });
        return { status: 'unavailable' };
      }

      const premiumEntitlement = getRevenueCatPremiumEntitlement(customerInfo);
      if (
        !premiumEntitlement?.isActive ||
        premiumEntitlement.productIdentifier !== result.productIdentifier
      ) {
        captureAnalyticsEvent('premium purchase unverified', {
          ...baseAnalyticsProperties,
          entitlement_product_id: premiumEntitlement?.productIdentifier,
          package_id: selectedPackage.identifier,
          product_id: result.productIdentifier,
          reason: premiumEntitlement?.isActive
            ? 'entitlement_product_mismatch'
            : 'inactive_premium_entitlement',
        });
        return { status: 'unverified' };
      }

      captureAnalyticsEvent('premium purchase verified', {
        ...baseAnalyticsProperties,
        entitlement_id: premiumEntitlement.identifier,
        environment: premiumEntitlement.isSandbox ? 'sandbox' : 'production',
        expiration_date: premiumEntitlement.expirationDate,
        ownership_type: premiumEntitlement.ownershipType,
        package_id: selectedPackage.identifier,
        period_type: premiumEntitlement.periodType,
        product_id: result.productIdentifier,
        purchase_date: result.transaction.purchaseDate,
        revenuecat_store: premiumEntitlement.store,
        transaction_id: result.transaction.transactionIdentifier,
        verification_source: 'revenuecat_customer_info',
      });

      return { status: 'purchased' };
    } catch (error) {
      setState((current) => ({ ...current, isPurchasing: false }));

      if (isRevenueCatPurchaseCancelled(error)) {
        captureAnalyticsEvent('premium checkout cancelled', baseAnalyticsProperties);
        return { status: 'cancelled' };
      }

      if (isRevenueCatPurchaseUnavailable(error)) {
        captureAnalyticsEvent('premium checkout unavailable', {
          ...baseAnalyticsProperties,
          reason: 'purchase_error',
        });
        return { status: 'unavailable' };
      }

      captureAnalyticsEvent('premium purchase failed', baseAnalyticsProperties);

      throw error;
    }
  }

  async function restore(): Promise<RestoreResult> {
    if (!canUseRevenueCat()) return 'unavailable';

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'unavailable';

    setState((current) => ({ ...current, isRestoring: true }));

    try {
      const customerInfo = await restoreRevenueCatPurchases(user.id);

      await syncRevenueCatStateToServer(customerInfo);

      setState((current) => ({
        ...current,
        isRestoring: false,
        customerInfo,
        managementUrl: customerInfo?.managementURL ?? current.managementUrl,
        isPremium: hasRevenueCatPremiumEntitlement(customerInfo) || current.isPremium,
      }));

      return customerInfo ? 'restored' : 'unavailable';
    } catch (error) {
      setState((current) => ({ ...current, isRestoring: false }));

      if (isRevenueCatPurchaseCancelled(error)) {
        return 'cancelled';
      }

      if (isRevenueCatPurchaseUnavailable(error)) {
        return 'unavailable';
      }

      throw error;
    }
  }

  async function buyCourse(planId: string): Promise<'purchased' | 'cancelled' | 'unavailable' | 'unverified'> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !canUseRevenueCat()) return 'unavailable';
    const baseUrl = WEB_API_BASE_URL;
    if (!baseUrl) return 'unavailable';
    const provider = Platform.OS === 'ios' ? 'apple' : 'google';
    const intentResponse = await fetch(`${baseUrl}/api/runner/purchase-intents`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, provider }) });
    if (!intentResponse.ok) return 'unavailable';
    const intent = await intentResponse.json() as { intentId?: string; productId?: string; recovered?: boolean; storeStarted?: boolean };
    if (!intent.intentId || !intent.productId) return 'unavailable';
    try {
      setState((current) => ({ ...current, isPurchasing: true }));
      if (intent.recovered) {
        const recovered = await fetch(`${baseUrl}/api/runner/purchases/sync`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: intent.intentId }) });
        if (recovered.ok) {
          const state = await recovered.json() as { granted?: boolean };
          if (state.granted) return 'purchased';
        }
        if (intent.storeStarted) return 'unverified';
      }
      const startResponse = await fetch(`${baseUrl}/api/runner/purchase-intents`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: intent.intentId }) });
      if (!startResponse.ok) return 'unverified';
      const result = await purchaseRevenueCatCourse(session.user.id, intent.productId);
      const transactionId = result?.transaction?.transactionIdentifier;
      if (!result || !transactionId) return 'unverified';
      const syncResponse = await fetch(`${baseUrl}/api/runner/purchases/sync`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: intent.intentId, transactionId }) });
      if (!syncResponse.ok) return 'unverified';
      const synced = await syncResponse.json().catch(() => null) as { granted?: boolean } | null;
      return synced?.granted ? 'purchased' : 'unverified';
    } catch (error) {
      if (isRevenueCatPurchaseCancelled(error)) {
        await fetch(`${baseUrl}/api/runner/purchase-intents`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: intent.intentId }) }).catch(() => undefined);
        return 'cancelled';
      }
      if (isRevenueCatPurchaseUnavailable(error)) return 'unavailable';
      throw error;
    } finally {
      setState((current) => ({ ...current, isPurchasing: false }));
    }
  }

  return {
    ...state,
    refresh,
    purchase,
    restore,
    buyCourse,
  };
}

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import {
  addRevenueCatCustomerInfoListener,
  canUseRevenueCat,
  getRevenueCatCurrentOffering,
  getRevenueCatCustomerInfo,
  getRevenueCatPremiumEntitlement,
  hasRevenueCatPremiumEntitlement,
  isRevenueCatPurchaseCancelled,
  isRevenueCatPurchaseUnavailable,
  pickRevenueCatPrimaryPackage,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '../lib/revenueCat';
import { getCurrentRevenueCatProviderHint, syncRevenueCatSubscriptionToServer } from '../lib/revenueCatSync';
import { emitPremiumStatusChange } from '../lib/premiumEvents';
import { captureAnalyticsEvent } from '../lib/posthog';

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
};

export function useRevenueCatBilling() {
  const [state, setState] = useState<BillingState>(DEFAULT_STATE);

  async function loadBillingSnapshot(userId: string) {
    const [customerInfo, offering] = await Promise.all([
      getRevenueCatCustomerInfo(userId).catch((error) => {
        console.warn('Unable to load RevenueCat customer info.', error);
        return null;
      }),
      getRevenueCatCurrentOffering(userId).catch((error) => {
        console.warn('Unable to load RevenueCat offering.', error);
        return null;
      }),
    ]);

    return {
      customerInfo,
      offering,
      currentPackage: pickRevenueCatPrimaryPackage(offering),
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

      const { customerInfo, offering, currentPackage } = await loadBillingSnapshot(user.id);

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

    const { customerInfo, offering, currentPackage } = await loadBillingSnapshot(user.id);

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
      data: { user },
    } = await supabase.auth.getUser();
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

  return {
    ...state,
    refresh,
    purchase,
    restore,
  };
}

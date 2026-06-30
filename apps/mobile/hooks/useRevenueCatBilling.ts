import { useEffect, useState } from 'react';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import {
  addRevenueCatCustomerInfoListener,
  canUseRevenueCat,
  getRevenueCatCurrentOffering,
  getRevenueCatCustomerInfo,
  hasRevenueCatPremiumEntitlement,
  isRevenueCatPurchaseCancelled,
  isRevenueCatPurchaseUnavailable,
  pickRevenueCatPrimaryPackage,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '../lib/revenueCat';
import { getCurrentRevenueCatProviderHint, syncRevenueCatSubscriptionToServer } from '../lib/revenueCatSync';
import { emitPremiumStatusChange } from '../lib/premiumEvents';

type PurchaseResult = 'purchased' | 'restored' | 'cancelled' | 'unavailable';

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

  async function purchase(): Promise<PurchaseResult> {
    if (!canUseRevenueCat()) return 'unavailable';

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'unavailable';

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
        return 'unavailable';
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

      return result ? 'purchased' : 'unavailable';
    } catch (error) {
      setState((current) => ({ ...current, isPurchasing: false }));

      if (isRevenueCatPurchaseCancelled(error)) {
        return 'cancelled';
      }

      if (isRevenueCatPurchaseUnavailable(error)) {
        return 'unavailable';
      }

      throw error;
    }
  }

  async function restore(): Promise<PurchaseResult> {
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

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
  pickRevenueCatPrimaryPackage,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '../lib/revenueCat';
import { getCurrentRevenueCatProviderHint, syncRevenueCatSubscriptionToServer } from '../lib/revenueCatSync';

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

  async function syncRevenueCatStateToServer(customerInfo: CustomerInfo | null | undefined) {
    if (!hasRevenueCatPremiumEntitlement(customerInfo)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    await syncRevenueCatSubscriptionToServer(session?.access_token ?? null, getCurrentRevenueCatProviderHint());
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

      const [customerInfo, offering] = await Promise.all([
        getRevenueCatCustomerInfo(user.id).catch((error) => {
          console.warn('Unable to load RevenueCat customer info.', error);
          return null;
        }),
        getRevenueCatCurrentOffering(user.id).catch((error) => {
          console.warn('Unable to load RevenueCat offering.', error);
          return null;
        }),
      ]);

      if (cancelled) return;

      const nextPackage = pickRevenueCatPrimaryPackage(offering);

      await syncRevenueCatStateToServer(customerInfo);

      setState((current) => ({
        ...current,
        isAvailable: true,
        isLoading: false,
        customerInfo,
        offering,
        currentPackage: nextPackage,
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

    const [customerInfo, offering] = await Promise.all([
      getRevenueCatCustomerInfo(user.id).catch((error) => {
        console.warn('Unable to refresh RevenueCat customer info.', error);
        return null;
      }),
      getRevenueCatCurrentOffering(user.id).catch((error) => {
        console.warn('Unable to refresh RevenueCat offering.', error);
        return null;
      }),
    ]);

    await syncRevenueCatStateToServer(customerInfo);

    setState((current) => ({
      ...current,
      isAvailable: true,
      isLoading: false,
      customerInfo,
      offering,
      currentPackage: pickRevenueCatPrimaryPackage(offering),
      managementUrl: customerInfo?.managementURL ?? null,
      isPremium: hasRevenueCatPremiumEntitlement(customerInfo),
    }));
  }

  async function purchase(): Promise<PurchaseResult> {
    if (!canUseRevenueCat()) return 'unavailable';
    if (!state.currentPackage) return 'unavailable';

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'unavailable';

    setState((current) => ({ ...current, isPurchasing: true }));

    try {
      const result = await purchaseRevenueCatPackage(user.id, state.currentPackage);
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

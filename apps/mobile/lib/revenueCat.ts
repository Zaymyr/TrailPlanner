import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesError,
  PurchasesOfferings,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? '';
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? '';
const REVENUECAT_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() ?? '';

type RevenueCatModule = typeof import('react-native-purchases/dist/purchases');

let purchasesModulePromise: Promise<RevenueCatModule | null> | null = null;
let purchasesConfigured = false;
let configuredAppUserId: string | null = null;

const REVENUECAT_UNAVAILABLE_ERROR_CODES = new Set([
  '2', // STORE_PROBLEM_ERROR
  '3', // PURCHASE_NOT_ALLOWED_ERROR
  '4', // PURCHASE_INVALID_ERROR
  '5', // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  '11', // INVALID_CREDENTIALS_ERROR
  '17', // INVALID_APPLE_SUBSCRIPTION_KEY_ERROR
  '23', // CONFIGURATION_ERROR
  '24', // UNSUPPORTED_ERROR
  '32', // PRODUCT_REQUEST_TIMED_OUT_ERROR
  '33', // API_ENDPOINT_BLOCKED
  '35', // OFFLINE_CONNECTION_ERROR
]);

function getRevenueCatApiKey() {
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  return '';
}

export function canUseRevenueCat() {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === 'storeClient') return false;
  return Boolean(getRevenueCatApiKey());
}

export function getRevenueCatEntitlementId() {
  return REVENUECAT_ENTITLEMENT_ID || null;
}

async function loadRevenueCatModule(): Promise<RevenueCatModule | null> {
  if (!canUseRevenueCat()) return null;

  if (!purchasesModulePromise) {
    purchasesModulePromise = import('react-native-purchases/dist/purchases').catch((error) => {
      console.warn('RevenueCat module unavailable in this build.', error);
      return null;
    });
  }

  return purchasesModulePromise;
}

async function ensureRevenueCatConfigured(userId: string) {
  const revenueCatModule = await loadRevenueCatModule();
  if (!revenueCatModule) return null;

  const Purchases = revenueCatModule.default;

  if (!purchasesConfigured) {
    Purchases.configure({
      apiKey: getRevenueCatApiKey(),
      appUserID: userId,
    });
    purchasesConfigured = true;
    configuredAppUserId = userId;
    return Purchases;
  }

  if (configuredAppUserId !== userId) {
    await Purchases.logIn(userId);
    configuredAppUserId = userId;
  }

  return Purchases;
}

export function getRevenueCatPremiumEntitlement(customerInfo: CustomerInfo | null | undefined) {
  const activeEntitlements = customerInfo?.entitlements.active ?? {};

  if (REVENUECAT_ENTITLEMENT_ID) {
    return activeEntitlements[REVENUECAT_ENTITLEMENT_ID] ?? null;
  }

  return Object.values(activeEntitlements)[0] ?? null;
}

export function hasRevenueCatPremiumEntitlement(customerInfo: CustomerInfo | null | undefined) {
  return Boolean(getRevenueCatPremiumEntitlement(customerInfo)?.isActive);
}

export function getRevenueCatPremiumExpiration(customerInfo: CustomerInfo | null | undefined) {
  const entitlement = getRevenueCatPremiumEntitlement(customerInfo);
  return entitlement?.expirationDate ?? null;
}

export function pickRevenueCatPrimaryPackage(offering: PurchasesOffering | null | undefined) {
  if (!offering) return null;

  return (
    offering.monthly ??
    offering.annual ??
    offering.threeMonth ??
    offering.sixMonth ??
    offering.twoMonth ??
    offering.weekly ??
    offering.lifetime ??
    offering.availablePackages[0] ??
    null
  );
}

function pickRevenueCatFallbackOffering(offerings: PurchasesOfferings | null | undefined) {
  if (!offerings) return null;

  if (offerings.current) {
    return offerings.current;
  }

  return (
    Object.values(offerings.all).find((offering) => offering.availablePackages.length > 0) ?? null
  );
}

export async function getRevenueCatCustomerInfo(userId: string) {
  const Purchases = await ensureRevenueCatConfigured(userId);
  if (!Purchases) return null;
  return Purchases.getCustomerInfo();
}

export async function getRevenueCatCurrentOffering(userId: string) {
  const Purchases = await ensureRevenueCatConfigured(userId);
  if (!Purchases) return null;
  const offerings = await Purchases.getOfferings();
  return pickRevenueCatFallbackOffering(offerings);
}

export async function purchaseRevenueCatPackage(userId: string, selectedPackage: PurchasesPackage) {
  const Purchases = await ensureRevenueCatConfigured(userId);
  if (!Purchases) return null;
  return Purchases.purchasePackage(selectedPackage);
}

export async function restoreRevenueCatPurchases(userId: string) {
  const Purchases = await ensureRevenueCatConfigured(userId);
  if (!Purchases) return null;
  return Purchases.restorePurchases();
}

export async function addRevenueCatCustomerInfoListener(
  userId: string,
  listener: CustomerInfoUpdateListener
) {
  const Purchases = await ensureRevenueCatConfigured(userId);
  if (!Purchases) return null;

  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export function isRevenueCatPurchaseCancelled(error: unknown) {
  const typedError = error as PurchasesError | null;
  return typedError?.userCancelled === true || typedError?.code === '1';
}

export function isRevenueCatPurchaseUnavailable(error: unknown) {
  const typedError = error as PurchasesError | null;
  return Boolean(typedError?.code && REVENUECAT_UNAVAILABLE_ERROR_CODES.has(String(typedError.code)));
}

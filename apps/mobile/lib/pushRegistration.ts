import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = 'trailplanner.pushToken';
const LOCALE_STORAGE_KEY = 'trailplanner.locale';
const normalizeBaseUrl = (value: string | undefined) => (value?.trim() ?? '').replace(/\/+$/, '');
const SUPABASE_FUNCTIONS_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

type SyncPushDeviceRegistrationInput = {
  accessToken?: string | null;
  locale?: 'fr' | 'en';
  requestIfNeeded?: boolean;
};

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function getAppVersion() {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null;
}

function resolveDeviceLocale(): 'fr' | 'en' {
  try {
    const lang = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    if (lang.startsWith('fr')) return 'fr';
  } catch {
    // ignore
  }

  return 'en';
}

async function resolvePushRegistrationContext(input: SyncPushDeviceRegistrationInput) {
  const providedAccessToken = input.accessToken ?? null;
  const providedLocale = input.locale;

  if (providedAccessToken && providedLocale) {
    return { accessToken: providedAccessToken, locale: providedLocale };
  }

  if (!providedAccessToken && !supabase?.auth?.getSession) {
    return {
      accessToken: null,
      locale: providedLocale ?? resolveDeviceLocale(),
    };
  }

  const [{ data: sessionData }, storedLocale] = await Promise.all([
    providedAccessToken ? Promise.resolve({ data: { session: null } }) : supabase.auth.getSession(),
    providedLocale ? Promise.resolve(null) : AsyncStorage.getItem(LOCALE_STORAGE_KEY).catch(() => null),
  ]);

  return {
    accessToken: providedAccessToken ?? sessionData.session?.access_token ?? null,
    locale:
      providedLocale ??
      (storedLocale === 'fr' || storedLocale === 'en' ? storedLocale : resolveDeviceLocale()),
  };
}

async function postPushDeviceRegistration(
  accessToken: string,
  payload: {
    expoPushToken: string;
    locale: 'fr' | 'en';
    notificationsEnabled: boolean;
  },
) {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
  if (!platform) {
    return false;
  }

  if (!SUPABASE_FUNCTIONS_BASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase function configuration is missing. Push registration skipped.');
    return false;
  }

  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_BASE_URL}/functions/v1/push-register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expoPushToken: payload.expoPushToken,
        platform,
        locale: payload.locale,
        appVersion: getAppVersion(),
        notificationsEnabled: payload.notificationsEnabled,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn('Push registration function returned an error.', response.status, errorText);
    }

    return response.ok;
  } catch (error) {
    console.warn('Unable to sync push registration with the server.', error);
    return false;
  }
}

export async function syncPushDeviceRegistration({
  requestIfNeeded = false,
  ...input
}: SyncPushDeviceRegistrationInput = {}) {
  const { accessToken, locale } = await resolvePushRegistrationContext(input);

  if (!accessToken || !SUPABASE_FUNCTIONS_BASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Expo projectId is missing. Push registration skipped.');
    return null;
  }

  const storedPushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY).catch(() => null);
  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted' && requestIfNeeded) {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    if (storedPushToken) {
      const disabled = await postPushDeviceRegistration(accessToken, {
        expoPushToken: storedPushToken,
        locale,
        notificationsEnabled: false,
      });

      if (disabled) {
        await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY).catch(() => undefined);
      }
    }

    return null;
  }

  try {
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const synced = await postPushDeviceRegistration(accessToken, {
      expoPushToken,
      locale,
      notificationsEnabled: true,
    });

    if (synced) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken).catch(() => undefined);
    }

    return synced ? expoPushToken : null;
  } catch (error) {
    console.warn('Unable to fetch Expo push token.', error);
    return null;
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = 'trailplanner.pushToken';
const LOCALE_STORAGE_KEY = 'trailplanner.locale';
const PUSH_REGISTRATION_STATUS_STORAGE_KEY = 'trailplanner.pushRegistrationStatus';
const ANDROID_PUSH_CHANNEL_ID = 'default';

type SyncPushDeviceRegistrationInput = {
  accessToken?: string | null;
  locale?: 'fr' | 'en';
  requestIfNeeded?: boolean;
};

type PushRegistrationStatus = {
  recordedAt: string;
  reason: string;
  details?: Record<string, unknown>;
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

async function recordPushRegistrationStatus(
  reason: string,
  details?: Record<string, unknown>,
) {
  const payload: PushRegistrationStatus = {
    recordedAt: new Date().toISOString(),
    reason,
    details,
  };

  await AsyncStorage.setItem(PUSH_REGISTRATION_STATUS_STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined);
}

export async function getLastPushRegistrationStatus() {
  const raw = await AsyncStorage.getItem(PUSH_REGISTRATION_STATUS_STORAGE_KEY).catch(() => null);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PushRegistrationStatus;
  } catch {
    return null;
  }
}

async function ensureAndroidPushChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_PUSH_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2D5016',
  });
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

  if (!providedAccessToken && !supabase?.auth?.getSession) {
    return {
      accessToken: null,
      authorizationHeader: null,
      locale: providedLocale ?? resolveDeviceLocale(),
    };
  }

  const [{ data: sessionData }, storedLocale] = await Promise.all([
    providedAccessToken ? Promise.resolve({ data: { session: null } }) : supabase.auth.getSession(),
    providedLocale ? Promise.resolve(null) : AsyncStorage.getItem(LOCALE_STORAGE_KEY).catch(() => null),
  ]);

  return {
    accessToken: sessionData.session?.access_token ?? providedAccessToken,
    authorizationHeader:
      sessionData.session?.access_token == null && providedAccessToken
        ? `Bearer ${providedAccessToken}`
        : null,
    locale:
      providedLocale ??
      (storedLocale === 'fr' || storedLocale === 'en' ? storedLocale : resolveDeviceLocale()),
  };
}

async function postPushDeviceRegistration(
  authorizationHeader: string | null,
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

  if (!supabase?.functions?.invoke) {
    console.warn('Supabase functions client is unavailable. Push registration skipped.');
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke('push-register', {
      body: {
        expoPushToken: payload.expoPushToken,
        platform,
        locale: payload.locale,
        appVersion: getAppVersion(),
        notificationsEnabled: payload.notificationsEnabled,
      },
      headers: authorizationHeader ? { Authorization: authorizationHeader } : undefined,
    });

    if (error) {
      console.warn('Push registration function returned an error.', error);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Unable to sync push registration with the server.', error);
    return false;
  }
}

export async function syncPushDeviceRegistration({
  requestIfNeeded = false,
  ...input
}: SyncPushDeviceRegistrationInput = {}) {
  const { accessToken, authorizationHeader, locale } = await resolvePushRegistrationContext(input);

  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    const details = {
      appOwnership: Constants.appOwnership,
      executionEnvironment: Constants.executionEnvironment,
      platform: Platform.OS,
    };
    console.warn(
      'Push registration skipped: Expo Go on Android does not support remote push notifications. Use a development build on a physical device.',
      details,
    );
    await recordPushRegistrationStatus('unsupported-expo-go-android', details);
    return null;
  }

  if (!accessToken) {
    console.warn('Push registration skipped: no authenticated Supabase session available.');
    await recordPushRegistrationStatus('missing-session');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Expo projectId is missing. Push registration skipped.');
    await recordPushRegistrationStatus('missing-project-id');
    return null;
  }

  await ensureAndroidPushChannel().catch((error) => {
    console.warn('Unable to configure Android notification channel before push registration.', error);
  });

  const storedPushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY).catch(() => null);
  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted' && requestIfNeeded) {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push registration skipped: notifications permission is not granted.', {
      requestIfNeeded,
      finalStatus,
    });
    await recordPushRegistrationStatus('permission-not-granted', {
      requestIfNeeded,
      finalStatus,
    });

    if (storedPushToken) {
      const disabled = await postPushDeviceRegistration(authorizationHeader, {
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

    const synced = await postPushDeviceRegistration(authorizationHeader, {
      expoPushToken,
      locale,
      notificationsEnabled: true,
    });

    if (synced) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken).catch(() => undefined);
      await recordPushRegistrationStatus('success', {
        platform: Platform.OS,
        executionEnvironment: Constants.executionEnvironment,
      });
    } else {
      console.warn('Push registration reached the network step, but the backend registration failed.');
      await recordPushRegistrationStatus('backend-registration-failed');
    }

    return synced ? expoPushToken : null;
  } catch (error) {
    console.warn('Unable to fetch Expo push token.', error);
    await recordPushRegistrationStatus('expo-push-token-failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
      executionEnvironment: Constants.executionEnvironment,
      platform: Platform.OS,
    });
    return null;
  }
}

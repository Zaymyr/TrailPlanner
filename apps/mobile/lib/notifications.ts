import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';

export type NotificationsModule = typeof ExpoNotifications;

export function isExpoGoAndroidNotificationsUnsupported() {
  return (
    Platform.OS === 'android' &&
    (Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.appOwnership === 'expo')
  );
}

export async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (isExpoGoAndroidNotificationsUnsupported()) {
    return null;
  }

  try {
    return await import('expo-notifications');
  } catch (error) {
    console.warn('expo-notifications is unavailable in this runtime.', error);
    return null;
  }
}

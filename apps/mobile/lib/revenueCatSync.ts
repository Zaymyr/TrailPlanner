import { Platform } from 'react-native';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim() ?? '';

export type RevenueCatProviderHint = 'google' | 'apple';

type RevenueCatSyncResponse = {
  result?: {
    currentPeriodEnd?: string | null;
    provider?: RevenueCatProviderHint | null;
    status?: 'active' | 'trialing' | 'expired' | null;
    synced?: boolean;
  };
};

export function getCurrentRevenueCatProviderHint(): RevenueCatProviderHint | null {
  if (Platform.OS === 'android') return 'google';
  if (Platform.OS === 'ios') return 'apple';
  return null;
}

export async function syncRevenueCatSubscriptionToServer(
  accessToken: string | null,
  providerHint: RevenueCatProviderHint | null = getCurrentRevenueCatProviderHint()
) {
  if (!WEB_URL || !accessToken) return null;

  try {
    const response = await fetch(`${WEB_URL}/api/revenuecat/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerHint,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as RevenueCatSyncResponse | null;
    return payload?.result ?? null;
  } catch (error) {
    console.warn('Unable to sync RevenueCat subscription to server.', error);
    return null;
  }
}

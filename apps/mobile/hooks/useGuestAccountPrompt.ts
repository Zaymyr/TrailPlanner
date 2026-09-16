import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { useI18n } from '../lib/i18n';
import { captureAnalyticsEvent } from '../lib/posthog';

export type GuestAccountPromptSource = 'plan_limit' | 'race_favorite';

export function useGuestAccountPrompt() {
  const router = useRouter();
  const { t } = useI18n();

  return useCallback(
    ({ source, title, message }: { source: GuestAccountPromptSource; title: string; message: string }) => {
      captureAnalyticsEvent('guest account prompt viewed', { source });
      Alert.alert(title, message, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.auth.loginCta,
          onPress: () => {
            captureAnalyticsEvent('guest account conversion started', {
              source,
              method: 'sign_in',
            });
            router.push('/(auth)/login');
          },
        },
        {
          text: t.auth.signUpCta,
          onPress: () => {
            captureAnalyticsEvent('guest account conversion started', {
              source,
              method: 'create_account',
            });
            router.push('/(auth)/signup');
          },
        },
      ]);
    },
    [router, t.auth.loginCta, t.auth.signUpCta, t.common.cancel],
  );
}

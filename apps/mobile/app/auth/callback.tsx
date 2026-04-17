import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Session } from '@supabase/supabase-js';
import { finalizePendingAccountConversion } from '../../lib/accountConversion';
import { getPostAuthRoute } from '../../lib/onboardingGate';
import { supabase } from '../../lib/supabase';
import { ensureTrialStatusForSession } from '../../lib/trial';

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
    async function routeAfterLogin(session: Session | null) {
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }

      const finalizationResult = await finalizePendingAccountConversion(session);
      if (!finalizationResult.completed && finalizationResult.reason === 'password-update-failed') {
        console.warn('Pending account conversion could not finalize password automatically.', finalizationResult.error);
      }

      await ensureTrialStatusForSession(session);
      router.replace(await getPostAuthRoute(session));
    }

    async function handleCallback() {
      // On Android the OS may deliver the deep link directly to the app,
      // bypassing openAuthSessionAsync. Parse tokens here so those cases work.
      if (url) {
        const fragment = url.includes('#') ? url.split('#')[1] : '';
        const query = url.includes('?') ? url.split('?')[1] : '';
        const hashParams = new URLSearchParams(fragment);
        const queryParams = new URLSearchParams(query);

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const code = queryParams.get('code');

        if (accessToken && refreshToken) {
          const { data } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          await routeAfterLogin(data.session);
          return;
        }

        if (code) {
          const { data } = await supabase.auth.exchangeCodeForSession(code);
          await routeAfterLogin(data.session);
          return;
        }
      }

      // Fallback: session may already be set (iOS path via openAuthSessionAsync)
      const { data }: { data: { session: Session | null } } =
        await supabase.auth.getSession();
      await routeAfterLogin(data.session);
    }

    handleCallback();
  }, [url]);

  return null;
}

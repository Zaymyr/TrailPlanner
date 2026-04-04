import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
    async function routeAfterLogin(session: Session | null) {
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('water_bag_liters')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile?.water_bag_liters == null) {
        router.replace('/(app)/onboarding');
      } else {
        router.replace('/(app)/plans');
      }
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

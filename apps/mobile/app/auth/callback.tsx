import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
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
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          router.replace('/(app)/plans');
          return;
        }

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          router.replace('/(app)/plans');
          return;
        }
      }

      // Fallback: session may already be set (iOS path via openAuthSessionAsync)
      const { data }: { data: { session: Session | null } } =
        await supabase.auth.getSession();
      if (data.session) router.replace('/(app)/plans');
      else router.replace('/(auth)/login');
    }

    handleCallback();
  }, [url]);

  return null;
}

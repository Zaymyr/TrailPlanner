import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { respondToAlert } from '../lib/raceAlertService';
import { SNOOZE_OPTIONS_MINUTES } from '@trailplanner/shared';

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s),
    );

    return () => subscription.unsubscribe();
  }, []);

  // Route guard
  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)/plans');
    }
  }, [session, ready, segments]);

  // Notification response listener
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const alertId =
          response.notification.request.content.data?.alertId as
            | string
            | undefined;
        if (!alertId) return;

        const action = response.actionIdentifier;

        if (action === 'confirm') {
          await respondToAlert(alertId, 'confirmed');
        } else if (action === 'skip') {
          await respondToAlert(alertId, 'skipped');
        } else if (action.startsWith('snooze_')) {
          const minutes = parseInt(action.replace('snooze_', ''), 10);
          if (SNOOZE_OPTIONS_MINUTES.includes(minutes as 5 | 10 | 15)) {
            await respondToAlert(alertId, 'snoozed', minutes);
          }
        }
      },
    );

    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      />
    </>
  );
}

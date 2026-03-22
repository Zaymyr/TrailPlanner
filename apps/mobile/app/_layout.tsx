import { Component, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { respondToAlert } from '../lib/raceAlertService';
import { SNOOZE_OPTIONS_MINUTES } from '../lib/shared';

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text style={{ color: '#f87171', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Auth listener
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        setReady(true);
      }).catch((err) => {
        console.error('Failed to get session:', err);
        setReady(true);
      });

      const { data } = supabase.auth.onAuthStateChange(
        (_event, s) => setSession(s),
      );
      subscription = data.subscription;
    } catch (err) {
      console.error('Auth listener setup failed:', err);
      setReady(true);
    }

    return () => {
      try {
        subscription?.unsubscribe();
      } catch (err) {
        console.error('Failed to unsubscribe auth listener:', err);
      }
    };
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
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      />
    </ErrorBoundary>
  );
}

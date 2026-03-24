import { Text, View, ScrollView } from 'react-native';

// Global error handlers - must be first
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args);
};

if (typeof ErrorUtils !== 'undefined') {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('GLOBAL ERROR:', error?.message, error?.stack);
  });
}

import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase, supabaseInitError } from '../lib/supabase';
import { respondToAlert } from '../lib/raceAlertService';

const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null };
  componentDidCatch(error: Error) {
    this.setState({ error: error.message + '\n' + error.stack });
  }
  render() {
    if (this.state.error) {
      const { ScrollView, Text } = require('react-native');
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>🔴 Crash</Text>
          <Text style={{ color: '#f1f5f9', fontSize: 11 }}>{this.state.error}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  if (supabaseInitError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 60 }}>
        <Text style={{ color: '#ef4444' }}>Supabase Error: {supabaseInitError}</Text>
      </View>
    );
  }

  // Auth listener
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
        setSession(s);
        setReady(true);
      }).catch((err: Error) => {
        console.error('Failed to get session:', err);
        setReady(true);
      });

      const { data } = supabase.auth.onAuthStateChange(
        (_event: any, s: Session | null) => setSession(s),
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
    const inOnboarding = segments[1] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Check if onboarding needed (water_bag_liters IS NULL)
      (async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('water_bag_liters')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data === null || data?.water_bag_liters == null) {
          router.replace('/(app)/onboarding');
        } else {
          router.replace('/(app)/plans');
        }
      })();
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
      >
        <Stack.Screen name="(app)" options={{ title: 'Pace Yourself', headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </ErrorBoundary>
  );
}

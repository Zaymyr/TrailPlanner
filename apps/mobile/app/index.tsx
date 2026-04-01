import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      const session = sessionData?.session;
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('water_bag_liters')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.water_bag_liters == null) {
        router.replace('/(app)/onboarding');
      } else {
        router.replace('/(app)/plans');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
      }}
    >
      <ActivityIndicator color={Colors.brandPrimary} size="large" />
    </View>
  );
}

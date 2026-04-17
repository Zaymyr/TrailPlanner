import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ensureAppSession } from '../lib/appSession';
import { getPostAuthRoute } from '../lib/onboardingGate';
import { Colors } from '../constants/colors';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await ensureAppSession();
      if (cancelled) return;

      if (!session) {
        router.replace('/(auth)/login');
        return;
      }

      if (cancelled) return;
      router.replace(await getPostAuthRoute(session));
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

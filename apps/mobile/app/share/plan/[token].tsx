import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../../components/themed/Button';
import { Card } from '../../../components/themed/Card';
import { ErrorState } from '../../../components/themed/ErrorState';
import { LoadingState } from '../../../components/themed/LoadingState';
import { Screen } from '../../../components/themed/Screen';
import { Text } from '../../../components/themed/Text';
import { Colors } from '../../../constants/colors';
import { followPlanShare, previewPlanShare } from '../../../lib/followedPlans';
import { useI18n } from '../../../lib/i18n';
import { setPendingDeepLink } from '../../../lib/pendingDeepLink';
import { captureAnalyticsEvent } from '../../../lib/posthog';
import { supabase } from '../../../lib/supabase';

type Preview = Awaited<ReturnType<typeof previewPlanShare>>;

export default function PlanShareFollowScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    const signedIn = Boolean(data.session && !data.session.user.is_anonymous);
    setAuthenticated(signedIn);
    if (!signedIn) {
      setLoading(false);
      return;
    }
    try {
      setPreview(await previewPlanShare(token ?? ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.planFollow.loadingError);
    } finally {
      setLoading(false);
    }
  }, [t.planFollow.loadingError, token]);

  useEffect(() => { void load(); }, [load]);

  const signIn = () => {
    setPendingDeepLink(`/share/plan/${token}`);
    router.push('/(auth)/login');
  };

  const follow = async () => {
    if (!token || following) return;
    setFollowing(true);
    try {
      const result = await followPlanShare(token);
      captureAnalyticsEvent('plan crew followed', { source: 'deep_link' });
      router.replace({ pathname: '/(app)/plan/followed/[id]', params: { id: result.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.planFollow.loadingError);
    } finally {
      setFollowing(false);
    }
  };

  if (loading) return <Screen><LoadingState label={t.common.loading} /></Screen>;
  if (error && authenticated && !preview) {
    return <Screen><ErrorState title={error} retryLabel={t.common.retry} onRetry={() => void load()} /></Screen>;
  }

  return (
    <Screen padded style={[styles.screen, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" size="2xl" weight="bold">
          {preview ? t.planFollow.followTitle.replace('{name}', preview.planName) : t.planFollow.followCta}
        </Text>
        <Card surface="cream" style={styles.card}>
          {preview ? (
            <>
              <Text size="xl" weight="bold">{preview.planName}</Text>
              <View style={styles.metrics}>
                <Text tone="secondary">{t.planFollow.distance} · {preview.distanceKm.toFixed(1)} km</Text>
                <Text tone="secondary">{t.planFollow.elevation} · {Math.round(preview.elevationGainM)} m</Text>
                <Text tone="secondary">{t.planFollow.checkpoints} · {preview.checkpointCount}</Text>
              </View>
            </>
          ) : <Text tone="secondary">{t.planFollow.emptyBody}</Text>}
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button fullWidth isLoading={following} onPress={authenticated ? () => void follow() : signIn}>
          {authenticated ? t.planFollow.followCta : t.planFollow.loginCta}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  content: { gap: 20 },
  card: { gap: 12 },
  metrics: { gap: 6 },
  error: { color: Colors.danger },
});

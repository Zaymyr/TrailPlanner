import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '../themed/Card';
import { ErrorState } from '../themed/ErrorState';
import { LoadingState } from '../themed/LoadingState';
import { Text } from '../themed/Text';
import { Button } from '../themed/Button';
import { useFollowedPlans } from '../../hooks/useFollowedPlans';
import type { MobileTranslations } from '../../locales/types';

type Props = { contentTopInset: number; t: MobileTranslations; onScroll: (event: any) => void };

export function FollowedPlansList({ contentTopInset, t, onScroll }: Props) {
  const router = useRouter();
  const followed = useFollowedPlans();
  if (followed.loading) return <LoadingState label={t.common.loading} style={{ paddingTop: contentTopInset }} />;
  if (followed.error) return <ErrorState title={t.planFollow.loadingError} retryLabel={t.common.retry} onRetry={() => void followed.refresh()} style={{ paddingTop: contentTopInset }} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentTopInset }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={followed.refreshing} onRefresh={() => void followed.refresh(true)} />}
    >
      {followed.follows.length === 0 ? (
        <Card surface="cream" style={styles.empty}>
          <Text size="xl" weight="bold">{t.planFollow.emptyTitle}</Text>
          <Text tone="secondary">{t.planFollow.emptyBody}</Text>
        </Card>
      ) : followed.follows.map((follow) => (
        <Card key={follow.id} surface={follow.status === 'active' ? 'white' : 'sandLight'} style={styles.card}>
          <View style={styles.copy}>
            <Text size="lg" weight="bold">{follow.nickname || follow.planName}</Text>
            {follow.nickname ? <Text tone="secondary">{follow.planName}</Text> : null}
            {follow.status === 'active' ? (
              <View style={styles.metrics}>
                <Text tone="brand" weight="semibold">{follow.distanceKm.toFixed(1)} km</Text>
                <Text tone="brand" weight="semibold">{Math.round(follow.elevationGainM)} m D+</Text>
              </View>
            ) : <Text tone="secondary">{t.planFollow.unavailable}</Text>}
          </View>
          <Button disabled={follow.status !== 'active'} onPress={() => router.push({ pathname: '/(app)/plan/followed/[id]', params: { id: follow.id } })}>
            {t.planFollow.assistantTab}
          </Button>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingHorizontal: 16, paddingBottom: 32 },
  empty: { gap: 8 },
  card: { gap: 14 },
  copy: { gap: 5 },
  metrics: { flexDirection: 'row', gap: 14 },
});

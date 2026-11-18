import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '../themed/Card';
import { ErrorState } from '../themed/ErrorState';
import { LoadingState } from '../themed/LoadingState';
import { Text } from '../themed/Text';
import { Button } from '../themed/Button';
import { useFollowedPlans } from '../../hooks/useFollowedPlans';
import type { MobileTranslations } from '../../locales/types';
import { updateFollowedPlan } from '../../lib/followedPlans';
import { useI18n } from '../../lib/i18n';
import { formatOfflineSavedAt } from '../../lib/offlineCacheFormat';
import { TapeAlertBanner } from '../racebook/TapeAlertBanner';

type Props = { contentTopInset: number; t: MobileTranslations; onScroll: (event: any) => void };

export function FollowedPlansList({ contentTopInset, t, onScroll }: Props) {
  const router = useRouter();
  const { locale } = useI18n();
  const followed = useFollowedPlans();
  if (followed.loading) return <LoadingState label={t.common.loading} style={{ paddingTop: contentTopInset }} />;
  if (followed.error) return <ErrorState title={t.planFollow.loadingError} retryLabel={t.common.retry} onRetry={() => void followed.refresh()} style={{ paddingTop: contentTopInset }} />;

  const active = followed.follows.filter((follow) => !follow.archivedAt);
  const completed = followed.follows.filter((follow) => Boolean(follow.archivedAt));
  const renderFollow = (follow: (typeof followed.follows)[number], completedSection = false) => (
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
      {completedSection ? <Button variant="ghost" onPress={() => void updateFollowedPlan(follow.id, { archived: false }).then(() => followed.refresh())}>{t.planFollow.unarchive}</Button> : null}
    </Card>
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentTopInset }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={followed.refreshing} onRefresh={() => void followed.refresh(true)} />}
    >
      {followed.offlineSavedAt ? (
        <TapeAlertBanner
          icon="cloud-offline-outline"
          message={t.common.offlineCopy.replace('{time}', formatOfflineSavedAt(followed.offlineSavedAt, locale))}
          title={t.common.offlineTitle}
          variationKey="followed-plans-offline"
        />
      ) : null}
      {followed.follows.length === 0 ? (
        <Card surface="cream" style={styles.empty}>
          <Text size="xl" weight="bold">{t.planFollow.emptyTitle}</Text>
          <Text tone="secondary">{t.planFollow.emptyBody}</Text>
        </Card>
      ) : <>
        {active.map((follow) => renderFollow(follow))}
        {completed.length > 0 ? <Text size="xl" weight="bold">Terminés</Text> : null}
        {completed.map((follow) => renderFollow(follow, true))}
      </>}
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

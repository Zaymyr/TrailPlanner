import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildPlanShareTimeline,
  isPlanShareCrewCheckpoint,
  isPlanShareTrackableCheckpoint,
  normalizePlanSharePassages,
  parsePlanShareClock,
  resolvePlanShareClockNearPlanned,
} from '@trailplanner/shared';

import { Colors } from '../../../../constants/colors';
import { Button } from '../../../../components/themed/Button';
import { Card } from '../../../../components/themed/Card';
import { ErrorState } from '../../../../components/themed/ErrorState';
import { LoadingState } from '../../../../components/themed/LoadingState';
import { Screen } from '../../../../components/themed/Screen';
import { Text } from '../../../../components/themed/Text';
import {
  getFollowedPlan,
  unfollowPlan,
  updateFollowedPlan,
  updateFollowedPlanCrewState,
  type FollowedPlan,
} from '../../../../lib/followedPlans';
import { useI18n } from '../../../../lib/i18n';
import { captureAnalyticsEvent } from '../../../../lib/posthog';

function formatClock(totalMinutes: number) {
  const rounded = Math.round(totalMinutes);
  const day = Math.floor(rounded / 1440);
  const minute = ((rounded % 1440) + 1440) % 1440;
  const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return day > 0 ? `${clock} J+${day}` : clock;
}

function waterInstruction(checkpoint: any, liters: number, locale: 'fr' | 'en') {
  if (checkpoint.waterState === 'full') return locale === 'fr' ? `Poche pleine ${liters} L` : `Full bladder ${liters} L`;
  if (checkpoint.waterState === 'refill') return locale === 'fr' ? 'Remplir la poche' : 'Refill the bladder';
  if (checkpoint.waterState === 'finish') return locale === 'fr' ? 'Arrivée' : 'Finish';
  return locale === 'fr' ? "Pas de recharge d'eau" : 'No water refill';
}

export default function FollowedPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useI18n();
  const [follow, setFollow] = useState<FollowedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  const load = useCallback(async (pull = false) => {
    if (!id) return;
    if (pull) setRefreshing(true);
    setError(null);
    try {
      const next = await getFollowedPlan(id);
      setFollow(next);
      setNickname(next.nickname ?? '');
      setDepartureTime(next.departureTime ?? '');
    } catch (cause) {
      const status = (cause as Error & { status?: number })?.status;
      setError(status === 410 ? t.planFollow.unavailable : t.planFollow.loadingError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, t.planFollow.loadingError, t.planFollow.unavailable]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const checkpoints = useMemo(() => follow?.snapshot?.checkpoints ?? [], [follow?.snapshot?.checkpoints]);
  const passages = useMemo(() => follow?.crewState?.passages ?? [], [follow?.crewState?.passages]);
  const timeline = useMemo(
    () => buildPlanShareTimeline(checkpoints, passages, departureTime),
    [checkpoints, departureTime, passages],
  );

  const persist = async (nextPassages = passages) => {
    if (!id || parsePlanShareClock(departureTime) === null) return;
    setSaving(true);
    try {
      const updated = await updateFollowedPlanCrewState(id, departureTime, { passages: normalizePlanSharePassages(nextPassages, checkpoints) });
      setFollow((current) => current ? { ...current, crewState: updated.crewState, departureTime: updated.departureTime } : current);
      setDepartureTime(updated.departureTime ?? '');
    } catch {
      Alert.alert(t.common.error, t.planFollow.loadingError);
    } finally {
      setSaving(false);
    }
  };

  const confirmPassage = async (checkpoint: any) => {
    const startMinutes = parsePlanShareClock(departureTime);
    if (startMinutes === null) return;
    const now = new Date();
    const actualAbsolute = resolvePlanShareClockNearPlanned(
      now.getHours() * 60 + now.getMinutes(),
      startMinutes + checkpoint.arrivalMinute,
    );
    const next = [
      ...passages.filter((passage) => passage.checkpointIndex !== checkpoint.index),
      { checkpointIndex: checkpoint.index, actualMinute: Math.max(0, Math.round(actualAbsolute - startMinutes)), confirmedAt: now.toISOString() },
    ];
    await persist(next);
    captureAnalyticsEvent('plan crew passage confirmed in app', { source: 'followed_plan' });
  };

  const saveNickname = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateFollowedPlan(id, { nickname: nickname.trim() || null });
      setFollow((current) => current ? { ...current, nickname: nickname.trim() || null } : current);
    } finally { setSaving(false); }
  };

  const toggleArchive = async () => {
    if (!id || !follow) return;
    const archived = !follow.archivedAt;
    await updateFollowedPlan(id, { archived });
    setFollow({ ...follow, archivedAt: archived ? new Date().toISOString() : null });
  };

  const confirmUnfollow = () => Alert.alert(t.planFollow.confirmUnfollowTitle, t.planFollow.confirmUnfollowBody, [
    { text: t.common.cancel, style: 'cancel' },
    { text: t.planFollow.unfollow, style: 'destructive', onPress: () => void (async () => {
      if (!id) return;
      await unfollowPlan(id);
      captureAnalyticsEvent('plan crew unfollowed', { source: 'followed_plan' });
      router.replace('/(app)/plans');
    })() },
  ]);

  if (loading) return <Screen><LoadingState label={t.common.loading} /></Screen>;
  if (error || !follow?.snapshot) return <Screen><ErrorState title={error ?? t.planFollow.unavailable} retryLabel={t.common.retry} onRetry={() => void load()} /></Screen>;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <Card surface="cream" style={styles.hero}>
          <Text accessibilityRole="header" size="2xl" weight="bold">{follow.nickname || follow.planName}</Text>
          {follow.nickname ? <Text tone="secondary">{follow.planName}</Text> : null}
          <View style={styles.metrics}>
            <Text tone="brand" weight="bold">{follow.distanceKm.toFixed(1)} km</Text>
            <Text tone="brand" weight="bold">{Math.round(follow.elevationGainM)} m D+</Text>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text weight="bold">{t.planFollow.departure}</Text>
          <TextInput
            accessibilityLabel={t.planFollow.departure}
            value={departureTime}
            onChangeText={setDepartureTime}
            placeholder="HH:mm"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
          <Button disabled={parsePlanShareClock(departureTime) === null} isLoading={saving} onPress={() => void persist()}>{t.common.save}</Button>
          <Button variant="ghost" disabled={passages.length === 0 || saving} onPress={() => void persist([])}>{t.planFollow.reset}</Button>
        </Card>

        <Card surface="cream" style={styles.section}>
          <Text tone="brand" size="xs" weight="bold">{t.planFollow.nextPoint}</Text>
          <Text size="xl" weight="bold">{timeline.nextCheckpoint?.name ?? t.planFollow.noMorePoints}</Text>
          {timeline.nextAbsolute !== null ? <Text tone="brand" size="xl" weight="bold">{formatClock(timeline.nextAbsolute)}</Text> : null}
        </Card>

        <View style={styles.timeline}>
          {checkpoints.map((checkpoint: any) => {
            const crew = isPlanShareCrewCheckpoint(checkpoint);
            const muted = checkpoint.assistanceState === 'unavailable';
            const absolute = timeline.getCheckpointAbsolute(checkpoint);
            const confirmed = timeline.passagesByIndex.has(checkpoint.index);
            return (
              <Card key={`${checkpoint.index}-${checkpoint.name}`} surface={crew ? 'cream' : 'white'} style={[styles.checkpoint, muted && styles.muted]}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text size="lg" weight="bold">{checkpoint.name}</Text>
                    <Text tone="secondary">{checkpoint.distanceKm.toFixed(1)} km</Text>
                  </View>
                  {absolute !== null ? <Text tone="brand" weight="bold">{formatClock(absolute)}</Text> : null}
                </View>
                {crew ? (
                  <>
                    <Text tone="secondary">{t.planFollow.water}: {waterInstruction(checkpoint, follow.snapshot.waterBagLiters, locale)}</Text>
                    <Text weight="semibold">{t.planFollow.give}</Text>
                    {checkpoint.supplies?.length ? checkpoint.supplies.map((product: any) => (
                      <Text key={product.productId} tone="secondary">{product.name} ×{product.quantity}</Text>
                    )) : <Text tone="secondary">{t.planFollow.nothingToGive}</Text>}
                  </>
                ) : null}
                {isPlanShareTrackableCheckpoint(checkpoint) && !checkpoint.isStart ? (
                  <Button disabled={saving} variant={confirmed ? 'secondary' : 'primary'} onPress={() => void confirmPassage(checkpoint)}>
                    {t.planFollow.passed}
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </View>

        <Card style={styles.section}>
          <Text weight="bold">{t.planFollow.nickname}</Text>
          <TextInput value={nickname} onChangeText={setNickname} maxLength={60} style={styles.input} placeholderTextColor={Colors.textMuted} />
          <Button variant="secondary" isLoading={saving} onPress={() => void saveNickname()}>{t.common.save}</Button>
          <Button variant="ghost" onPress={() => void toggleArchive()}>{follow.archivedAt ? t.planFollow.unarchive : t.planFollow.archive}</Button>
          <Button variant="ghost" onPress={confirmUnfollow}>{t.planFollow.unfollow}</Button>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 16 },
  hero: { gap: 8 },
  metrics: { flexDirection: 'row', gap: 16 },
  section: { gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface, color: Colors.textPrimary, paddingHorizontal: 14, fontSize: 16 },
  timeline: { gap: 10 },
  checkpoint: { gap: 10 },
  muted: { backgroundColor: Colors.surfaceMuted, opacity: 0.78 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 3 },
});

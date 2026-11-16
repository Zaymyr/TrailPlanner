import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildPlanShareTimeline,
  buildFollowedPreparation,
  buildFollowedSupporterTimeline,
  isPlanShareCrewCheckpoint,
  isPlanShareTrackableCheckpoint,
  normalizePlanSharePassages,
  parsePlanShareClock,
  resolvePlanShareClockNearPlanned,
} from '../../../../lib/followedPlanTimeline';

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

const lastViewKey = (id: string) => `paceyourself.followed-plan-last-view:${id}`;
const preparationKey = (id: string) => `paceyourself.followed-plan-preparation:${id}`;

function directionsUrl(value: { googleMapsUrl?: string | null; latitude?: number | null; longitude?: number | null }) {
  if (value.googleMapsUrl) return value.googleMapsUrl;
  return value.latitude !== null && value.latitude !== undefined && value.longitude !== null && value.longitude !== undefined
    ? `https://www.google.com/maps/dir/?api=1&destination=${value.latitude},${value.longitude}`
    : null;
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
  const [planUpdated, setPlanUpdated] = useState(false);
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [prepared, setPrepared] = useState<Set<string>>(new Set());

  const load = useCallback(async (pull = false) => {
    if (!id) return;
    if (pull) setRefreshing(true);
    setError(null);
    try {
      const next = await getFollowedPlan(id);
      setFollow(next);
      setNickname(next.nickname ?? '');
      setDepartureTime(next.departureTime ?? '');
      const [lastView, storedPreparation] = await Promise.all([
        AsyncStorage.getItem(lastViewKey(id)),
        AsyncStorage.getItem(preparationKey(id)),
      ]);
      const updated = Boolean(next.planUpdatedAt && lastView && Date.parse(next.planUpdatedAt) > Date.parse(lastView));
      setPlanUpdated(updated);
      if (updated) captureAnalyticsEvent('followed plan updated seen', { source: 'followed_plan' });
      if (next.planUpdatedAt) void AsyncStorage.setItem(lastViewKey(id), next.planUpdatedAt);
      try { setPrepared(new Set(JSON.parse(storedPreparation ?? '[]'))); } catch { setPrepared(new Set()); }
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
  const preparation = useMemo(
    () => buildFollowedPreparation(checkpoints, follow?.snapshot?.waterBagLiters ?? 0),
    [checkpoints, follow?.snapshot?.waterBagLiters],
  );
  const supporterTimeline = useMemo(
    () => buildFollowedSupporterTimeline(follow?.raceContext?.supporterPoints ?? [], checkpoints, passages, departureTime),
    [checkpoints, departureTime, follow?.raceContext?.supporterPoints, passages],
  );
  const checkpointContext = useMemo(
    () => new Map(follow?.raceContext?.checkpointContexts.map((context) => [context.checkpointIndex, context]) ?? []),
    [follow?.raceContext?.checkpointContexts],
  );

  const togglePrepared = (key: string) => {
    if (!id) return;
    const next = new Set(prepared);
    if (next.has(key)) next.delete(key); else next.add(key);
    setPrepared(next);
    void AsyncStorage.setItem(preparationKey(id), JSON.stringify([...next]));
  };

  const openDirections = (target: { googleMapsUrl?: string | null; latitude?: number | null; longitude?: number | null }) => {
    const url = directionsUrl(target);
    if (!url) return;
    captureAnalyticsEvent('followed plan directions opened', { source: 'followed_plan' });
    void Linking.openURL(url);
  };

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
          {planUpdated ? <Text tone="brand" weight="bold">{locale === 'fr' ? 'Plan mis à jour' : 'Plan updated'}</Text> : null}
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
          {checkpoints.map((checkpoint: any, checkpointOrder: number) => {
            const crew = isPlanShareCrewCheckpoint(checkpoint);
            const muted = checkpoint.assistanceState === 'unavailable';
            const absolute = timeline.getCheckpointAbsolute(checkpoint);
            const confirmed = timeline.passagesByIndex.has(checkpoint.index);
            const context = checkpointContext.get(checkpoint.index);
            const previousDistance = checkpointOrder > 0 ? checkpoints[checkpointOrder - 1]?.distanceKm ?? -1 : -1;
            const supporterBefore = supporterTimeline.filter((point: any) => point.km > previousDistance && point.km <= checkpoint.distanceKm);
            return (
              <View key={`${checkpoint.index}-${checkpoint.name}`} style={styles.timelineGroup}>
              {supporterBefore.map((point: any) => (
                <Card key={`supporter-${point.id}`} surface="sandLight" style={styles.checkpoint}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text weight="bold">{point.name}</Text>
                      <Text tone="secondary">{point.km.toFixed(1)} km · {point.assistanceAllowed ? (locale === 'fr' ? 'Assister' : 'Assist') : (locale === 'fr' ? 'Encourager' : 'Cheer')}</Text>
                    </View>
                    {point.absoluteMinute !== null ? <Text tone="brand" weight="bold">{formatClock(point.absoluteMinute)}</Text> : null}
                  </View>
                  <Button variant="secondary" onPress={() => openDirections(point)}>{locale === 'fr' ? 'Y aller' : 'Directions'}</Button>
                </Card>
              ))}
              <Card surface={crew ? 'cream' : 'white'} style={[styles.checkpoint, muted && styles.muted]}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text size="lg" weight="bold">{checkpoint.name}</Text>
                    <Text tone="secondary">{checkpoint.distanceKm.toFixed(1)} km</Text>
                  </View>
                  {absolute !== null ? <Text tone="brand" weight="bold">{formatClock(absolute)}</Text> : null}
                </View>
                {crew ? (
                  <>
                    {context?.supportersAccess ? <Text tone="brand" weight="bold">{{ allowed: locale === 'fr' ? 'Accompagnateurs autorisés' : 'Supporters allowed', restricted: locale === 'fr' ? 'Accès restreint' : 'Restricted access', forbidden: locale === 'fr' ? 'Accompagnateurs interdits' : 'Supporters forbidden' }[context.supportersAccess]}</Text> : null}
                    {context?.accessLabel ? <Text tone="secondary">{context.accessLabel}</Text> : null}
                    {context?.accessNote ? <Text tone="secondary">{context.accessNote}</Text> : null}
                    {context?.maxStopMinutes ? <Text tone="secondary">{locale === 'fr' ? `Arrêt max ${context.maxStopMinutes} min` : `Maximum stop ${context.maxStopMinutes} min`}</Text> : null}
                    {context?.amenities.length ? <Text tone="secondary">{context.amenities.join(' · ')}</Text> : null}
                    {context?.cutoffTime ? <Text style={styles.cutoff}>{locale === 'fr' ? 'Barrière' : 'Cutoff'} {context.cutoffTime}{context.cutoffDayOffset ? ` · J+${context.cutoffDayOffset}` : ''}</Text> : null}
                    {context && directionsUrl(context) ? <Button variant="secondary" onPress={() => openDirections(context)}>{locale === 'fr' ? 'Y aller' : 'Directions'}</Button> : null}
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
              </View>
            );
          })}
        </View>

        <Card style={styles.section}>
          <Pressable accessibilityRole="button" onPress={() => { setPreparationOpen((value) => !value); if (!preparationOpen) captureAnalyticsEvent('followed plan preparation opened', { source: 'followed_plan' }); }}>
            <Text size="lg" weight="bold">{locale === 'fr' ? 'À préparer' : 'To prepare'}</Text>
          </Pressable>
          {preparationOpen ? <>
            {preparation.totals.map((product) => <Text key={product.productId} weight="semibold">{product.name} ×{product.quantity}</Text>)}
            {preparation.totalWaterLiters > 0 ? <Text tone="secondary">{locale === 'fr' ? 'Eau totale' : 'Total water'}: {preparation.totalWaterLiters.toFixed(1)} L</Text> : null}
            {preparation.points.map((point) => <View key={point.checkpointIndex} style={styles.preparationPoint}>
              <Text weight="bold">{point.name}</Text>
              {point.products.map((product) => {
                const key = `${point.checkpointIndex}:${product.productId}`;
                return <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: prepared.has(key) }} onPress={() => togglePrepared(key)} style={styles.checkRow}>
                  <Text>{prepared.has(key) ? '☑' : '☐'} {product.name} ×{product.quantity}</Text>
                </Pressable>;
              })}
              {point.water > 0 ? <Text tone="secondary">{locale === 'fr' ? 'Prévoir' : 'Prepare'} {point.water.toFixed(1)} L</Text> : null}
            </View>)}
          </> : null}
        </Card>

        {follow.raceContext ? <Card style={styles.section}>
          <Text size="lg" weight="bold">{locale === 'fr' ? 'Pratique' : 'Practical'}</Text>
          <Button variant="secondary" onPress={() => router.push(`/courses/supporter-guide/${follow.raceContext!.raceId}` as any)}>{locale === 'fr' ? 'Livret supporter de l’événement' : 'Event Supporter Guide'}</Button>
          {follow.raceContext.access?.officialParkings ? <Text><Text weight="bold">Parking · </Text>{follow.raceContext.access.officialParkings}</Text> : null}
          {follow.raceContext.access?.shuttles ? <Text><Text weight="bold">{locale === 'fr' ? 'Navettes' : 'Shuttles'} · </Text>{follow.raceContext.access.shuttles}{follow.raceContext.access.shuttleSchedule ? ` · ${follow.raceContext.access.shuttleSchedule}` : ''}</Text> : null}
          {follow.raceContext.bibPickup ? <Text><Text weight="bold">{locale === 'fr' ? 'Retrait par un tiers' : 'Third-party bib pickup'} · </Text>{follow.raceContext.bibPickup.thirdPartyPickupAllowed ? (follow.raceContext.bibPickup.thirdPartyPickupConditions || (locale === 'fr' ? 'Autorisé' : 'Allowed')) : (locale === 'fr' ? 'Non autorisé' : 'Not allowed')}</Text> : null}
          {follow.raceContext.emergencyContact ? <Button variant="secondary" onPress={() => void Linking.openURL(`tel:${follow.raceContext!.emergencyContact!.phone.replace(/[^+\d]/g, '')}`)}>{locale === 'fr' ? 'Appeler les urgences course' : 'Call race emergency'}</Button> : null}
        </Card> : null}

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
  timelineGroup: { gap: 10 },
  checkpoint: { gap: 10 },
  muted: { backgroundColor: Colors.surfaceMuted, opacity: 0.78 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 3 },
  preparationPoint: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  checkRow: { minHeight: 40, justifyContent: 'center' },
  cutoff: { color: Colors.danger, fontWeight: '700' },
});

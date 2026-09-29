import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import {
  buildLocalDepartureAt,
  buildRaceDateBase,
  normalizePlanClock,
  readOrganizerStartTime,
} from '../../lib/planDeparture';
import {
  applyStoredDepartureTime,
  formatCheckpointTime,
  formatClock,
  getPlanSummaryDepartureTimeStorageKey,
  type PlanSummary,
  type PlanSummaryCheckpoint,
  type PlanSummaryProduct,
} from '../../lib/planSummary';
import { createPlanShareLinkSynchronizer } from '../../lib/planShareLinks';
import { captureAnalyticsEvent } from '../../lib/posthog';
import { supabase } from '../../lib/supabase';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

type Props = {
  id: string;
  summary: PlanSummary;
  contentTopInset: number;
  shareOnMount?: boolean;
  onShareIntentConsumed?: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

function formatLiters(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getWaterInstruction(checkpoint: PlanSummaryCheckpoint, summary: PlanSummary, copy: ReturnType<typeof useI18n>['t']['planSummary']) {
  if (checkpoint.waterState === 'full') return copy.waterFull.replace('{liters}', formatLiters(summary.waterBagLiters));
  if (checkpoint.waterState === 'refill') return copy.waterRefill;
  if (checkpoint.waterState === 'finish') return copy.waterFinish;
  return copy.waterUnavailable;
}

function ProductLine({ product }: { product: PlanSummaryProduct }) {
  return (
    <View style={styles.productLine}>
      <View style={styles.productMain}>
        <Text numberOfLines={2} weight="semibold">{product.name}</Text>
        {product.brand ? <Text tone="secondary" size="xs">{product.brand}</Text> : null}
      </View>
      <View style={styles.productMeta}>
        <DataText tone="brand" weight="bold">x{product.quantity}</DataText>
        <DataText tone="secondary" size="xs">{Math.round(product.carbsG)}g / {Math.round(product.sodiumMg)}mg</DataText>
      </View>
    </View>
  );
}

function CheckpointCard({ checkpoint, departureTime, summary }: { checkpoint: PlanSummaryCheckpoint; departureTime: Date; summary: PlanSummary }) {
  const { t } = useI18n();
  const noAssistance = checkpoint.assistanceState === 'unavailable';
  const assistance = checkpoint.assistanceState === 'available' && !checkpoint.isStart && !checkpoint.isFinish;
  return (
    <View style={[styles.checkpointCard, assistance && styles.assistanceCard, noAssistance && styles.mutedCard]}>
      <View style={styles.checkpointHeader}>
        <View style={styles.productMain}>
          <Text weight="bold" style={styles.checkpointTitle}>{checkpoint.name}</Text>
          <DataText tone="secondary" size="xs">{checkpoint.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km · {formatCheckpointTime(checkpoint, departureTime)}</DataText>
        </View>
        <Ionicons name={checkpoint.isFinish ? 'flag-outline' : checkpoint.isStart ? 'play-outline' : 'trail-sign'} size={20} color={noAssistance ? Colors.textMuted : Colors.brandPrimary} />
      </View>
      <View style={styles.chips}>
        <Text style={styles.chip}>{getWaterInstruction(checkpoint, summary, t.planSummary)}</Text>
        {checkpoint.solidState === 'unavailable' ? <Text style={styles.chip}>{t.planSummary.solidUnavailable}</Text> : null}
        {checkpoint.assistanceState === 'available' || checkpoint.assistanceState === 'start' ? (
          <Text style={styles.chip}>{t.planSummary.assistanceAvailable}</Text>
        ) : null}
        {checkpoint.pauseMinutes > 0 ? <Text style={styles.chip}>{t.planSummary.pause} +{Math.round(checkpoint.pauseMinutes)} min</Text> : null}
        {noAssistance ? <Text style={styles.chip}>{t.planSummary.noAssistance}</Text> : null}
      </View>
      {!noAssistance ? (
        checkpoint.supplies.length > 0
          ? <View style={styles.compactProducts}>{checkpoint.supplies.map((product) => <View key={product.productId} style={styles.productPill}><Text numberOfLines={1} style={styles.productPillText}>{product.name}</Text><DataText tone="brand" weight="bold" size="xs">x{product.quantity}</DataText></View>)}</View>
          : <Text tone="secondary">{t.planSummary.nothingToGive}</Text>
      ) : null}
    </View>
  );
}

export function PlanRecapContent({ id, summary, contentTopInset, shareOnMount = false, onShareIntentConsumed, onScroll }: Props) {
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [departureTime, setDepartureTime] = useState(() => new Date());
  const [departureReady, setDepartureReady] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerHour, setPickerHour] = useState('00');
  const [pickerMinute, setPickerMinute] = useState('00');
  const [sharing, setSharing] = useState(false);
  const automaticShareRef = useRef(false);
  const synchronizerRef = useRef(createPlanShareLinkSynchronizer());
  const targetSummary = useMemo(() => `${Math.round(summary.targetCarbsPerHour)} g/h · ${Math.round(summary.targetWaterPerHour)} ml/h · ${Math.round(summary.targetSodiumPerHour)} mg/h`, [summary]);

  useEffect(() => {
    let cancelled = false;
    const fallback = new Date();
    setDepartureReady(false);
    Promise.all([
      AsyncStorage.getItem(getPlanSummaryDepartureTimeStorageKey(id)),
      supabase.from('race_plans').select('race_id,races(race_date,organizer_details)').eq('id', id).single(),
    ]).then(async ([stored, result]) => {
      if (cancelled) return;
      const row = result.data as { race_id?: string | null; races?: { race_date?: string | null; organizer_details?: unknown } | null } | null;
      const raceDate = row?.races?.race_date;
      const manual = applyStoredDepartureTime(stored, buildRaceDateBase(raceDate, fallback));
      if (manual) {
        setDepartureTime(manual);
        return;
      }
      let startTime = readOrganizerStartTime(row?.races?.organizer_details);
      if (!startTime && row?.race_id) {
        const { data } = await supabase.from('race_start_waves').select('start_time').eq('race_id', row.race_id).order('order_index', { ascending: true }).limit(1).maybeSingle();
        startTime = normalizePlanClock(data?.start_time);
      }
      if (!cancelled) setDepartureTime(buildLocalDepartureAt(raceDate, startTime) ? new Date(buildLocalDepartureAt(raceDate, startTime) as string) : fallback);
    }).catch(() => !cancelled && setDepartureTime(fallback)).finally(() => !cancelled && setDepartureReady(true));
    return () => { cancelled = true; };
  }, [id]);

  const synchronize = useCallback(() => {
    if (!departureReady) return Promise.resolve<string | null>(null);
    return synchronizerRef.current({ summary, departureTime, locale });
  }, [departureReady, departureTime, locale, summary]);

  useEffect(() => {
    if (departureReady) void synchronize().catch(() => undefined);
  }, [departureReady, synchronize]);

  const handleShare = useCallback(async () => {
    if (sharing || !departureReady) return;
    setSharing(true);
    try {
      const url = await synchronize();
      if (!url) throw new Error('Share link unavailable');
      await Share.share({ message: `${t.planSummary.shareLinkIntro.replace('{name}', summary.name)}\n${url}`, url });
      captureAnalyticsEvent('plan recap link shared', { aid_station_count: summary.checkpoints.length, product_count: summary.totalProductUnits });
    } catch {
      Alert.alert(t.common.error, t.planSummary.shareFailed);
    } finally {
      setSharing(false);
    }
  }, [departureReady, sharing, summary, synchronize, t.common.error, t.planSummary.shareFailed, t.planSummary.shareLinkIntro]);

  useEffect(() => {
    if (!shareOnMount || !departureReady || automaticShareRef.current) return;
    automaticShareRef.current = true;
    onShareIntentConsumed?.();
    void handleShare();
  }, [departureReady, handleShare, onShareIntentConsumed, shareOnMount]);

  const openPicker = () => {
    setPickerHour(String(departureTime.getHours()).padStart(2, '0'));
    setPickerMinute(String(departureTime.getMinutes()).padStart(2, '0'));
    setPickerVisible(true);
  };

  const confirmPicker = () => {
    const hour = Math.min(23, Math.max(0, Number.parseInt(pickerHour, 10) || 0));
    const minute = Math.min(59, Math.max(0, Number.parseInt(pickerMinute, 10) || 0));
    const next = new Date(departureTime);
    next.setHours(hour, minute, 0, 0);
    setDepartureTime(next);
    void AsyncStorage.setItem(getPlanSummaryDepartureTimeStorageKey(id), formatClock(next)).catch(() => undefined);
    setPickerVisible(false);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: contentTopInset }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.screen}
      >
        <View style={styles.recapIntro}>
          <View style={styles.productMain}>
            <Text tone="secondary">{t.planSummary.hourlyTargets}</Text>
            <DataText tone="brand" weight="bold">{targetSummary}</DataText>
          </View>
          <TouchableOpacity disabled={sharing} onPress={() => void handleShare()} style={[styles.shareButton, sharing && styles.disabled]}>
            <Ionicons name={sharing ? 'hourglass-outline' : 'share-social-outline'} size={18} color={Colors.textOnBrand} />
            <Text weight="bold" style={styles.shareText}>{sharing ? t.planSummary.shareLinkCreating : t.planSummary.share}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={openPicker} style={styles.departureCard}>
          <View><Text tone="secondary" size="xs" weight="semibold">{t.planSummary.departureTime}</Text><DataText tone="brand" size="2xl" weight="bold">{departureReady ? formatClock(departureTime) : '—'}</DataText></View>
          <Text weight="bold">{t.planSummary.changeDepartureTime}</Text>
        </TouchableOpacity>
        <View style={styles.section}>
          <Text weight="bold" style={styles.sectionTitle}>{t.planSummary.packList}</Text>
          <View style={styles.chips}><DataText tone="brand" weight="bold">{Math.round(summary.totalCarbsG)} g {t.planSummary.carbs}</DataText><DataText tone="brand" weight="bold">{Math.round(summary.totalSodiumMg)} mg {t.planSummary.sodium}</DataText></View>
          {summary.productTotals.length ? <View style={styles.listCard}>{summary.productTotals.map((product) => <ProductLine key={product.productId} product={product} />)}</View> : <View style={styles.emptyCard}><Text tone="secondary">{t.planSummary.noProducts}</Text></View>}
        </View>
        <View style={styles.section}>
          <Text weight="bold" style={styles.sectionTitle}>{t.planSummary.crewPlan}</Text>
          <View style={styles.checkpoints}>{summary.checkpoints.map((checkpoint) => <CheckpointCard checkpoint={checkpoint} departureTime={departureTime} key={`${checkpoint.index}-${checkpoint.name}`} summary={summary} />)}</View>
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalScroll, { paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(24, insets.bottom) }]} keyboardShouldPersistTaps="handled">
            <View accessibilityViewIsModal style={styles.modalCard}>
              <Text accessibilityRole="header" weight="bold" style={styles.sectionTitle}>{t.planSummary.departureTime}</Text>
              <View style={styles.timeRow}>
                <TextInput accessibilityLabel="HH" inputAccessoryViewID="pace-yourself-numeric-keyboard" keyboardType="number-pad" maxLength={2} onChangeText={(value) => setPickerHour(value.replace(/\D/g, '').slice(0, 2))} style={styles.timeInput} value={pickerHour} />
                <DataText size="2xl" weight="bold">:</DataText>
                <TextInput accessibilityLabel="MM" inputAccessoryViewID="pace-yourself-numeric-keyboard" keyboardType="number-pad" maxLength={2} onChangeText={(value) => setPickerMinute(value.replace(/\D/g, '').slice(0, 2))} style={styles.timeInput} value={pickerMinute} />
              </View>
              <TouchableOpacity onPress={confirmPicker} style={styles.primaryButton}><Text weight="bold" style={styles.shareText}>{t.common.confirm}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.cancelButton}><Text weight="bold">{t.common.cancel}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 16 },
  recapIntro: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface, padding: 14 },
  shareButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, backgroundColor: Colors.brandPrimary, paddingHorizontal: 14 },
  shareText: { color: Colors.textOnBrand },
  disabled: { opacity: 0.65 },
  departureCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 16 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, lineHeight: 25 },
  listCard: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  emptyCard: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 14 },
  productLine: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  productMain: { flex: 1, minWidth: 0, gap: 4 },
  productMeta: { minWidth: 80, alignItems: 'flex-end', gap: 4 },
  checkpoints: { gap: 10 },
  checkpointCard: { gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 14 },
  assistanceCard: { borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface },
  mutedCard: { backgroundColor: Colors.surfaceMuted, opacity: 0.78 },
  checkpointHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkpointTitle: { fontSize: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11 },
  compactProducts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  productPill: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 6 },
  productPillText: { maxWidth: 180 },
  bottomSpacer: { height: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { gap: 16, borderRadius: 20, backgroundColor: Colors.surface, padding: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  timeInput: { width: 82, minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, fontSize: 24, textAlign: 'center' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: Colors.brandPrimary },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

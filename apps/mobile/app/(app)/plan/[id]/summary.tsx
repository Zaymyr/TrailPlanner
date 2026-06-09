import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { PlanLoadingScreen } from '../../../../components/PlanLoadingScreen';
import { DataText } from '../../../../components/themed/DataText';
import { Text } from '../../../../components/themed/Text';
import type { PlanProduct } from '../../../../components/plan-form/contracts';
import { Colors } from '../../../../constants/colors';
import { FREE_PLAN_LIMIT, getCurrentUserPlanAccess } from '../../../../lib/planAccess';
import {
  buildPlanSummary,
  buildProductMap,
  buildStoredRacePlanFromRow,
  collectPlanProductIds,
  formatCheckpointTime,
  formatClock,
  formatDuration,
  formatKm,
  type PlanSummary,
  type PlanSummaryCheckpoint,
  type PlanSummaryProduct,
  type PlanSummaryRow,
} from '../../../../lib/planSummary';
import { createPlanShareLink } from '../../../../lib/planShareLinks';
import { useI18n } from '../../../../lib/i18n';
import { captureAnalyticsEvent } from '../../../../lib/posthog';
import { supabase } from '../../../../lib/supabase';
import { usePremium } from '../../../../hooks/usePremium';

function formatLiters(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getWaterInstruction(
  checkpoint: PlanSummaryCheckpoint,
  summary: PlanSummary,
  copy: ReturnType<typeof useI18n>['t']['planSummary'],
) {
  if (checkpoint.waterState === 'full') {
    return copy.waterFull.replace('{liters}', formatLiters(summary.waterBagLiters));
  }
  if (checkpoint.waterState === 'refill') return copy.waterRefill;
  if (checkpoint.waterState === 'finish') return copy.waterFinish;
  return copy.waterUnavailable;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <DataText selectable tone="brand" size="lg" weight="bold" style={styles.metricValue}>
        {value}
      </DataText>
      <Text tone="secondary" size="xs" weight="semibold" style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

function ProductLine({ product }: { product: PlanSummaryProduct }) {
  return (
    <View style={styles.productLine}>
      <View style={styles.productMain}>
        <Text selectable numberOfLines={2} weight="semibold" style={styles.productName}>
          {product.name}
        </Text>
        {product.brand ? (
          <Text selectable tone="secondary" size="xs">
            {product.brand}
          </Text>
        ) : null}
      </View>
      <View style={styles.productMeta}>
        <DataText tone="brand" weight="bold">
          x{product.quantity}
        </DataText>
        <DataText tone="secondary" size="xs">
          {Math.round(product.carbsG)}g / {Math.round(product.sodiumMg)}mg
        </DataText>
      </View>
    </View>
  );
}

function CheckpointCard({
  checkpoint,
  departureTime,
  summary,
}: {
  checkpoint: PlanSummaryCheckpoint;
  departureTime: Date;
  summary: PlanSummary;
}) {
  const { t } = useI18n();
  const waterInstruction = getWaterInstruction(checkpoint, summary, t.planSummary);

  return (
    <View style={styles.checkpointCard}>
      <View style={styles.checkpointHeader}>
        <View style={styles.checkpointTitleBlock}>
          <Text selectable weight="bold" style={styles.checkpointTitle}>
            {checkpoint.name}
          </Text>
          <DataText selectable tone="secondary" size="xs" weight="medium">
            {formatKm(checkpoint.distanceKm)} - {formatCheckpointTime(checkpoint, departureTime)}
          </DataText>
        </View>
        <View style={styles.checkpointBadge}>
          <Ionicons
            color={checkpoint.isFinish ? Colors.textSecondary : Colors.brandPrimary}
            name={checkpoint.isFinish ? 'flag-outline' : checkpoint.isStart ? 'play-outline' : 'trail-sign'}
            size={18}
          />
        </View>
      </View>

      <View style={styles.chipRow}>
        <Text style={styles.chip}>{waterInstruction}</Text>
        {checkpoint.solidState === 'unavailable' ? (
          <Text style={[styles.chip, styles.warningChip]}>{t.planSummary.solidUnavailable}</Text>
        ) : null}
        {checkpoint.pauseMinutes > 0 ? (
          <Text style={styles.chip}>
            {t.planSummary.pause} +{Math.round(checkpoint.pauseMinutes)} min
          </Text>
        ) : null}
      </View>

      {checkpoint.supplies.length === 0 ? (
        <Text selectable tone="secondary" style={styles.emptyText}>
          {t.planSummary.nothingToGive}
        </Text>
      ) : (
        <View style={styles.compactProducts}>
          {checkpoint.supplies.map((product) => (
            <View key={product.productId} style={styles.compactProductPill}>
              <Text numberOfLines={1} style={styles.compactProductText}>
                {product.name}
              </Text>
              <DataText tone="brand" weight="bold" size="xs">
                x{product.quantity}
              </DataText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PlanSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { locale, t } = useI18n();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0.08);
  const [error, setError] = useState<string | null>(null);
  const [departureTime, setDepartureTime] = useState(() => new Date());
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [pickerHour, setPickerHour] = useState(() => String(new Date().getHours()).padStart(2, '0'));
  const [pickerMinute, setPickerMinute] = useState(() => String(new Date().getMinutes()).padStart(2, '0'));
  const [sharing, setSharing] = useState(false);

  const targetSummary = useMemo(() => {
    if (!summary) return '';
    return `${Math.round(summary.targetCarbsPerHour)} g/h - ${Math.round(summary.targetWaterPerHour)} ml/h - ${Math.round(summary.targetSodiumPerHour)} mg/h`;
  }, [summary]);

  const loadSummary = useCallback(async () => {
    if (!id || premiumLoading) return;

    setLoading(true);
    setError(null);
    setLoadingProgress(0.12);

    try {
      const planAccess = await getCurrentUserPlanAccess(isPremium);
      if (
        !isPremium &&
        planAccess.accessiblePlanIds !== null &&
        !planAccess.accessiblePlanIds.has(id)
      ) {
        Alert.alert(
          t.plans.freeAccessTitle,
          t.plans.freeAccessMessage.replace('{count}', String(FREE_PLAN_LIMIT)),
        );
        router.replace('/(app)/plans');
        return;
      }

      setLoadingProgress(0.32);
      const { data, error: planError } = await supabase
        .from('race_plans')
        .select('id, name, updated_at, planner_values, elevation_profile')
        .eq('id', id)
        .single();

      if (planError) throw planError;
      if (!data) throw new Error('Plan introuvable.');

      const plan = buildStoredRacePlanFromRow(data as PlanSummaryRow);
      setLoadingPlanName(plan.name);
      setLoadingProgress(0.58);

      const productIds = collectPlanProductIds(plan);
      let productMap: Record<string, PlanProduct> = {};

      if (productIds.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name, brand, fuel_type, carbs_g, sodium_mg, calories_kcal')
          .in('id', productIds);

        if (productsError) throw productsError;
        productMap = buildProductMap((products ?? []) as PlanProduct[]);
      }

      setSummary(buildPlanSummary(plan, productMap));
      setLoadingProgress(1);
      captureAnalyticsEvent('plan recap viewed', {
        aid_station_count: plan.plannerValues?.aidStations?.length ?? 0,
      });
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [
    id,
    isPremium,
    premiumLoading,
    router,
    t.common.error,
    t.plans.freeAccessMessage,
    t.plans.freeAccessTitle,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleShare = useCallback(async () => {
    if (!summary || sharing) return;

    setSharing(true);
    try {
      const shareUrl = await createPlanShareLink({ summary, departureTime, locale });
      await Share.share({
        message: `${t.planSummary.shareLinkIntro.replace('{name}', summary.name)}\n${shareUrl}`,
        url: shareUrl,
      });
      captureAnalyticsEvent('plan recap link shared', {
        aid_station_count: summary.checkpoints.length,
        product_count: summary.totalProductUnits,
      });
    } catch {
      Alert.alert(t.common.error, t.planSummary.shareFailed);
    } finally {
      setSharing(false);
    }
  }, [
    departureTime,
    locale,
    sharing,
    summary,
    t.common.error,
    t.planSummary.shareFailed,
    t.planSummary.shareLinkIntro,
  ]);

  const openTimePicker = useCallback(() => {
    setPickerHour(String(departureTime.getHours()).padStart(2, '0'));
    setPickerMinute(String(departureTime.getMinutes()).padStart(2, '0'));
    setTimePickerVisible(true);
  }, [departureTime]);

  const handleConfirmDepartureTime = useCallback(() => {
    const parsedHour = Number.parseInt(pickerHour, 10);
    const parsedMinute = Number.parseInt(pickerMinute, 10);
    const safeHour = Number.isFinite(parsedHour) ? Math.min(23, Math.max(0, parsedHour)) : 0;
    const safeMinute = Number.isFinite(parsedMinute) ? Math.min(59, Math.max(0, parsedMinute)) : 0;
    const nextDate = new Date(departureTime);
    nextDate.setHours(safeHour, safeMinute, 0, 0);

    setDepartureTime(nextDate);
    setPickerHour(String(safeHour).padStart(2, '0'));
    setPickerMinute(String(safeMinute).padStart(2, '0'));
    setTimePickerVisible(false);
  }, [departureTime, pickerHour, pickerMinute]);

  if (loading || premiumLoading) {
    return (
      <PlanLoadingScreen
        planName={loadingPlanName}
        progress={loadingProgress}
        stage={t.plans.planLoadingStage}
        title={loadingPlanName ? t.plans.planLoadingNamed.replace('{name}', loadingPlanName) : t.plans.planLoadingGeneric}
      />
    );
  }

  if (error || !summary) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t.planSummary.title }} />
        <Text selectable style={styles.errorText}>
          {error ?? t.common.error}
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadSummary()}>
          <Text weight="bold">{t.common.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t.planSummary.title,
          headerRight: () => null,
        }}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text selectable weight="bold" style={styles.heroTitle}>
                {summary.name}
              </Text>
              <Text selectable tone="secondary" style={styles.heroSubtitle}>
                {t.planSummary.hourlyTargets} : {targetSummary}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={sharing}
              style={[styles.shareButton, sharing ? styles.shareButtonDisabled : null]}
              onPress={handleShare}
            >
              <Ionicons color={Colors.textOnBrand} name={sharing ? 'hourglass-outline' : 'link-outline'} size={18} />
              <Text weight="bold" style={styles.shareButtonText}>
                {sharing ? t.planSummary.shareLinkCreating : t.planSummary.shareLink}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricGrid}>
            <MetricCard label={t.planSummary.distance} value={formatKm(summary.distanceKm)} />
            <MetricCard label={t.planSummary.elevation} value={`${Math.round(summary.elevationGainM)} m`} />
            <MetricCard label={t.planSummary.estimatedDuration} value={formatDuration(summary.totalDurationMin)} />
            <MetricCard label={t.planSummary.products} value={String(summary.totalProductUnits)} />
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.departureCard} onPress={openTimePicker}>
          <View>
            <Text tone="secondary" size="xs" weight="semibold" style={styles.kicker}>
              {t.planSummary.departureTime}
            </Text>
            <DataText selectable tone="brand" size="2xl" weight="bold">
              {formatClock(departureTime)}
            </DataText>
          </View>
          <TouchableOpacity
            style={styles.inlineButton}
            onPress={openTimePicker}
          >
            <Text weight="bold" style={styles.inlineButtonText}>
              {t.planSummary.changeDepartureTime}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text weight="bold" style={styles.sectionTitle}>
            {t.planSummary.packList}
          </Text>
          <View style={styles.totalStrip}>
            <DataText tone="brand" weight="bold">
              {Math.round(summary.totalCarbsG)} g {t.planSummary.carbs}
            </DataText>
            <DataText tone="brand" weight="bold">
              {Math.round(summary.totalSodiumMg)} mg {t.planSummary.sodium}
            </DataText>
          </View>
          {summary.productTotals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text selectable tone="secondary">
                {t.planSummary.noProducts}
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {summary.productTotals.map((product) => (
                <ProductLine key={product.productId} product={product} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text weight="bold" style={styles.sectionTitle}>
            {t.planSummary.crewPlan}
          </Text>
          <View style={styles.checkpointsList}>
            {summary.checkpoints.map((checkpoint) => (
              <CheckpointCard
                checkpoint={checkpoint}
                departureTime={departureTime}
                key={`${checkpoint.index}-${checkpoint.name}`}
                summary={summary}
              />
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={timePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <Text weight="bold" style={styles.timeModalTitle}>
              {t.planSummary.departureTime}
            </Text>
            <View style={styles.timePickerRow}>
              <View style={styles.timeField}>
                <Text tone="secondary" size="xs" weight="semibold" style={styles.timeFieldLabel}>
                  HH
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={(text) => setPickerHour(text.replace(/\D/g, '').slice(0, 2))}
                  placeholder="07"
                  placeholderTextColor={Colors.textMuted}
                  selectTextOnFocus
                  style={styles.timeInput}
                  value={pickerHour}
                />
              </View>
              <DataText size="2xl" weight="bold">
                :
              </DataText>
              <View style={styles.timeField}>
                <Text tone="secondary" size="xs" weight="semibold" style={styles.timeFieldLabel}>
                  MM
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={(text) => setPickerMinute(text.replace(/\D/g, '').slice(0, 2))}
                  placeholder="52"
                  placeholderTextColor={Colors.textMuted}
                  selectTextOnFocus
                  style={styles.timeInput}
                  value={pickerMinute}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleConfirmDepartureTime}
            >
              <Text weight="bold" style={styles.primaryButtonText}>
                {t.common.confirm}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setTimePickerVisible(false)}>
              <Text weight="bold">{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: 16,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
  },
  hero: {
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    padding: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 26,
    lineHeight: 31,
  },
  heroSubtitle: {
    lineHeight: 20,
  },
  shareButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 12,
  },
  shareButtonDisabled: {
    opacity: 0.72,
  },
  shareButtonText: {
    color: Colors.textOnBrand,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    minHeight: 70,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.surface,
    padding: 12,
  },
  metricValue: {
    fontSize: 19,
  },
  metricLabel: {
    textTransform: 'uppercase',
  },
  departureCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 16,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  inlineButton: {
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 22,
  },
  inlineButtonText: {
    color: Colors.textPrimary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
  },
  totalStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  productLine: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  productMain: {
    flex: 1,
    gap: 4,
  },
  productName: {
    lineHeight: 20,
  },
  productMeta: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 4,
  },
  checkpointsList: {
    gap: 10,
  },
  checkpointCard: {
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  checkpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkpointTitleBlock: {
    flex: 1,
    gap: 4,
  },
  checkpointTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  checkpointBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: Colors.surfaceSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  warningChip: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningSurface,
    color: Colors.warning,
  },
  emptyText: {
    lineHeight: 20,
  },
  compactProducts: {
    gap: 8,
  },
  compactProductPill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
  },
  compactProductText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 18,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.42)',
    padding: 24,
  },
  timeModal: {
    width: '100%',
    maxWidth: 360,
    gap: 18,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    padding: 22,
  },
  timeModalTitle: {
    fontSize: 20,
    lineHeight: 25,
    textAlign: 'center',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  timeField: {
    flex: 1,
    gap: 8,
  },
  timeFieldLabel: {
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  timeInput: {
    minHeight: 66,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textPrimary,
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 16,
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import type { PlanProduct } from '../../../components/plan-form/contracts';
import { LiveFuelGauge } from '../../../components/race/LiveFuelGauge';
import { LiveNextIntakeCard } from '../../../components/race/LiveNextIntakeCard';
import { RaceStartSheet, type RaceStartConfig } from '../../../components/race/RaceStartSheet';
import { FeedbackHeaderButton } from '../../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../../constants/colors';
import { usePremium } from '../../../hooks/usePremium';
import { getCurrentUserLatestAccessiblePlanId } from '../../../lib/planAccess';
import {
  checkAndFireAlerts,
  getNutritionStats,
  getSession,
  requestPermissions,
  respondToAlert,
  startRace,
  stopRace,
  updateWaterOnlyAlertSchedule,
} from '../../../lib/raceLiveSession';
import type { ActiveAlert } from '../../../lib/raceLiveSession';
import {
  buildLiveRaceSections,
  DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN,
  isWaterOnlyIntakeEvent,
  normalizeStoredPlanValues,
  WATER_ONLY_REMINDER_INTERVALS,
  type LiveRaceSection,
  type StoredRacePlan,
  type WaterOnlyReminderIntervalMinutes,
} from '../../../lib/raceLivePlan';
import { supabase } from '../../../lib/supabase';
import { useI18n } from '../../../lib/i18n';

function formatElapsedFromMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}min`;
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${safeMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function formatKm(distanceKm: number) {
  return `${distanceKm.toFixed(distanceKm >= 10 ? 0 : 1)} km`;
}

function collectUsedProductIds(plan: StoredRacePlan) {
  const values = normalizeStoredPlanValues(plan);
  const ids = new Set<string>();

  values.startSupplies.forEach((supply) => ids.add(supply.productId));
  values.aidStations.forEach((station) => {
    (station.supplies ?? []).forEach((supply) => ids.add(supply.productId));
  });

  return [...ids];
}

function buildStoredRacePlan(data: {
  id: string;
  name: string;
  updated_at: string;
  planner_values?: Record<string, unknown> | null;
  elevation_profile?: unknown;
}): StoredRacePlan {
  const plannerValues = (data.planner_values ?? {}) as StoredRacePlan['plannerValues'];
  return {
    id: data.id,
    name: data.name,
    updatedAt: data.updated_at,
    raceDistanceKm: Number(plannerValues?.raceDistanceKm ?? 0),
    elevationGainM: Number(plannerValues?.elevationGain ?? 0),
    targetCarbsPerHour: Number(plannerValues?.targetIntakePerHour ?? 0),
    targetWaterPerHour: Number(plannerValues?.waterIntakePerHour ?? 0),
    targetSodiumPerHour: Number(plannerValues?.sodiumIntakePerHour ?? 0),
    plannerValues,
    elevationProfile: Array.isArray(data.elevation_profile) ? (data.elevation_profile as StoredRacePlan['elevationProfile']) : [],
  };
}

type StatsState = ReturnType<typeof getNutritionStats>;

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function PlanLoadingScreen({
  planName,
  progress,
  title,
  stage,
}: {
  planName: string | null;
  progress: number;
  title: string;
  stage: string;
}) {
  const safeProgress = Math.max(0.08, Math.min(1, progress));

  return (
    <View style={styles.loadingScreen}>
      <View style={styles.loadingCard}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
        <Text style={styles.loadingTitle}>{title}</Text>
        {planName ? <Text style={styles.loadingPlanName}>{planName}</Text> : null}
        <View style={styles.loadingProgressTrack}>
          <View style={[styles.loadingProgressFill, { width: `${safeProgress * 100}%` }]} />
        </View>
        <Text style={styles.loadingStage}>{stage}</Text>
      </View>
    </View>
  );
}

export default function RaceScreenV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const { t } = useI18n();
  const [plan, setPlan] = useState<StoredRacePlan | null>(null);
  const [productMap, setProductMap] = useState<Record<string, PlanProduct>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0.08);
  const [showConfig, setShowConfig] = useState(false);
  const [includeWaterOnlyAlerts, setIncludeWaterOnlyAlerts] = useState(true);
  const [waterOnlyReminderIntervalMinutes, setWaterOnlyReminderIntervalMinutes] =
    useState<WaterOnlyReminderIntervalMinutes>(DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN);
  const [racing, setRacing] = useState(false);
  const [stats, setStats] = useState<StatsState | null>(null);
  const [startedAt, setStartedAt] = useState(new Date());
  const [previewDepartureTime, setPreviewDepartureTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(new Date().getHours());
  const [pickerMinute, setPickerMinute] = useState(new Date().getMinutes());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (premiumLoading) return;

      setLoading(true);
      setLoadingPlanName(null);
      setLoadingProgress(0.12);
      setShowConfig(false);
      setIncludeWaterOnlyAlerts(true);
      setWaterOnlyReminderIntervalMinutes(DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN);
      const latestAccessiblePlanId = await getCurrentUserLatestAccessiblePlanId(isPremium);
      if (!isPremium && latestAccessiblePlanId && latestAccessiblePlanId !== id) {
        if (!cancelled) {
          Alert.alert(t.plans.freeAccessTitle, t.plans.freeAccessMessage);
          setLoading(false);
          router.replace('/(app)/plans');
        }
        return;
      }

      if (!cancelled) {
        setLoadingProgress(0.28);
      }

      const { data } = await supabase
        .from('race_plans')
        .select('id, name, updated_at, planner_values, elevation_profile')
        .eq('id', id)
        .single();

      if (!data || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      const nextPlan = buildStoredRacePlan(data);
      if (!cancelled) {
        setLoadingPlanName(nextPlan.name);
        setLoadingProgress(0.48);
      }
      const productIds = collectUsedProductIds(nextPlan);
      let nextProductMap: Record<string, PlanProduct> = {};

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal')
          .in('id', productIds);

        const productRows = (products ?? []) as PlanProduct[];
        nextProductMap = productRows.reduce<Record<string, PlanProduct>>((map, product) => {
          map[product.id] = product as PlanProduct;
          return map;
        }, {});
      }

      if (cancelled) return;

      setLoadingProgress(0.72);

      setPlan(nextPlan);
      setProductMap(nextProductMap);

      const existingSession = getSession();
      if (existingSession?.plan.id === nextPlan.id) {
        const sessionWaterInterval = existingSession.waterOnlyReminderIntervalMinutes;
        setIncludeWaterOnlyAlerts(sessionWaterInterval !== null);
        setWaterOnlyReminderIntervalMinutes(sessionWaterInterval ?? DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN);
        setRacing(true);
        setStartedAt(new Date(existingSession.startedAt));
        setStats(getNutritionStats(existingSession));
      } else {
        setRacing(false);
        setStats(null);
      }

      setLoadingProgress(0.92);
      await waitForNextPaint();
      if (cancelled) return;

      setLoadingProgress(1);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isPremium, premiumLoading, router, t.plans.freeAccessMessage, t.plans.freeAccessTitle]);

  const refreshSession = useCallback(() => {
    const currentSession = getSession();
    if (!currentSession) {
      setRacing(false);
      setStats(null);
      return;
    }

    setStats(getNutritionStats(currentSession));
    setStartedAt(new Date(currentSession.startedAt));
  }, []);

  useEffect(() => {
    if (!racing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = async () => {
      await checkAndFireAlerts();
      refreshSession();
    };

    void tick();
    timerRef.current = setInterval(() => {
      void tick();
    }, 5_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [racing, refreshSession]);

  const liveSections = useMemo<LiveRaceSection[]>(
    () =>
      plan
        ? buildLiveRaceSections(plan, productMap, {
            waterOnlyReminderIntervalMinutes,
          })
        : [],
    [plan, productMap, waterOnlyReminderIntervalMinutes],
  );
  const totalDurationMin = useMemo(
    () => liveSections.reduce((sum, section) => sum + section.durationMin, 0),
    [liveSections],
  );
  const totalAlerts = useMemo(
    () =>
      liveSections.reduce(
        (sum, section) =>
          sum + section.timeline.filter((event) => includeWaterOnlyAlerts || !isWaterOnlyIntakeEvent(event)).length,
        0,
      ),
    [includeWaterOnlyAlerts, liveSections],
  );

  const applyWaterReminderConfig = useCallback(
    (nextIncludeWaterOnlyAlerts: boolean, nextIntervalMinutes: WaterOnlyReminderIntervalMinutes) => {
      setIncludeWaterOnlyAlerts(nextIncludeWaterOnlyAlerts);
      setWaterOnlyReminderIntervalMinutes(nextIntervalMinutes);

      if (racing) {
        updateWaterOnlyAlertSchedule(productMap, nextIncludeWaterOnlyAlerts ? nextIntervalMinutes : null);
        refreshSession();
      }
    },
    [productMap, racing, refreshSession],
  );

  const handleStart = useCallback(
    async (config: RaceStartConfig) => {
      if (!plan) return;

      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications requises',
          'Active les notifications pour recevoir les rappels de nutrition pendant la course.',
        );
        return;
      }

      await startRace(plan, productMap, config.confirmMode, {
        includeWaterOnlyAlerts: config.includeWaterOnlyAlerts,
        waterOnlyReminderIntervalMinutes: config.waterOnlyReminderIntervalMinutes,
      });
      setShowConfig(false);
      setRacing(true);
      refreshSession();
    },
    [plan, productMap, refreshSession],
  );

  const handleStop = useCallback(() => {
    Alert.alert('Arrêter la course ?', 'Le suivi live et les notifications seront stoppés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: async () => {
          await stopRace();
          setRacing(false);
          setStats(null);
        },
      },
    ]);
  }, []);

  const handleAlertAction = useCallback(
    async (alertId: string, action: 'confirmed' | 'skipped' | 'snoozed', snoozeMinutes?: number) => {
      await respondToAlert(alertId, action, snoozeMinutes);
      refreshSession();
    },
    [refreshSession],
  );

  if (loading) {
    const loadingTitle = loadingPlanName
      ? t.races.planLoadingNamed.replace('{name}', loadingPlanName)
      : t.races.planLoadingGeneric;

    return (
      <PlanLoadingScreen
        planName={loadingPlanName}
        progress={loadingProgress}
        stage={t.races.planLoadingStage}
        title={loadingTitle}
      />
    );
  }

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Plan introuvable</Text>
      </View>
    );
  }

  if (!racing) {
    return (
      <>
        <Stack.Screen
          options={{
            title: plan.name,
            headerRight: () => (
              <FeedbackHeaderButton
                contextLabel={plan.name}
                leading={(
                  <TouchableOpacity onPress={() => router.push(`/(app)/plan/${id}/edit`)}>
                    <Text style={styles.headerAction}>Modifier</Text>
                  </TouchableOpacity>
                )}
              />
            ),
          }}
        />
        <View style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>{plan.name}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{formatKm(plan.raceDistanceKm)}</Text>
                  <Text style={styles.heroStatLabel}>Distance</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{Math.round(plan.elevationGainM)} m</Text>
                  <Text style={styles.heroStatLabel}>D+</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{formatDuration(totalDurationMin)}</Text>
                  <Text style={styles.heroStatLabel}>Temps total</Text>
                </View>
              </View>
            </View>

            <View style={styles.inlineCard}>
              <View>
                <Text style={styles.kicker}>Depart estime</Text>
                <Text style={styles.inlineTitle}>{formatClock(previewDepartureTime)}</Text>
              </View>
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => {
                  setPickerHour(previewDepartureTime.getHours());
                  setPickerMinute(previewDepartureTime.getMinutes());
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.inlineButtonText}>Changer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.sectionHeading}>Suivi live</Text>
              <Text style={styles.summaryText}>
                {totalAlerts} rappels vont etre generes a partir des prises planifiees dans les sections.
              </Text>
              <View style={styles.summaryChips}>
                <Text style={styles.summaryChip}>{liveSections.length} sections</Text>
                <Text style={styles.summaryChip}>{Math.round(plan.targetCarbsPerHour)} g/h</Text>
                <Text style={styles.summaryChip}>{Math.round(plan.targetWaterPerHour)} ml/h</Text>
                <Text style={styles.summaryChip}>{Math.round(plan.targetSodiumPerHour)} mg/h</Text>
              </View>
              <View style={[styles.waterToggleCard, !includeWaterOnlyAlerts && styles.waterToggleCardDisabled]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.waterToggleHeader}
                  onPress={() => applyWaterReminderConfig(!includeWaterOnlyAlerts, waterOnlyReminderIntervalMinutes)}
                >
                  <View style={styles.waterToggleCopy}>
                    <Text style={styles.waterToggleTitle}>Rappels eau seule</Text>
                    <Text style={styles.waterToggleText}>
                      {includeWaterOnlyAlerts
                        ? `Toutes les ${waterOnlyReminderIntervalMinutes} min, volume ajuste par prise.`
                        : "Les prises d'eau seule sont grisees et sans notification."}
                    </Text>
                  </View>
                  <View style={[styles.waterToggleSwitch, includeWaterOnlyAlerts && styles.waterToggleSwitchActive]}>
                    <View style={[styles.waterToggleKnob, includeWaterOnlyAlerts && styles.waterToggleKnobActive]} />
                  </View>
                </TouchableOpacity>
                <View style={styles.waterIntervalRow}>
                  {WATER_ONLY_REMINDER_INTERVALS.map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      activeOpacity={0.85}
                      disabled={!includeWaterOnlyAlerts}
                      style={[
                        styles.waterIntervalButton,
                        waterOnlyReminderIntervalMinutes === minutes && includeWaterOnlyAlerts && styles.waterIntervalButtonActive,
                        !includeWaterOnlyAlerts && styles.waterIntervalButtonDisabled,
                      ]}
                      onPress={() => applyWaterReminderConfig(true, minutes)}
                    >
                      <Text
                        style={[
                          styles.waterIntervalText,
                          waterOnlyReminderIntervalMinutes === minutes && includeWaterOnlyAlerts && styles.waterIntervalTextActive,
                          !includeWaterOnlyAlerts && styles.waterIntervalTextDisabled,
                        ]}
                      >
                        {minutes} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Aperçu des prises</Text>
            {liveSections.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucune section exploitable dans ce plan.</Text>
              </View>
            ) : (
              liveSections.map((section) => (
                <View key={section.id} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderMain}>
                      <Text style={styles.sectionTitle}>
                        {section.fromName} {'->'} {section.toName}
                      </Text>
                      <Text style={styles.sectionSubTitle}>
                        {formatClock(addMinutes(previewDepartureTime, section.startMinute))} -{' '}
                        {formatClock(addMinutes(previewDepartureTime, section.endMinute))}
                      </Text>
                    </View>
                    <View style={styles.sectionMetaBadge}>
                      <Text style={styles.sectionMetaBadgeText}>{formatDuration(section.durationMin)}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaPill}>{formatKm(section.distanceKm)}</Text>
                    {section.pauseMinutes > 0 ? <Text style={styles.metaPill}>Pause +{section.pauseMinutes} min</Text> : null}
                    <Text style={styles.metaPill}>{Math.round(section.targetCarbsG)} g</Text>
                    <Text style={styles.metaPill}>{Math.round(section.targetWaterMl)} ml</Text>
                    <Text style={styles.metaPill}>{Math.round(section.targetSodiumMg)} mg</Text>
                  </View>

                  {section.timeline.length === 0 ? (
                    <Text style={styles.timelineEmpty}>Aucune prise planifiée sur cette section.</Text>
                  ) : (
                    section.timeline.map((event) => {
                      const waterOnlyDisabled = !includeWaterOnlyAlerts && isWaterOnlyIntakeEvent(event);

                      return (
                        <View key={event.id} style={[styles.timelineRow, waterOnlyDisabled && styles.timelineRowDisabled]}>
                          <View style={styles.timelineMinute}>
                            <Text style={[styles.timelineMinuteText, waterOnlyDisabled && styles.timelineTextDisabled]}>
                              {Math.round(event.minute)} min
                            </Text>
                          </View>
                          <View style={styles.timelineContent}>
                            <Text style={[styles.timelineLabel, waterOnlyDisabled && styles.timelineTextDisabled]}>
                              {event.label}
                              {waterOnlyDisabled ? ' - pas de notif' : ''}
                            </Text>
                            <Text style={[styles.timelineDetail, waterOnlyDisabled && styles.timelineTextDisabled]}>
                              {event.detail}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ))
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          <View style={styles.stickyFooter}>
            <TouchableOpacity style={styles.startButton} onPress={() => setShowConfig(true)}>
              <Text style={styles.startButtonText}>Demarrer le suivi live</Text>
            </TouchableOpacity>
          </View>
        </View>

        <RaceStartSheet
          visible={showConfig}
          raceName={plan.name}
          includeWaterOnlyAlerts={includeWaterOnlyAlerts}
          waterOnlyReminderIntervalMinutes={waterOnlyReminderIntervalMinutes}
          onStart={handleStart}
          onCancel={() => setShowConfig(false)}
        />

        <Modal visible={showTimePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.timeModal}>
              <Text style={styles.timeModalTitle}>Heure de depart</Text>
              <View style={styles.timePickerRow}>
                <View style={styles.timeUnit}>
                  <TouchableOpacity onPress={() => setPickerHour((hour) => (hour + 1) % 24)}>
                    <Text style={styles.timeArrow}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{String(pickerHour).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => setPickerHour((hour) => (hour - 1 + 24) % 24)}>
                    <Text style={styles.timeArrow}>-</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.timeUnit}>
                  <TouchableOpacity onPress={() => setPickerMinute((minute) => (minute + 5) % 60)}>
                    <Text style={styles.timeArrow}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{String(pickerMinute).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => setPickerMinute((minute) => (minute - 5 + 60) % 60)}>
                    <Text style={styles.timeArrow}>-</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => {
                  const nextDate = new Date();
                  nextDate.setHours(pickerHour, pickerMinute, 0, 0);
                  setPreviewDepartureTime(nextDate);
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.modalPrimaryText}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalSecondaryText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: plan.name }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.liveHero}>
          <View style={styles.liveHeroTop}>
            <View>
              <Text style={styles.liveKicker}>Course en cours</Text>
              <Text style={styles.liveChrono}>{formatElapsedFromMinutes(stats?.elapsedMinutes ?? 0)}</Text>
            </View>
            <View style={styles.liveProgressBadge}>
              <Text style={styles.liveProgressText}>
                {stats?.completedCount ?? 0}/{stats?.totalCount ?? 0}
              </Text>
            </View>
          </View>
          <Text style={styles.liveSummary}>
            {Math.round(stats?.totalCarbsConsumed ?? 0)} g glucides pris · {Math.round(stats?.totalWaterConsumed ?? 0)} ml eau
          </Text>
        </View>

        <View style={[styles.waterToggleCard, !includeWaterOnlyAlerts && styles.waterToggleCardDisabled]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.waterToggleHeader}
            onPress={() => applyWaterReminderConfig(!includeWaterOnlyAlerts, waterOnlyReminderIntervalMinutes)}
          >
            <View style={styles.waterToggleCopy}>
              <Text style={styles.waterToggleTitle}>Rappels eau seule</Text>
              <Text style={styles.waterToggleText}>
                {includeWaterOnlyAlerts
                  ? `Toutes les ${waterOnlyReminderIntervalMinutes} min pour les prochains rappels.`
                  : "Les prochains rappels d'eau seule sont coupes."}
              </Text>
            </View>
            <View style={[styles.waterToggleSwitch, includeWaterOnlyAlerts && styles.waterToggleSwitchActive]}>
              <View style={[styles.waterToggleKnob, includeWaterOnlyAlerts && styles.waterToggleKnobActive]} />
            </View>
          </TouchableOpacity>
          <View style={styles.waterIntervalRow}>
            {WATER_ONLY_REMINDER_INTERVALS.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                activeOpacity={0.85}
                disabled={!includeWaterOnlyAlerts}
                style={[
                  styles.waterIntervalButton,
                  waterOnlyReminderIntervalMinutes === minutes && includeWaterOnlyAlerts && styles.waterIntervalButtonActive,
                  !includeWaterOnlyAlerts && styles.waterIntervalButtonDisabled,
                ]}
                onPress={() => applyWaterReminderConfig(true, minutes)}
              >
                <Text
                  style={[
                    styles.waterIntervalText,
                    waterOnlyReminderIntervalMinutes === minutes && includeWaterOnlyAlerts && styles.waterIntervalTextActive,
                    !includeWaterOnlyAlerts && styles.waterIntervalTextDisabled,
                  ]}
                >
                  {minutes} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionHeading}>Prochaine prise</Text>
        <LiveNextIntakeCard
          alert={stats?.nextAlert ?? null}
          startedAt={startedAt}
          onConfirm={() => {
            if (stats?.nextAlert) void handleAlertAction(stats.nextAlert.id, 'confirmed');
          }}
          onSnooze={(minutes) => {
            if (stats?.nextAlert) void handleAlertAction(stats.nextAlert.id, 'snoozed', minutes);
          }}
          onSkip={() => {
            if (stats?.nextAlert) void handleAlertAction(stats.nextAlert.id, 'skipped');
          }}
        />

        <Text style={styles.sectionHeading}>Niveaux live</Text>
        {(stats?.metrics ?? []).map((metric) => (
          <LiveFuelGauge key={metric.key} metric={metric} />
        ))}

        <Text style={styles.sectionHeading}>A venir</Text>
        {(stats?.upcomingAlerts ?? []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucun rappel en attente.</Text>
          </View>
        ) : (
          stats?.upcomingAlerts.slice(0, 5).map((alert: ActiveAlert) => (
            <View key={alert.id} style={styles.listRow}>
              <Text style={styles.listTime}>{formatClock(addMinutes(startedAt, alert.triggerMinutes))}</Text>
              <View style={styles.listContent}>
                <Text style={styles.listTitle}>{alert.title}</Text>
                <Text style={styles.listDetail}>{alert.payload.detail}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionHeading}>Prises recentes</Text>
        {(stats?.recentIntakes ?? []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucune prise confirmee pour le moment.</Text>
          </View>
        ) : (
          stats?.recentIntakes.map((intake) => (
            <View key={intake.alertId} style={styles.listRow}>
              <Text style={styles.listTime}>{formatClock(new Date(intake.confirmedAt))}</Text>
              <View style={styles.listContent}>
                <Text style={styles.listTitle}>{intake.detail}</Text>
                <Text style={styles.listDetail}>
                  {Math.round(intake.carbsGrams)} g · {Math.round(intake.sodiumMg)} mg · {Math.round(intake.waterMl)} ml
                </Text>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.stopButtonText}>Arrêter la course</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 24,
    alignItems: 'center',
  },
  loadingTitle: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
  loadingPlanName: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
    marginTop: 22,
  },
  loadingProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  loadingStage: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  headerAction: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    color: Colors.brandPrimary,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroStatLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  inlineCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  inlineTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  inlineButton: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 18,
  },
  sectionHeading: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  summaryText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  waterToggleCard: {
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
    gap: 12,
  },
  waterToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waterToggleCardDisabled: {
    backgroundColor: Colors.surfaceMuted,
  },
  waterToggleCopy: {
    flex: 1,
  },
  waterToggleTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  waterToggleText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  waterToggleSwitch: {
    width: 46,
    height: 28,
    borderRadius: 999,
    padding: 3,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  waterToggleSwitchActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  waterToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textMuted,
  },
  waterToggleKnobActive: {
    backgroundColor: Colors.textOnBrand,
    transform: [{ translateX: 18 }],
  },
  waterIntervalRow: {
    flexDirection: 'row',
    gap: 8,
  },
  waterIntervalButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 9,
    alignItems: 'center',
  },
  waterIntervalButtonActive: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
  },
  waterIntervalButtonDisabled: {
    backgroundColor: Colors.surfaceMuted,
  },
  waterIntervalText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  waterIntervalTextActive: {
    color: Colors.brandPrimary,
  },
  waterIntervalTextDisabled: {
    color: Colors.textMuted,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeaderMain: {
    flex: 1,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  sectionMetaBadge: {
    backgroundColor: Colors.brandSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionMetaBadgeText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timelineRowDisabled: {
    opacity: 0.42,
  },
  timelineMinute: {
    width: 62,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  timelineMinuteText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 3,
  },
  timelineLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  timelineDetail: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  timelineTextDisabled: {
    color: Colors.textMuted,
  },
  timelineEmpty: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  bottomSpacer: {
    height: 90,
  },
  stickyFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  startButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  timeModal: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 22,
  },
  timeModalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeUnit: {
    alignItems: 'center',
  },
  timeArrow: {
    color: Colors.brandPrimary,
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  timeValue: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    minWidth: 66,
    textAlign: 'center',
  },
  timeSeparator: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    marginHorizontal: 4,
  },
  modalPrimaryButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPrimaryText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  liveHero: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 18,
  },
  liveHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveKicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  liveChrono: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  liveProgressBadge: {
    backgroundColor: Colors.brandSurface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveProgressText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  liveSummary: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  listTime: {
    width: 54,
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  listDetail: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  stopButton: {
    backgroundColor: Colors.dangerSurface,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f4c7c1',
  },
  stopButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
});

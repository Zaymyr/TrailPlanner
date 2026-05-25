import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { ProductPickerModal } from '../../components/plan-form/ProductPickerModal';
import {
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
  DEFAULT_PLAN_VALUES,
  FUEL_LABELS,
  type PlanProduct,
  type Supply,
} from '../../components/plan-form/contracts';
import { loadPlanProductsBootstrap } from '../../components/plan-form/usePlanProducts';
import { LiveFuelGauge } from '../../components/race/LiveFuelGauge';
import { LiveNextIntakeCard } from '../../components/race/LiveNextIntakeCard';
import { Button } from '../../components/themed/Button';
import { DataText } from '../../components/themed/DataText';
import { Text } from '../../components/themed/Text';
import { Colors } from '../../constants/colors';
import {
  buildFreeTrainingAlertSpecs,
  summarizeFreeTraining,
  type FreeTrainingResourceKey,
  type FreeTrainingTargets,
} from '../../lib/freeTrainingLive';
import { useI18n } from '../../lib/i18n';
import {
  checkAndFireAlerts,
  getNutritionStats,
  getSession,
  requestPermissions,
  respondToAlert,
  startFreeTraining,
  stopRace,
  type ActiveAlert,
  type AlertConfirmMode,
} from '../../lib/raceLiveSession';
import {
  DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN,
  type StoredRacePlan,
} from '../../lib/raceLivePlan';
import { supabase } from '../../lib/supabase';

const WATER_CAPACITY_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const FREE_TRAINING_PLAN_ID = 'free-training-live';

type StatsState = ReturnType<typeof getNutritionStats>;

type ProfileDefaults = {
  water_bag_liters?: number | null;
  default_carbs_g_per_hour?: number | null;
  default_water_ml_per_hour?: number | null;
  default_sodium_mg_per_hour?: number | null;
};

function sanitizeDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function parseTarget(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatDuration(totalMinutes: number | null) {
  if (totalMinutes === null) return '--';
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${safeMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function isFluidProduct(product: PlanProduct | undefined) {
  return product?.fuel_type === 'drink_mix' || product?.fuel_type === 'electrolyte';
}

function buildProductMap(products: PlanProduct[]) {
  return products.reduce<Record<string, PlanProduct>>((map, product) => {
    map[product.id] = product;
    return map;
  }, {});
}

export default function TrainingLiveScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const copy = t.trainingLive;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<PlanProduct[]>([]);
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState({
    carbs: String(DEFAULT_PLAN_VALUES.targetIntakePerHour),
    water: String(DEFAULT_PLAN_VALUES.waterIntakePerHour),
    sodium: String(DEFAULT_PLAN_VALUES.sodiumIntakePerHour),
  });
  const [waterCapacityLiters, setWaterCapacityLiters] = useState(DEFAULT_PLAN_VALUES.waterBagLiters);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSort, setPickerSort] = useState<'name' | 'carbs' | 'sodium'>('name');
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);
  const [confirmMode, setConfirmMode] = useState<AlertConfirmMode>('manual');
  const [racing, setRacing] = useState(false);
  const [startedAt, setStartedAt] = useState(new Date());
  const [stats, setStats] = useState<StatsState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const profilePromise = user?.id
          ? supabase
              .from('user_profiles')
              .select('water_bag_liters, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour')
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null });
        const [productsBootstrap, profileResult] = await Promise.all([
          loadPlanProductsBootstrap(user?.id ?? null),
          profilePromise,
        ]);

        if (cancelled) return;

        const profile = (profileResult.data ?? null) as ProfileDefaults | null;
        setAllProducts(productsBootstrap.allProducts);
        setFavoriteProductIds(new Set(productsBootstrap.favoriteProductIds));
        setTargets({
          carbs: String(Math.round(profile?.default_carbs_g_per_hour ?? DEFAULT_PLAN_VALUES.targetIntakePerHour)),
          water: String(Math.round(profile?.default_water_ml_per_hour ?? DEFAULT_PLAN_VALUES.waterIntakePerHour)),
          sodium: String(Math.round(profile?.default_sodium_mg_per_hour ?? DEFAULT_PLAN_VALUES.sodiumIntakePerHour)),
        });
        setWaterCapacityLiters(profile?.water_bag_liters ?? DEFAULT_PLAN_VALUES.waterBagLiters);

        const existingSession = getSession();
        if (existingSession?.plan.id === FREE_TRAINING_PLAN_ID) {
          setRacing(true);
          setStartedAt(new Date(existingSession.startedAt));
          setStats(getNutritionStats(existingSession));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load training setup.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const productMap = useMemo(() => buildProductMap(allProducts), [allProducts]);
  const parsedTargets = useMemo<FreeTrainingTargets>(
    () => ({
      carbsPerHour: parseTarget(targets.carbs),
      waterMlPerHour: parseTarget(targets.water),
      sodiumMgPerHour: parseTarget(targets.sodium),
    }),
    [targets],
  );
  const summary = useMemo(
    () =>
      summarizeFreeTraining({
        targets: parsedTargets,
        waterCapacityMl: waterCapacityLiters * 1000,
        supplies,
        productMap,
      }),
    [parsedTargets, productMap, supplies, waterCapacityLiters],
  );
  const alerts = useMemo(
    () =>
      buildFreeTrainingAlertSpecs({
        targets: parsedTargets,
        waterCapacityMl: waterCapacityLiters * 1000,
        supplies,
        productMap,
        waterOnlyReminderIntervalMinutes: DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN,
      }),
    [parsedTargets, productMap, supplies, waterCapacityLiters],
  );
  const currentSupplyIds = useMemo(() => new Set(supplies.map((supply) => supply.productId)), [supplies]);
  const filteredProducts = useMemo(() => {
    const search = pickerSearch.trim().toLowerCase();
    return allProducts
      .filter((product) => !search || product.name.toLowerCase().includes(search))
      .sort((left, right) => {
        if (pickerSort === 'carbs') return (right.carbs_g ?? 0) - (left.carbs_g ?? 0);
        if (pickerSort === 'sodium') return (right.sodium_mg ?? 0) - (left.sodium_mg ?? 0);
        return left.name.localeCompare(right.name, locale, { sensitivity: 'base' });
      });
  }, [allProducts, locale, pickerSearch, pickerSort]);
  const pickerFavorites = useMemo(
    () => filteredProducts.filter((product) => favoriteProductIds.has(product.id)),
    [favoriteProductIds, filteredProducts],
  );
  const fluidSupplies = useMemo(
    () => supplies.filter((supply) => isFluidProduct(productMap[supply.productId])),
    [productMap, supplies],
  );
  const solidSupplies = useMemo(
    () => supplies.filter((supply) => !isFluidProduct(productMap[supply.productId])),
    [productMap, supplies],
  );
  const activeResourceKeys = useMemo(
    () =>
      new Set<FreeTrainingResourceKey>(
        summary.resources
          .filter((resource) => resource.status === 'available')
          .map((resource) => resource.key),
      ),
    [summary.resources],
  );

  const refreshSession = useCallback(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.plan.id !== FREE_TRAINING_PLAN_ID) {
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

  const handleAddProduct = useCallback(
    (product: PlanProduct) => {
      if (isFluidProduct(product) && summary.fluidVolumeMl + DEFAULT_FLUID_PRODUCT_VOLUME_ML > summary.waterCapacityMl) {
        Alert.alert(copy.title, copy.overCapacity.replace('{ml}', String(DEFAULT_FLUID_PRODUCT_VOLUME_ML)));
        return;
      }

      setSupplies((current) => {
        if (current.some((supply) => supply.productId === product.id)) return current;
        return [...current, { productId: product.id, quantity: 1 }];
      });
    },
    [copy, summary.fluidVolumeMl, summary.waterCapacityMl],
  );

  const updateSupplyQuantity = useCallback(
    (productId: string, delta: number) => {
      const product = productMap[productId];
      if (delta > 0 && isFluidProduct(product) && summary.fluidVolumeMl + DEFAULT_FLUID_PRODUCT_VOLUME_ML > summary.waterCapacityMl) {
        Alert.alert(copy.title, copy.overCapacity.replace('{ml}', String(DEFAULT_FLUID_PRODUCT_VOLUME_ML)));
        return;
      }

      setSupplies((current) =>
        current.flatMap((supply) => {
          if (supply.productId !== productId) return [supply];
          const nextQuantity = supply.quantity + delta;
          return nextQuantity > 0 ? [{ ...supply, quantity: nextQuantity }] : [];
        }),
      );
    },
    [copy, productMap, summary.fluidVolumeMl, summary.waterCapacityMl],
  );

  const handleStart = useCallback(async () => {
    if (!summary.canStart || alerts.length === 0) {
      Alert.alert(copy.title, summary.fluidOverCapacityMl > 0 ? copy.overCapacity.replace('{ml}', String(summary.fluidOverCapacityMl)) : copy.noInventory);
      return;
    }

    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(copy.notificationsTitle, copy.notificationsBody, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: copy.notificationsSettingsCta,
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ]);
      return;
    }

    const plan: StoredRacePlan = {
      id: FREE_TRAINING_PLAN_ID,
      name: copy.sessionName,
      updatedAt: new Date().toISOString(),
      raceDistanceKm: 0,
      elevationGainM: 0,
      targetCarbsPerHour: parsedTargets.carbsPerHour,
      targetWaterPerHour: parsedTargets.waterMlPerHour,
      targetSodiumPerHour: parsedTargets.sodiumMgPerHour,
      plannerValues: {
        name: copy.sessionName,
        targetIntakePerHour: parsedTargets.carbsPerHour,
        waterIntakePerHour: parsedTargets.waterMlPerHour,
        sodiumIntakePerHour: parsedTargets.sodiumMgPerHour,
        waterBagLiters: waterCapacityLiters,
        startSupplies: supplies,
        aidStations: [],
      },
    };

    await startFreeTraining(plan, alerts, confirmMode);
    setRacing(true);
    refreshSession();
  }, [
    alerts,
    confirmMode,
    copy,
    parsedTargets,
    refreshSession,
    supplies,
    summary.canStart,
    summary.fluidOverCapacityMl,
    t.common.cancel,
    waterCapacityLiters,
  ]);

  const handleStop = useCallback(() => {
    Alert.alert(copy.stopTitle, copy.stopBody, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: copy.stop,
        style: 'destructive',
        onPress: async () => {
          await stopRace();
          setRacing(false);
          setStats(null);
        },
      },
    ]);
  }, [copy]);

  const handleAlertAction = useCallback(
    async (alertId: string, action: 'confirmed' | 'skipped' | 'snoozed', snoozeMinutes?: number) => {
      await respondToAlert(alertId, action, snoozeMinutes);
      refreshSession();
    },
    [refreshSession],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Button onPress={() => router.back()} variant="secondary">
          Retour
        </Button>
      </View>
    );
  }

  if (racing) {
    const activeMetrics = (stats?.metrics ?? []).filter((metric) => activeResourceKeys.has(metric.key));

    return (
      <>
        <Stack.Screen options={{ title: copy.title }} />
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
          <BackButton label={locale === 'fr' ? 'Retour' : 'Back'} onPress={() => router.back()} />

          <View style={styles.liveHero}>
            <View>
              <Text style={styles.kicker}>{copy.liveKicker}</Text>
              <DataText style={styles.liveChrono}>{formatDuration(stats?.elapsedMinutes ?? 0)}</DataText>
            </View>
            <Text style={styles.liveSummary}>
              {Math.round(stats?.totalCarbsConsumed ?? 0)} g glucides - {Math.round(stats?.totalWaterConsumed ?? 0)} ml eau - {Math.round(stats?.totalSodiumConsumed ?? 0)} mg sodium
            </Text>
          </View>

          <Text style={styles.sectionHeading}>{copy.nextIntake}</Text>
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

          <Text style={styles.sectionHeading}>{copy.liveLevels}</Text>
          {activeMetrics.map((metric) => (
            <LiveFuelGauge key={metric.key} metric={metric} />
          ))}

          <Text style={styles.sectionHeading}>{copy.upcoming}</Text>
          {(stats?.upcomingAlerts ?? []).length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.mutedText}>{copy.emptyUpcoming}</Text>
            </View>
          ) : (
            stats?.upcomingAlerts.slice(0, 5).map((alert: ActiveAlert) => (
              <View key={alert.id} style={styles.listRow}>
                <DataText style={styles.listTime}>{formatClock(addMinutes(startedAt, alert.triggerMinutes))}</DataText>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{alert.title}</Text>
                  <Text style={styles.mutedText}>{alert.payload.detail}</Text>
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionHeading}>{copy.recent}</Text>
          {(stats?.recentIntakes ?? []).length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.mutedText}>{copy.emptyRecent}</Text>
            </View>
          ) : (
            stats?.recentIntakes.map((intake) => (
              <View key={intake.alertId} style={styles.listRow}>
                <DataText style={styles.listTime}>{formatClock(new Date(intake.confirmedAt))}</DataText>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{intake.detail}</Text>
                  <DataText style={styles.mutedText}>
                    {Math.round(intake.carbsGrams)} g - {Math.round(intake.sodiumMg)} mg - {Math.round(intake.waterMl)} ml
                  </DataText>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <Text style={styles.stopButtonText}>{copy.stop}</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  const limitingLabels = summary.limitingKeys
    .map((key) => summary.resources.find((resource) => resource.key === key)?.label)
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Stack.Screen options={{ title: copy.title }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
        <BackButton label={locale === 'fr' ? 'Retour' : 'Back'} onPress={() => router.back()} />

        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setSettingsCollapsed((current) => !current)}
            style={styles.settingsHeader}
          >
            <View style={styles.settingsHeaderCopy}>
              <Text style={styles.sectionHeading}>{copy.targetsTitle} / {copy.waterCapacityLabel}</Text>
              <View style={styles.settingsSummaryRow}>
                <DataText style={styles.settingsSummaryPill}>{parsedTargets.carbsPerHour} g/h</DataText>
                <DataText style={styles.settingsSummaryPill}>{parsedTargets.waterMlPerHour} ml/h</DataText>
                <DataText style={styles.settingsSummaryPill}>{parsedTargets.sodiumMgPerHour} mg/h</DataText>
                <DataText style={styles.settingsSummaryPill}>{waterCapacityLiters}L</DataText>
              </View>
            </View>
            <Ionicons
              color={Colors.brandPrimary}
              name={settingsCollapsed ? 'chevron-down' : 'chevron-up'}
              size={20}
            />
          </TouchableOpacity>

          {settingsCollapsed ? null : (
            <>
              <View style={styles.settingsDivider} />
              <View style={styles.targetGrid}>
                <TargetInput label="Glucides" unit="g/h" value={targets.carbs} onChangeText={(value) => setTargets((current) => ({ ...current, carbs: sanitizeDigits(value, 3) }))} />
                <TargetInput label="Eau" unit="ml/h" value={targets.water} onChangeText={(value) => setTargets((current) => ({ ...current, water: sanitizeDigits(value, 4) }))} />
                <TargetInput label="Sodium" unit="mg/h" value={targets.sodium} onChangeText={(value) => setTargets((current) => ({ ...current, sodium: sanitizeDigits(value, 4) }))} />
              </View>
              <View style={styles.settingsDivider} />
              <Text style={styles.label}>{copy.waterCapacityLabel}</Text>
              <View style={styles.capacityRow}>
                {WATER_CAPACITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.capacityButton, waterCapacityLiters === option && styles.capacityButtonActive]}
                    onPress={() => setWaterCapacityLiters(option)}
                  >
                    <DataText style={[styles.capacityButtonText, waterCapacityLiters === option && styles.capacityButtonTextActive]}>
                      {option}L
                    </DataText>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.hintText}>{copy.waterCapacityHint}</Text>
            </>
          )}

          {summary.fluidOverCapacityMl > 0 ? (
            <Text style={styles.warningText}>{copy.overCapacity.replace('{ml}', String(summary.fluidOverCapacityMl))}</Text>
          ) : null}
          </View>

        <View style={styles.autonomyGrid}>
          <MetricCard label={copy.firstShortage} value={formatDuration(summary.firstShortageMinutes)} />
          <MetricCard label={copy.trackingEnd} value={formatDuration(summary.trackingEndMinutes)} />
        </View>
        {limitingLabels ? (
          <View style={styles.inlineNotice}>
            <Ionicons color={Colors.brandPrimary} name="alert-circle-outline" size={18} />
            <Text style={styles.inlineNoticeText}>{copy.limiting}: {limitingLabels}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.autonomyRows}>
            {summary.resources.map((resource) => (
              <View key={resource.key} style={styles.autonomyRow}>
                <Text style={styles.autonomyLabel}>{resource.label}</Text>
                <DataText style={styles.autonomyValue}>
                  {resource.status === 'ignored' ? copy.ignored : formatDuration(resource.minutes)}
                </DataText>
                <DataText style={styles.autonomyMeta}>
                  {Math.round(resource.total)} {resource.unit}
                </DataText>
              </View>
            ))}
          </View>
        </View>

        <SupplyGroup
          title={copy.fluids}
          supplies={fluidSupplies}
          productMap={productMap}
          onDecrement={(productId) => updateSupplyQuantity(productId, -1)}
          onIncrement={(productId) => updateSupplyQuantity(productId, 1)}
        />
        <SupplyGroup
          title={copy.solids}
          supplies={solidSupplies}
          productMap={productMap}
          onDecrement={(productId) => updateSupplyQuantity(productId, -1)}
          onIncrement={(productId) => updateSupplyQuantity(productId, 1)}
        />
        {supplies.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>{copy.noProducts}</Text>
          </View>
        ) : null}

        <Button onPress={() => setPickerVisible(true)} variant="secondary">
          {copy.addProduct}
        </Button>

        {!summary.canStart ? (
          <Text style={styles.warningText}>
            {summary.fluidOverCapacityMl > 0
              ? copy.overCapacity.replace('{ml}', String(summary.fluidOverCapacityMl))
              : copy.noInventory}
          </Text>
        ) : null}

        <View style={styles.confirmModeRow}>
          {[
            { value: 'manual' as const, label: copy.confirmManual },
            { value: 'auto_5' as const, label: copy.confirmAuto },
            { value: 'fire_forget' as const, label: copy.confirmSilent },
          ].map((mode) => (
            <TouchableOpacity
              key={mode.value}
              style={[styles.confirmModeButton, confirmMode === mode.value && styles.confirmModeButtonActive]}
              onPress={() => setConfirmMode(mode.value)}
            >
              <Text style={[styles.confirmModeText, confirmMode === mode.value && styles.confirmModeTextActive]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!summary.canStart || alerts.length === 0}
          onPress={handleStart}
          style={[styles.startButton, (!summary.canStart || alerts.length === 0) && styles.startButtonDisabled]}
        >
          <Ionicons color={Colors.textOnBrand} name="play" size={18} />
          <Text style={styles.startButtonText}>{copy.start}</Text>
        </TouchableOpacity>

        <ProductPickerModal
          visible={pickerVisible}
          pickerSearch={pickerSearch}
          setPickerSearch={setPickerSearch}
          pickerSort={pickerSort}
          setPickerSort={setPickerSort}
          productsLoading={false}
          pickerFavorites={pickerFavorites}
          filteredAllProducts={filteredProducts}
          currentSupplyIds={currentSupplyIds}
          fuelLabels={FUEL_LABELS}
          onClose={() => setPickerVisible(false)}
          onAddProduct={handleAddProduct}
        />
      </ScrollView>
    </>
  );
}

function TargetInput({
  label,
  unit,
  value,
  onChangeText,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.targetInputBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          value={value}
        />
        <Text style={styles.inputUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.backButton}>
      <Ionicons color={Colors.brandPrimary} name="chevron-back" size={18} />
      <Text style={styles.backButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <DataText style={styles.metricValue}>{value}</DataText>
    </View>
  );
}

function SupplyGroup({
  title,
  supplies,
  productMap,
  onIncrement,
  onDecrement,
}: {
  title: string;
  supplies: Supply[];
  productMap: Record<string, PlanProduct>;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
}) {
  if (supplies.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {supplies.map((supply) => {
        const product = productMap[supply.productId];
        if (!product) return null;
        const volumeLabel = isFluidProduct(product) ? ` - ${DEFAULT_FLUID_PRODUCT_VOLUME_ML * supply.quantity} ml` : '';
        return (
          <View key={supply.productId} style={styles.supplyRow}>
            <View style={styles.supplyCopy}>
              <Text style={styles.supplyName}>{product.name}</Text>
              <DataText style={styles.mutedText}>
                {Math.round(product.carbs_g ?? 0)} g - {Math.round(product.sodium_mg ?? 0)} mg{volumeLabel}
              </DataText>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => onDecrement(supply.productId)}>
                <Ionicons color={Colors.textPrimary} name="remove" size={16} />
              </TouchableOpacity>
              <DataText style={styles.stepperValue}>{supply.quantity}</DataText>
              <TouchableOpacity style={styles.stepperButton} onPress={() => onIncrement(supply.productId)}>
                <Ionicons color={Colors.textPrimary} name="add" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingLeft: 8,
    paddingRight: 12,
  },
  backButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
  },
  mutedText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeading: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  settingsSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingsSummaryPill: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: Colors.brandSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  targetInputBlock: {
    flexGrow: 1,
    minWidth: 120,
    gap: 8,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    paddingVertical: 12,
    minWidth: 0,
  },
  inputUnit: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  capacityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  capacityButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  capacityButtonActive: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandPrimary,
  },
  capacityButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  capacityButtonTextActive: {
    color: Colors.textOnBrand,
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  warningText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  autonomyGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.brandSurface,
    padding: 15,
    gap: 4,
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: Colors.brandPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  inlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineNoticeText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  autonomyRows: {
    gap: 10,
  },
  autonomyRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autonomyLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  autonomyValue: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  autonomyMeta: {
    minWidth: 62,
    textAlign: 'right',
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  supplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    padding: 12,
  },
  supplyCopy: {
    flex: 1,
    gap: 3,
  },
  supplyName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 22,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  confirmModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmModeButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  confirmModeButtonActive: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  confirmModeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  confirmModeTextActive: {
    color: Colors.brandPrimary,
  },
  startButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: Colors.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonDisabled: {
    opacity: 0.46,
  },
  startButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '800',
  },
  liveHero: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 8,
  },
  liveChrono: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  liveSummary: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  listTime: {
    width: 54,
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  stopButton: {
    backgroundColor: Colors.dangerSurface,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f4c7c1',
  },
  stopButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
});

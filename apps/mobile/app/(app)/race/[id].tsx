import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import {
  requestPermissions,
  startRace,
  stopRace,
  getSession,
  respondToAlert,
  checkAndFireAlerts,
  getNutritionStats,
  type ActiveAlert as ServiceActiveAlert,
} from '../../../lib/raceAlertService';
import RaceStartConfig, { type RaceConfig } from '../../../components/RaceStartConfig';
import { NutritionGauge } from '../../../components/NutritionGauge';
import { NextIntakeCard } from '../../../components/NextIntakeCard';

type ActiveAlert = ServiceActiveAlert;

type AidStationProduct = {
  name: string;
  quantity: number;
  carbsGrams: number;
  sodiumMg: number;
};

type AidStation = {
  name: string;
  distanceKm: number;
  waterRefill?: boolean;
  segmentPlan?: {
    carbsGrams: number;
    waterMl: number;
    sodiumMg: number;
    durationMinutes: number;
    distanceKm: number;
    gelsCount?: number;
    products?: AidStationProduct[];
  };
};

type PlannerValues = {
  raceDistanceKm: number;
  elevationGain: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  paceMinutes?: number;
  paceSeconds?: number;
  aidStations: AidStation[];
};

type RacePlan = {
  id: string;
  name: string;
  updatedAt: string;
  raceDistanceKm: number;
  elevationGainM: number;
  targetCarbsPerHour: number;
  targetWaterPerHour: number;
  targetSodiumPerHour: number;
  aidStations: any[];
  plannerValues: PlannerValues;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0min';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `~${m}min`;
  if (m === 0) return `~${h}h`;
  return `~${h}h${String(m).padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<RacePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [racing, setRacing] = useState(false);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({
    elapsedMinutes: 0,
    totalCarbsConsumed: 0,
    totalSodiumConsumed: 0,
    totalWaterConsumed: 0,
    targetCarbsTotal: 0,
    targetSodiumTotal: 0,
    lastHourCarbs: 0,
    lastHourSodium: 0,
    targetCarbsPerHour: 0,
    targetSodiumPerHour: 0,
    nextAlert: null as ActiveAlert | null,
  });
  const [departureTime, setDepartureTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(new Date().getHours());
  const [pickerMinute, setPickerMinute] = useState(new Date().getMinutes());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch plan
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('race_plans')
        .select('id, name, created_at, updated_at, planner_values, elevation_profile')
        .eq('id', id)
        .single();

      if (data) {
        const pv: PlannerValues = data.planner_values ?? {};
        setPlan({
          id: data.id,
          name: data.name,
          updatedAt: data.updated_at,
          raceDistanceKm: pv.raceDistanceKm ?? 0,
          elevationGainM: pv.elevationGain ?? 0,
          targetCarbsPerHour: pv.targetIntakePerHour ?? 0,
          targetWaterPerHour: pv.waterIntakePerHour ?? 0,
          targetSodiumPerHour: pv.sodiumIntakePerHour ?? 0,
          aidStations: pv.aidStations ?? [],
          plannerValues: pv,
        });
      }
      setLoading(false);
    })();
  }, [id]);

  // Check for existing session on mount
  useEffect(() => {
    const existing = getSession();
    if (existing) {
      setRacing(true);
      setAlerts([...existing.alerts]);
      setStats(getNutritionStats(existing));
    }
  }, []);

  // Timer for elapsed + alert checks while racing
  useEffect(() => {
    if (!racing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(async () => {
      const session = getSession();
      if (!session) return;

      setElapsed(Date.now() - session.startedAt);
      await checkAndFireAlerts();
      setAlerts([...session.alerts]);
    }, 5_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [racing]);

  // Stats refresh every 30 seconds
  useEffect(() => {
    if (!racing) return;
    const interval = setInterval(() => {
      const s = getSession();
      if (s) setStats(getNutritionStats(s));
    }, 30_000);
    return () => clearInterval(interval);
  }, [racing]);

  const handleStart = useCallback(async (config: RaceConfig) => {
    if (!plan) return;

    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        'Notifications requises',
        'Activez les notifications pour recevoir les alertes nutrition pendant la course.',
      );
      return;
    }

    await startRace(plan, config.timingMode, config.confirmMode);
    setRacing(true);

    const session = getSession();
    if (session) setAlerts([...session.alerts]);
  }, [plan]);

  const handleStop = useCallback(() => {
    Alert.alert('Arrêter la course ?', 'Les alertes seront désactivées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: async () => {
          await stopRace();
          setRacing(false);
          setAlerts([]);
          setElapsed(0);
        },
      },
    ]);
  }, []);

  const handleAlertAction = useCallback(
    async (
      alertId: string,
      action: 'confirmed' | 'skipped' | 'snoozed',
      snoozeMin?: number,
    ) => {
      await respondToAlert(alertId, action, snoozeMin);
      const s = getSession();
      if (s) {
        setAlerts([...s.alerts]);
        setStats(getNutritionStats(s));
      }
    },
    [],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Plan introuvable</Text>
      </View>
    );
  }

  // ─── Pre-race view ──────────────────────────────────────────────────────

  if (!racing) {
    const pv = plan.plannerValues;
    const stations: AidStation[] = pv.aidStations ?? [];

    // Build segment data — each station marks the END of a segment
    const segments = stations.map((station, idx) => {
      const prevStation = idx === 0 ? null : stations[idx - 1];
      const fromName = idx === 0 ? 'Départ' : prevStation!.name;
      const fromKm = idx === 0 ? 0 : (prevStation!.distanceKm ?? 0);
      const toKm = station.distanceKm ?? 0;
      const sp = station.segmentPlan;
      return {
        fromName,
        toName: station.name,
        fromKm,
        toKm,
        segmentKm: sp?.distanceKm ?? toKm - fromKm,
        durationMin: sp?.durationMinutes ?? 0,
        carbsG: sp?.carbsGrams ?? 0,
        waterMl: sp?.waterMl ?? 0,
        sodiumMg: sp?.sodiumMg ?? 0,
        products: sp?.products ?? [],
        gelsCount: sp?.gelsCount ?? 0,
        waterRefill: station.waterRefill ?? false,
      };
    });

    // Calculate cumulative ETAs
    let cumMinutes = 0;
    const segmentETAs = segments.map((seg) => {
      const startETA = addMinutes(departureTime, cumMinutes);
      cumMinutes += seg.durationMin;
      const endETA = addMinutes(departureTime, cumMinutes);
      return { startETA, endETA };
    });

    const totalDurationMin = segments.reduce((sum, s) => sum + s.durationMin, 0);

    return (
      <>
        <Stack.Screen
          options={{
            title: plan.name,
            headerRight: () => (
              <TouchableOpacity onPress={() => router.push(`/(app)/plan/${id}/edit`)}>
                <Text style={{ color: '#22c55e', fontSize: 15, fontWeight: '600', marginRight: 4 }}>
                  Modifier
                </Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.screenContainer}>
          <ScrollView contentContainerStyle={styles.container}>
            {/* 1. Header card */}
            <View style={styles.card}>
              <Text style={styles.planTitle}>{plan.name}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{plan.raceDistanceKm} km</Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{plan.elevationGainM}m</Text>
                  <Text style={styles.statLabel}>D+</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatDuration(totalDurationMin)}</Text>
                  <Text style={styles.statLabel}>Durée estimée</Text>
                </View>
              </View>
            </View>

            {/* 2. Departure time selector */}
            <View style={styles.departureRow}>
              <Text style={styles.sectionTitle}>Heure de départ</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => {
                  setPickerHour(departureTime.getHours());
                  setPickerMinute(departureTime.getMinutes());
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.timeButtonText}>🕐 {formatTime(departureTime)}</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Nutrition totals summary */}
            {segments.length > 0 && (() => {
              const totalCarbs = segments.reduce((s, seg) => s + seg.carbsG, 0);
              const totalWater = segments.reduce((s, seg) => s + seg.waterMl, 0);
              const totalSodium = segments.reduce((s, seg) => s + seg.sodiumMg, 0);
              return (
                <View style={styles.nutritionSummary}>
                  <Text style={styles.sectionTitle}>Nutrition totale</Text>
                  <View style={styles.nutritionChips}>
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{totalCarbs}g</Text>
                      <Text style={styles.nutritionChipLabel}>Glucides</Text>
                    </View>
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{totalWater}ml</Text>
                      <Text style={styles.nutritionChipLabel}>Eau</Text>
                    </View>
                    <View style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipValue}>{totalSodium}mg</Text>
                      <Text style={styles.nutritionChipLabel}>Sodium</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* 4. Segments */}
            {segments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucun ravito défini dans ce plan.</Text>
              </View>
            ) : (
              segments.map((seg, idx) => (
                <View key={idx} style={styles.segmentCard}>
                  <View style={styles.segmentHeader}>
                    <Text style={styles.segmentTitle}>
                      {idx === 0 ? '🏁' : '🚩'} {seg.fromName} → {seg.toName}
                    </Text>
                    {seg.waterRefill && (
                      <View style={styles.refillBadge}>
                        <Text style={styles.refillText}>🚰 Remplissage</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.segmentMeta}>
                    📍 {seg.fromKm} km → {seg.toKm} km   ⏱ {formatDuration(seg.durationMin)}
                  </Text>
                  <Text style={styles.segmentETA}>
                    ETA : {formatTime(segmentETAs[idx].startETA)} → {formatTime(segmentETAs[idx].endETA)}
                  </Text>
                  <View style={styles.segmentDivider} />
                  <View style={styles.nutritionRow}>
                    <Text style={styles.nutritionItem}>🍬 {seg.carbsG}g glucides</Text>
                    <Text style={styles.nutritionItem}>💧 {seg.waterMl}ml</Text>
                    <Text style={styles.nutritionItem}>🧂 {seg.sodiumMg}mg</Text>
                  </View>
                  {seg.products.length > 0 ? (
                    <View style={styles.productsContainer}>
                      {seg.products.map((p, pi) => (
                        <Text key={pi} style={styles.productText}>
                          📦 {p.quantity}x {p.name}
                        </Text>
                      ))}
                    </View>
                  ) : seg.gelsCount > 0 ? (
                    <Text style={styles.productText}>📦 {seg.gelsCount}x gel</Text>
                  ) : null}
                </View>
              ))
            )}

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* 4. Sticky bottom: start button */}
          <View style={styles.stickyBottom}>
            <TouchableOpacity style={styles.startButton} onPress={() => setShowConfig(true)}>
              <Text style={styles.startButtonText}>▶ Démarrer la course</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Race start config modal */}
        <RaceStartConfig
          visible={showConfig}
          raceName={plan.name}
          onStart={async (config) => {
            setShowConfig(false);
            await handleStart(config);
          }}
          onCancel={() => setShowConfig(false)}
        />

        {/* Time picker modal */}
        <Modal visible={showTimePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Heure de départ</Text>
              <View style={styles.timePickerRow}>
                <View style={styles.timeUnit}>
                  <TouchableOpacity onPress={() => setPickerHour((h) => (h + 1) % 24)}>
                    <Text style={styles.timeArrow}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{String(pickerHour).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => setPickerHour((h) => (h - 1 + 24) % 24)}>
                    <Text style={styles.timeArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.timeUnit}>
                  <TouchableOpacity onPress={() => setPickerMinute((m) => (m + 5) % 60)}>
                    <Text style={styles.timeArrow}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{String(pickerMinute).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => setPickerMinute((m) => (m - 5 + 60) % 60)}>
                    <Text style={styles.timeArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  const d = new Date();
                  d.setHours(pickerHour, pickerMinute, 0, 0);
                  setDepartureTime(d);
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.modalConfirmText}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ─── Racing view ─────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: plan.name }} />
      <ScrollView style={styles.screenContainer} contentContainerStyle={styles.container}>

        {/* 1. Header chrono + stats globales */}
        <View style={styles.raceHeader}>
          <View style={styles.chronoRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusDot}>🟢</Text>
              <Text style={styles.statusText}>Course en cours</Text>
            </View>
            <Text style={styles.chrono}>{formatElapsed(elapsed)}</Text>
          </View>
          <Text style={styles.raceSubtitle}>
            {Math.round(stats.totalCarbsConsumed)}g glucides consommés · {Math.round(stats.totalWaterConsumed)}ml eau
          </Text>
        </View>

        {/* 2. Prochaine prise mise en avant */}
        <Text style={styles.dashSectionTitle}>PROCHAINE PRISE</Text>
        <NextIntakeCard
          alert={stats.nextAlert}
          departureTime={departureTime}
          onConfirm={() => {
            if (stats.nextAlert) handleAlertAction(stats.nextAlert.id, 'confirmed');
          }}
          onSnooze={(min) => {
            if (stats.nextAlert) handleAlertAction(stats.nextAlert.id, 'snoozed', min);
          }}
          onSkip={() => {
            if (stats.nextAlert) handleAlertAction(stats.nextAlert.id, 'skipped');
          }}
        />

        {/* 3. Jauges glucides + sodium */}
        <Text style={styles.dashSectionTitle}>NUTRITION</Text>
        <NutritionGauge
          label="Glucides"
          icon="🍬"
          consumed={stats.totalCarbsConsumed}
          target={stats.targetCarbsTotal}
          unit="g"
          lastHourConsumed={stats.lastHourCarbs}
          lastHourTarget={stats.targetCarbsPerHour}
        />
        <NutritionGauge
          label="Sodium"
          icon="🧂"
          consumed={stats.totalSodiumConsumed}
          target={stats.targetSodiumTotal}
          unit="mg"
          lastHourConsumed={stats.lastHourSodium}
          lastHourTarget={stats.targetSodiumPerHour}
        />

        {/* 4. Bouton stop */}
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.stopButtonText}>⏹ Arrêter la course</Text>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 20,
    paddingBottom: 16,
  },

  // Nutrition summary
  nutritionSummary: {
    marginBottom: 20,
  },
  nutritionChips: {
    flexDirection: 'row',
    gap: 10,
  },
  nutritionChip: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nutritionChipValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 2,
  },
  nutritionChipLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Header card
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Departure time
  departureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  timeButton: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeButtonText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },

  // Segment cards
  segmentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  segmentTitle: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  refillBadge: {
    backgroundColor: '#0c4a6e',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  refillText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentMeta: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 2,
  },
  segmentETA: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
  },
  segmentDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 10,
  },
  nutritionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  nutritionItem: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  productsContainer: {
    marginTop: 4,
    gap: 2,
  },
  productText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },

  // Sticky bottom
  stickyBottom: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 10,
  },
  // Start button
  startButton: {
    backgroundColor: '#22c55e',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },

  // Time picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '80%',
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 4,
  },
  timeArrow: {
    color: '#22c55e',
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  timeValue: {
    color: '#f1f5f9',
    fontSize: 38,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'center',
  },
  timeSeparator: {
    color: '#f1f5f9',
    fontSize: 38,
    fontWeight: '700',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  modalConfirm: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalConfirmText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancel: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 14,
  },

  // Racing dashboard
  raceHeader: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chronoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    fontSize: 16,
  },
  statusText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 15,
  },
  chrono: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 22,
  },
  raceSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
  },
  dashSectionTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },

  // Stop button
  stopButton: {
    backgroundColor: '#7f1d1d',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  stopButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
});

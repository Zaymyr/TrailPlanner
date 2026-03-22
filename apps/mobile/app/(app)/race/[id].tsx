import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import {
  requestPermissions,
  startRace,
  stopRace,
  getSession,
  respondToAlert,
  checkAndFireAlerts,
} from '../../../lib/raceAlertService';
type AlertTimingMode = 'time' | 'gps' | 'auto';
type AlertStatus = 'pending' | 'snoozed' | 'confirmed' | 'skipped';
type FuelAlert = {
  id: string;
  triggerMinutes?: number;
  triggerDistanceKm?: number;
  title: string;
  body: string;
  payload: any;
};
type ActiveAlert = FuelAlert & {
  status: AlertStatus;
  snoozedUntilMinutes?: number;
  respondedAt?: string;
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
};

// ─── Mode descriptions ──────────────────────────────────────────────────────

const MODE_DESCRIPTIONS: Record<AlertTimingMode, string> = {
  time: 'Les alertes se déclenchent selon le temps écoulé, calculé à partir de votre allure cible.',
  gps: 'Les alertes se déclenchent selon la distance GPS parcourue.',
  auto: 'Combine temps et GPS : l\'alerte se déclenche dès que l\'un des deux seuils est atteint.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
}

function alertBorderColor(status: ActiveAlert['status']): string {
  switch (status) {
    case 'pending':
      return '#f59e0b';
    case 'snoozed':
      return '#6366f1';
    case 'confirmed':
      return '#22c55e';
    case 'skipped':
      return '#475569';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<RacePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AlertTimingMode>('auto');
  const [racing, setRacing] = useState(false);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [elapsed, setElapsed] = useState(0);
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
        const pv = data.planner_values ?? {};
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
        } as RacePlan);
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

  const handleStart = useCallback(async () => {
    if (!plan) return;

    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        'Notifications requises',
        'Activez les notifications pour recevoir les alertes nutrition pendant la course.',
      );
      return;
    }

    await startRace(plan, mode);
    setRacing(true);

    const session = getSession();
    if (session) setAlerts([...session.alerts]);
  }, [plan, mode]);

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
      const session = getSession();
      if (session) setAlerts([...session.alerts]);
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

  const confirmedCount = alerts.filter((a) => a.status === 'confirmed').length;
  const pendingCount = alerts.filter(
    (a) => a.status === 'pending' || a.status === 'snoozed',
  ).length;

  // ─── Pre-race view ──────────────────────────────────────────────────────

  if (!racing) {
    const stationCount = plan.aidStations?.length ?? 0;

    return (
      <>
        <Stack.Screen options={{ title: plan.name }} />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.planTitle}>{plan.name}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {plan.raceDistanceKm} km
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {plan.elevationGainM}m
                </Text>
                <Text style={styles.statLabel}>D+</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stationCount}</Text>
                <Text style={styles.statLabel}>Ravitos</Text>
              </View>
            </View>
          </View>

          {/* Mode selector */}
          <Text style={styles.sectionTitle}>Mode d'alerte</Text>
          <View style={styles.modeRow}>
            {(['time', 'gps', 'auto'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.modePill,
                  mode === m && styles.modePillActive,
                ]}
                onPress={() => setMode(m)}
              >
                <Text
                  style={[
                    styles.modePillText,
                    mode === m && styles.modePillTextActive,
                  ]}
                >
                  {m === 'time' ? '⏱ Temps' : m === 'gps' ? '📍 GPS' : '🔀 Auto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modeDescription}>{MODE_DESCRIPTIONS[mode]}</Text>

          {/* Start button */}
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>▶ Démarrer la course</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  // ─── Racing view ─────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: plan.name }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Status badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusDot}>🟢</Text>
          <Text style={styles.statusText}>Course en cours</Text>
          <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
        </View>

        {/* Counters */}
        <View style={styles.countersRow}>
          <Text style={styles.counterText}>✅ {confirmedCount} faits</Text>
          <Text style={styles.counterText}>⏳ {pendingCount} à venir</Text>
        </View>

        {/* Alert list */}
        {alerts.map((alert) => {
          const borderColor = alertBorderColor(alert.status);
          const dimmed =
            alert.status === 'confirmed' || alert.status === 'skipped';

          return (
            <View
              key={alert.id}
              style={[
                styles.alertCard,
                { borderLeftColor: borderColor, borderLeftWidth: 4 },
                dimmed && styles.alertDimmed,
              ]}
            >
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertBody}>{alert.body}</Text>

              {alert.status === 'snoozed' && alert.snoozedUntilMinutes != null && (
                <Text style={styles.snoozedLabel}>
                  😴 Snoozé jusqu'à {Math.round(alert.snoozedUntilMinutes)} min
                </Text>
              )}

              {(alert.status === 'pending' || alert.status === 'snoozed') && (
                <View style={styles.alertActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleAlertAction(alert.id, 'confirmed')}
                  >
                    <Text style={styles.actionBtnText}>✅</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleAlertAction(alert.id, 'skipped')}
                  >
                    <Text style={styles.actionBtnText}>⏭</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.snoozeBtn]}
                    onPress={() => handleAlertAction(alert.id, 'snoozed', 5)}
                  >
                    <Text style={styles.actionBtnText}>😴 5</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Stop button */}
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
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  // Pre-race card
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
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

  // Mode selector
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  modePillActive: {
    backgroundColor: '#14532d',
  },
  modePillText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 15,
  },
  modePillTextActive: {
    color: '#22c55e',
  },
  modeDescription: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 18,
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

  // Racing status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  statusDot: {
    fontSize: 16,
  },
  statusText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  elapsed: {
    color: '#f1f5f9',
    fontWeight: '600',
    fontSize: 16,
  },

  // Counters
  countersRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  counterText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500',
  },

  // Alert cards
  alertCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  alertDimmed: {
    opacity: 0.5,
  },
  alertTitle: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  alertBody: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  snoozedLabel: {
    color: '#6366f1',
    fontSize: 13,
    marginBottom: 8,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  snoozeBtn: {
    backgroundColor: '#312e81',
  },
  actionBtnText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
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

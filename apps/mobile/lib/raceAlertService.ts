import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';

import {
  buildAlertSchedule as buildAlertScheduleShared,
  getAlertsToFire,
  type RacePlan as SharedRacePlan,
  type ActiveAlert as SharedActiveAlert,
  type AlertTimingMode,
  SNOOZE_OPTIONS_MINUTES,
} from './shared';

// ─── Local types ──────────────────────────────────────────────────────────────

export type ActiveAlert = SharedActiveAlert & {
  respondedAt?: string;
};

type IntakeRecord = {
  alertId: string;
  confirmedAt: number;
  carbsGrams: number;
  sodiumMg: number;
  waterMl: number;
  products: Array<{ name: string; quantity: number; carbsGrams: number; sodiumMg: number }>;
};

type PlannerValues = {
  paceType?: 'pace' | 'speed';
  paceMinutes?: number;
  paceSeconds?: number;
  speedKph?: number;
  waterBagLiters?: number;
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
  plannerValues?: PlannerValues;
};

// ─── Adapter: local flat plan → canonical nested plan ────────────────────────

function adaptToSharedPlan(plan: RacePlan): SharedRacePlan {
  const pv = plan.plannerValues ?? {};
  const minutesPerKm =
    pv.paceType === 'speed' && pv.speedKph && pv.speedKph > 0
      ? 60 / pv.speedKph
      : (pv.paceMinutes ?? 6) + (pv.paceSeconds ?? 0) / 60;
  const paceMinutesFloor = Math.floor(minutesPerKm);
  const paceSecondsRem = Math.round((minutesPerKm - paceMinutesFloor) * 60);

  return {
    id: plan.id,
    name: plan.name,
    createdAt: plan.updatedAt,
    updatedAt: plan.updatedAt,
    plannerValues: {
      raceDistanceKm: plan.raceDistanceKm,
      elevationGain: plan.elevationGainM,
      targetIntakePerHour: plan.targetCarbsPerHour,
      waterIntakePerHour: plan.targetWaterPerHour,
      sodiumIntakePerHour: plan.targetSodiumPerHour,
      waterBagLiters: pv.waterBagLiters ?? 1.5,
      paceMinutes: paceMinutesFloor,
      paceSeconds: paceSecondsRem,
      aidStations: plan.aidStations ?? [],
    },
    elevationProfile: [],
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RACE_ALERT_TASK = 'RACE_ALERT_TASK';
const RACE_LOCATION_TASK = 'RACE_LOCATION_TASK';
const NOTIFICATION_CATEGORY = 'FUEL_ALERT';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertConfirmMode =
  | 'manual'
  | 'auto_5'
  | 'auto_10'
  | 'fire_forget';

export type RaceSession = {
  plan: RacePlan;
  mode: AlertTimingMode;
  confirmMode: AlertConfirmMode;
  startedAt: number; // Date.now() ms
  alerts: ActiveAlert[];
  cumulativeKm: number;
  lastLocation?: { latitude: number; longitude: number };
  intakeHistory: IntakeRecord[];
};

// ─── Haversine helper ────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Singleton state ─────────────────────────────────────────────────────────

let session: RaceSession | null = null;

// ─── Notification category setup ─────────────────────────────────────────────

async function setupNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY, [
    ...SNOOZE_OPTIONS_MINUTES.map((min) => ({
      identifier: `snooze_${min}`,
      buttonTitle: `😴 ${min}min`,
      options: { isDestructive: false, isAuthenticationRequired: false },
    })),
    {
      identifier: 'confirm',
      buttonTitle: '✅ C\'est fait',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'skip',
      buttonTitle: '⏭ Passer',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

// ─── Fire a single alert notification ────────────────────────────────────────

async function fireAlertNotification(
  alert: ActiveAlert,
  confirmMode: AlertConfirmMode,
): Promise<void> {
  if (confirmMode === 'fire_forget' || confirmMode === 'auto_5' || confirmMode === 'auto_10') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.title,
        body: alert.body,
        data: { alertId: alert.id, payload: alert.payload },
        sound: true,
      },
      trigger: null,
    });
    return;
  }

  // Manual mode: notification with action buttons
  await Notifications.scheduleNotificationAsync({
    content: {
      title: alert.title,
      body: alert.body,
      categoryIdentifier: NOTIFICATION_CATEGORY,
      data: { alertId: alert.id },
    },
    trigger: null, // fire immediately
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  await setupNotificationCategory();
  return true;
}

export async function startRace(
  plan: RacePlan,
  mode: AlertTimingMode,
  confirmMode: AlertConfirmMode = 'manual',
): Promise<void> {
  // Build alerts using the canonical time-based formula from shared.ts.
  // This fixes both: (1) distance-proportional nutrition and (2) missing triggerMinutes.
  const sharedAlerts = buildAlertScheduleShared(adaptToSharedPlan(plan), mode);

  // Enrich each alert payload with products from the aid station segment plans.
  // The canonical buildAlertSchedule doesn't include products in the payload,
  // but respondToAlert needs them to log intake history.
  const sortedStations = [...(plan.aidStations ?? [])].sort(
    (a: any, b: any) => a.distanceKm - b.distanceKm,
  );
  const waypoints: any[] = [
    { name: 'Départ', distanceKm: 0 },
    ...sortedStations,
    { name: 'Arrivée', distanceKm: plan.raceDistanceKm },
  ];

  const activeAlerts: ActiveAlert[] = sharedAlerts.map((a, i) => ({
    ...a,
    payload: {
      ...a.payload,
      products: waypoints[i + 1]?.segmentPlan?.products ?? [],
    },
    status: 'pending' as const,
  }));

  session = {
    plan,
    mode,
    confirmMode,
    startedAt: Date.now(),
    alerts: activeAlerts,
    cumulativeKm: 0,
    intakeHistory: [],
  };

  // Register background alert task
  // NOTE: Background fetch does not run on iOS Simulator — test on a real device.
  await BackgroundFetch.registerTaskAsync(RACE_ALERT_TASK, {
    minimumInterval: 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  // Register location task for GPS mode
  if (mode === 'gps' || mode === 'auto') {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const { status: bgStatus } =
        await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        await Location.startLocationUpdatesAsync(RACE_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 200, // every 200m
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Pace Yourself',
            notificationBody: 'Course en cours — suivi GPS actif',
            notificationColor: '#22c55e',
          },
        });
      }
    }
  }

  // Confirmation notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏁 Course démarrée',
      body: `${plan.name} — ${plan.raceDistanceKm} km`,
    },
    trigger: null,
  });
}

export async function stopRace(): Promise<void> {
  session = null;

  await BackgroundFetch.unregisterTaskAsync(RACE_ALERT_TASK).catch(() => {});

  const isLocationRegistered =
    await TaskManager.isTaskRegisteredAsync(RACE_LOCATION_TASK);
  if (isLocationRegistered) {
    await Location.stopLocationUpdatesAsync(RACE_LOCATION_TASK).catch(
      () => {},
    );
  }
}

export function getSession(): RaceSession | null {
  return session;
}

export async function respondToAlert(
  alertId: string,
  response: 'confirmed' | 'skipped' | 'snoozed',
  snoozeMinutes?: number,
): Promise<void> {
  if (!session) return;

  const alert = session.alerts.find((a) => a.id === alertId);
  if (!alert) return;

  if (response === 'snoozed' && snoozeMinutes) {
    const elapsed = (Date.now() - session.startedAt) / 60_000;
    alert.status = 'snoozed';
    alert.snoozedUntilMinutes = elapsed + snoozeMinutes;
  } else {
    alert.status = response;
  }

  if (response === 'confirmed' && alert.payload) {
    session.intakeHistory.push({
      alertId,
      confirmedAt: Date.now(),
      carbsGrams: (alert.payload.carbsGrams as number) ?? 0,
      sodiumMg: (alert.payload.sodiumMg as number) ?? 0,
      waterMl: (alert.payload.waterMl as number) ?? 0,
      products: ((alert.payload.products as any[]) ?? []).map((p: any) => ({
        name: p.name,
        quantity: p.quantity,
        carbsGrams: p.carbsGrams ?? 0,
        sodiumMg: p.sodiumMg ?? 0,
      })),
    });
  }
}

export function getNutritionStats(s: RaceSession): {
  elapsedMinutes: number;
  totalCarbsConsumed: number;
  totalSodiumConsumed: number;
  totalWaterConsumed: number;
  targetCarbsTotal: number;
  targetSodiumTotal: number;
  lastHourCarbs: number;
  lastHourSodium: number;
  targetCarbsPerHour: number;
  targetSodiumPerHour: number;
  nextAlert: ActiveAlert | null;
} {
  const elapsedMinutes = (Date.now() - s.startedAt) / 60_000;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  const totalCarbsConsumed = s.intakeHistory.reduce((acc, r) => acc + r.carbsGrams, 0);
  const totalSodiumConsumed = s.intakeHistory.reduce((acc, r) => acc + r.sodiumMg, 0);
  const totalWaterConsumed = s.intakeHistory.reduce((acc, r) => acc + r.waterMl, 0);

  const lastHourCarbs = s.intakeHistory
    .filter(r => r.confirmedAt >= oneHourAgo)
    .reduce((acc, r) => acc + r.carbsGrams, 0);

  const lastHourSodium = s.intakeHistory
    .filter(r => r.confirmedAt >= oneHourAgo)
    .reduce((acc, r) => acc + r.sodiumMg, 0);

  const targetCarbsTotal = (elapsedMinutes / 60) * s.plan.targetCarbsPerHour;
  const targetSodiumTotal = (elapsedMinutes / 60) * s.plan.targetSodiumPerHour;

  const nextAlert = s.alerts.find(a => a.status === 'pending' || a.status === 'snoozed') ?? null;

  return {
    elapsedMinutes,
    totalCarbsConsumed,
    totalSodiumConsumed,
    totalWaterConsumed,
    targetCarbsTotal,
    targetSodiumTotal,
    lastHourCarbs,
    lastHourSodium,
    targetCarbsPerHour: s.plan.targetCarbsPerHour,
    targetSodiumPerHour: s.plan.targetSodiumPerHour,
    nextAlert,
  };
}

export async function checkAndFireAlerts(
  currentKm?: number,
): Promise<void> {
  if (!session) return;

  if (currentKm != null) {
    session.cumulativeKm = currentKm;
  }

  const elapsedMinutes = (Date.now() - session.startedAt) / 60_000;
  const { confirmMode } = session;

  // Auto-confirm alerts that have been pending/snoozed long enough
  if (confirmMode === 'auto_5' || confirmMode === 'auto_10') {
    const autoConfirmDelay = confirmMode === 'auto_5' ? 5 : 10;
    session.alerts = session.alerts.map((alert) => {
      if (alert.status !== 'pending' && alert.status !== 'snoozed') return alert;
      if (alert.triggerMinutes === undefined) return alert;
      const minutesSinceTrigger = elapsedMinutes - alert.triggerMinutes;
      if (minutesSinceTrigger >= autoConfirmDelay) {
        return { ...alert, status: 'confirmed' as const, respondedAt: new Date().toISOString() };
      }
      return alert;
    });
  }

  if (confirmMode === 'fire_forget') {
    // Mark as confirmed immediately after the trigger time passes
    session.alerts = session.alerts.map((alert) => {
      if (alert.status !== 'pending') return alert;
      if (alert.triggerMinutes !== undefined && elapsedMinutes >= alert.triggerMinutes) {
        return { ...alert, status: 'confirmed' as const, respondedAt: new Date().toISOString() };
      }
      return alert;
    });
  }

  const toFire = getAlertsToFire(
    session.alerts,
    elapsedMinutes,
    session.cumulativeKm,
  );

  for (const alert of toFire) {
    await fireAlertNotification(alert, confirmMode);
    // Mark as snoozed briefly to avoid re-firing on the next tick.
    // The user's response (confirm/skip/snooze) will update the real status.
    alert.status = 'snoozed';
    alert.snoozedUntilMinutes = elapsedMinutes + 2;
  }
}

// ─── Background task definitions ─────────────────────────────────────────────
// These must be defined at module scope (top-level) for expo-task-manager.

TaskManager.defineTask(RACE_ALERT_TASK, async () => {
  await checkAndFireAlerts();
  return session
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.NoData;
});

TaskManager.defineTask(
  RACE_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error || !data || !session) return;

    const { locations } = data;
    if (!locations || locations.length === 0) return;

    const latest = locations[locations.length - 1];
    const { latitude, longitude } = latest.coords;

    if (session.lastLocation) {
      const delta = haversineKm(
        session.lastLocation.latitude,
        session.lastLocation.longitude,
        latitude,
        longitude,
      );
      session.cumulativeKm += delta;
    }

    session.lastLocation = { latitude, longitude };
    await checkAndFireAlerts(session.cumulativeKm);
  },
);

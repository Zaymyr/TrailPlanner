import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';

// ─── Inline types & constants ────────────────────────────────────────────────

const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;

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

// ─── Alert schedule builder ───────────────────────────────────────────────────

function buildAlertSchedule(
  plan: RacePlan,
  mode: AlertTimingMode,
): FuelAlert[] {
  const alerts: FuelAlert[] = [];
  const stations = [...(plan.aidStations ?? [])].sort(
    (a: any, b: any) => a.distanceKm - b.distanceKm,
  );

  const waypoints: Array<{ name: string; distanceKm: number }> = [
    { name: 'Départ', distanceKm: 0 },
    ...stations,
    { name: 'Arrivée', distanceKm: plan.raceDistanceKm },
  ];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i] as any;
    const to = waypoints[i + 1] as any;
    const segmentDistanceKm = to.distanceKm - from.distanceKm;
    const fraction = plan.raceDistanceKm > 0
      ? segmentDistanceKm / plan.raceDistanceKm
      : 0;

    const carbsGrams = Math.round(plan.targetCarbsPerHour * fraction);
    const waterMl = Math.round(plan.targetWaterPerHour * fraction);
    const sodiumMg = Math.round(plan.targetSodiumPerHour * fraction);

    const alert: FuelAlert = {
      id: `seg-${i}`,
      title: `Seg ${i + 1} → ${to.name}`,
      body: `🍬 ${carbsGrams}g glucides · 💧 ${waterMl}ml eau · 🧂 ${sodiumMg}mg sodium`,
      payload: { fromName: from.name, toName: to.name, segmentDistanceKm },
    };

    if (mode === 'gps' || mode === 'auto') {
      alert.triggerDistanceKm = from.distanceKm;
    }

    alerts.push(alert);
  }

  return alerts;
}

function getAlertsToFire(
  alerts: ActiveAlert[],
  elapsedMinutes: number,
  elapsedKm?: number,
): ActiveAlert[] {
  return alerts.filter((alert) => {
    if (alert.status === 'confirmed' || alert.status === 'skipped') {
      return false;
    }

    if (alert.status === 'snoozed') {
      return (
        alert.snoozedUntilMinutes != null &&
        elapsedMinutes >= alert.snoozedUntilMinutes
      );
    }

    // status === 'pending'
    const timeTriggered =
      alert.triggerMinutes != null && elapsedMinutes >= alert.triggerMinutes;
    const gpsTriggered =
      alert.triggerDistanceKm != null &&
      elapsedKm != null &&
      elapsedKm >= alert.triggerDistanceKm;

    return timeTriggered || gpsTriggered;
  });
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
  alert: FuelAlert,
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
  const alerts = buildAlertSchedule(plan, mode);
  const activeAlerts: ActiveAlert[] = alerts.map((a) => ({
    ...a,
    status: 'pending' as const,
  }));

  session = {
    plan,
    mode,
    confirmMode,
    startedAt: Date.now(),
    alerts: activeAlerts,
    cumulativeKm: 0,
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

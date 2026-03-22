import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import {
  RacePlan,
  AlertTimingMode,
  ActiveAlert,
  FuelAlert,
  buildAlertSchedule,
  getAlertsToFire,
  SNOOZE_OPTIONS_MINUTES,
} from './shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const RACE_ALERT_TASK = 'RACE_ALERT_TASK';
const RACE_LOCATION_TASK = 'RACE_LOCATION_TASK';
const NOTIFICATION_CATEGORY = 'FUEL_ALERT';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RaceSession = {
  plan: RacePlan;
  mode: AlertTimingMode;
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

async function fireAlertNotification(alert: FuelAlert): Promise<void> {
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
): Promise<void> {
  const alerts = buildAlertSchedule(plan, mode);
  const activeAlerts: ActiveAlert[] = alerts.map((a) => ({
    ...a,
    status: 'pending' as const,
  }));

  session = {
    plan,
    mode,
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
      body: `${plan.name} — ${plan.plannerValues.raceDistanceKm} km`,
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
  const toFire = getAlertsToFire(
    session.alerts,
    elapsedMinutes,
    session.cumulativeKm,
  );

  for (const alert of toFire) {
    await fireAlertNotification(alert);
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

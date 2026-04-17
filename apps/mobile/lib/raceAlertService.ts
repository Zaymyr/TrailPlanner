import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  buildAlertSchedule as buildAlertScheduleShared,
  getAlertsToFire,
  SNOOZE_OPTIONS_MINUTES,
  type ActiveAlert as SharedActiveAlert,
  type AlertTimingMode,
  type RacePlan as SharedRacePlan,
} from './shared';

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

const RACE_ALERT_TASK = 'RACE_ALERT_TASK';
const NOTIFICATION_CATEGORY = 'FUEL_ALERT';
// expo-background-task relies on OS schedulers and does not support the old 60s cadence.
// Keep the smallest supported interval here and let the foreground checks handle fine-grained timing.
const RACE_ALERT_TASK_MINIMUM_INTERVAL_MINUTES = 15;

export type AlertConfirmMode = 'manual' | 'auto_5' | 'auto_10' | 'fire_forget';

export type RaceSession = {
  plan: RacePlan;
  mode: AlertTimingMode;
  confirmMode: AlertConfirmMode;
  startedAt: number;
  alerts: ActiveAlert[];
  intakeHistory: IntakeRecord[];
};

let session: RaceSession | null = null;

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

async function setupNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY, [
    ...SNOOZE_OPTIONS_MINUTES.map((minutes) => ({
      identifier: `snooze_${minutes}`,
      buttonTitle: `+${minutes} min`,
      options: { isDestructive: false, isAuthenticationRequired: false },
    })),
    {
      identifier: 'confirm',
      buttonTitle: "C'est fait",
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'skip',
      buttonTitle: 'Passer',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

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

  await Notifications.scheduleNotificationAsync({
    content: {
      title: alert.title,
      body: alert.body,
      categoryIdentifier: NOTIFICATION_CATEGORY,
      data: { alertId: alert.id },
      sound: true,
    },
    trigger: null,
  });
}

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
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
  const sharedAlerts = buildAlertScheduleShared(adaptToSharedPlan(plan), mode);
  const sortedStations = [...(plan.aidStations ?? [])].sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  const waypoints: any[] = [
    { name: 'Depart', distanceKm: 0 },
    ...sortedStations,
    { name: 'Arrivee', distanceKm: plan.raceDistanceKm },
  ];

  session = {
    plan,
    mode,
    confirmMode,
    startedAt: Date.now(),
    alerts: sharedAlerts.map((alert, index) => ({
      ...alert,
      payload: {
        ...alert.payload,
        products: waypoints[index + 1]?.segmentPlan?.products ?? [],
      },
      status: 'pending',
    })),
    intakeHistory: [],
  };

  await BackgroundTask.registerTaskAsync(RACE_ALERT_TASK, {
    minimumInterval: RACE_ALERT_TASK_MINIMUM_INTERVAL_MINUTES,
  }).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Course démarrée',
      body: `${plan.name} - suivi horaire actif`,
    },
    trigger: null,
  });
}

export async function stopRace(): Promise<void> {
  session = null;
  await BackgroundTask.unregisterTaskAsync(RACE_ALERT_TASK).catch(() => undefined);
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

  const alert = session.alerts.find((candidate) => candidate.id === alertId);
  if (!alert) return;

  if (response === 'snoozed' && snoozeMinutes) {
    const elapsedMinutes = (Date.now() - session.startedAt) / 60_000;
    alert.status = 'snoozed';
    alert.snoozedUntilMinutes = elapsedMinutes + snoozeMinutes;
    return;
  }

  alert.status = response;
  alert.respondedAt = new Date().toISOString();

  if (response === 'confirmed' && alert.payload) {
    session.intakeHistory.push({
      alertId,
      confirmedAt: Date.now(),
      carbsGrams: (alert.payload.carbsGrams as number) ?? 0,
      sodiumMg: (alert.payload.sodiumMg as number) ?? 0,
      waterMl: (alert.payload.waterMl as number) ?? 0,
      products: ((alert.payload.products as any[]) ?? []).map((product: any) => ({
        name: product.name,
        quantity: product.quantity,
        carbsGrams: product.carbsGrams ?? 0,
        sodiumMg: product.sodiumMg ?? 0,
      })),
    });
  }
}

export function getNutritionStats(currentSession: RaceSession): {
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
  const elapsedMinutes = (Date.now() - currentSession.startedAt) / 60_000;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  const totalCarbsConsumed = currentSession.intakeHistory.reduce((sum, intake) => sum + intake.carbsGrams, 0);
  const totalSodiumConsumed = currentSession.intakeHistory.reduce((sum, intake) => sum + intake.sodiumMg, 0);
  const totalWaterConsumed = currentSession.intakeHistory.reduce((sum, intake) => sum + intake.waterMl, 0);

  const lastHourCarbs = currentSession.intakeHistory
    .filter((intake) => intake.confirmedAt >= oneHourAgo)
    .reduce((sum, intake) => sum + intake.carbsGrams, 0);

  const lastHourSodium = currentSession.intakeHistory
    .filter((intake) => intake.confirmedAt >= oneHourAgo)
    .reduce((sum, intake) => sum + intake.sodiumMg, 0);

  return {
    elapsedMinutes,
    totalCarbsConsumed,
    totalSodiumConsumed,
    totalWaterConsumed,
    targetCarbsTotal: (elapsedMinutes / 60) * currentSession.plan.targetCarbsPerHour,
    targetSodiumTotal: (elapsedMinutes / 60) * currentSession.plan.targetSodiumPerHour,
    lastHourCarbs,
    lastHourSodium,
    targetCarbsPerHour: currentSession.plan.targetCarbsPerHour,
    targetSodiumPerHour: currentSession.plan.targetSodiumPerHour,
    nextAlert: currentSession.alerts.find((alert) => alert.status === 'pending' || alert.status === 'snoozed') ?? null,
  };
}

export async function checkAndFireAlerts(): Promise<void> {
  if (!session) return;

  const elapsedMinutes = (Date.now() - session.startedAt) / 60_000;
  const { confirmMode } = session;

  if (confirmMode === 'auto_5' || confirmMode === 'auto_10') {
    const autoConfirmDelay = confirmMode === 'auto_5' ? 5 : 10;
    session.alerts = session.alerts.map((alert) => {
      if (alert.status !== 'pending' && alert.status !== 'snoozed') return alert;
      if (alert.triggerMinutes === undefined) return alert;
      if (elapsedMinutes - alert.triggerMinutes < autoConfirmDelay) return alert;
      return { ...alert, status: 'confirmed', respondedAt: new Date().toISOString() };
    });
  }

  if (confirmMode === 'fire_forget') {
    session.alerts = session.alerts.map((alert) => {
      if (alert.status !== 'pending') return alert;
      if (alert.triggerMinutes === undefined || elapsedMinutes < alert.triggerMinutes) return alert;
      return { ...alert, status: 'confirmed', respondedAt: new Date().toISOString() };
    });
  }

  const alertsToFire = getAlertsToFire(session.alerts, elapsedMinutes);
  for (const alert of alertsToFire) {
    await fireAlertNotification(alert, confirmMode);
    alert.status = 'snoozed';
    alert.snoozedUntilMinutes = elapsedMinutes + 2;
  }
}

TaskManager.defineTask(RACE_ALERT_TASK, async () => {
  try {
    await checkAndFireAlerts();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

import type { PlanProduct } from '../components/plan-form/contracts';
import {
  buildLiveAlertSpecs,
  buildLiveMetrics,
  DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN,
  isWaterOnlyAlertSpec,
  type LiveAlertSpec,
  type LiveMetricState,
  type StoredRacePlan,
  type WaterOnlyReminderIntervalMinutes,
} from './raceLivePlan';

const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;
const RACE_ALERT_TASK = 'RACE_ALERT_TASK';
const NOTIFICATION_CATEGORY = 'FUEL_ALERT';

export type ActiveAlert = LiveAlertSpec & {
  status: 'pending' | 'snoozed' | 'confirmed' | 'skipped';
  firedAt?: string;
  respondedAt?: string;
  snoozedUntilMinutes?: number;
};

type IntakeRecord = {
  alertId: string;
  confirmedAt: number;
  carbsGrams: number;
  sodiumMg: number;
  waterMl: number;
  detail: string;
  products: Array<{ name: string; quantity: number; carbsGrams: number; sodiumMg: number; waterMl: number }>;
};

export type AlertConfirmMode = 'manual' | 'auto_5' | 'auto_10' | 'fire_forget';

type RaceStartOptions = {
  includeWaterOnlyAlerts?: boolean;
  waterOnlyReminderIntervalMinutes?: WaterOnlyReminderIntervalMinutes;
};

export type RaceSession = {
  plan: StoredRacePlan;
  confirmMode: AlertConfirmMode;
  waterOnlyReminderIntervalMinutes: WaterOnlyReminderIntervalMinutes | null;
  startedAt: number;
  alerts: ActiveAlert[];
  intakeHistory: IntakeRecord[];
};

let session: RaceSession | null = null;

async function setupNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY, [
    ...SNOOZE_OPTIONS_MINUTES.map((minutes) => ({
      identifier: `snooze_${minutes}`,
      buttonTitle: `+${minutes} min`,
      options: { isDestructive: false, isAuthenticationRequired: false },
    })),
    {
      identifier: 'confirm',
      buttonTitle: 'Fait',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'skip',
      buttonTitle: 'Passer',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

async function fireAlertNotification(alert: ActiveAlert, confirmMode: AlertConfirmMode): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: alert.title,
      body: alert.body,
      categoryIdentifier: confirmMode === 'manual' ? NOTIFICATION_CATEGORY : undefined,
      data: { alertId: alert.id },
      sound: true,
    },
    trigger: null,
  });
}

function getElapsedMinutes(startedAt: number) {
  return (Date.now() - startedAt) / 60_000;
}

function getUpcomingAlerts(alerts: ActiveAlert[]) {
  return alerts
    .filter((alert) => alert.status === 'pending' || alert.status === 'snoozed')
    .sort((left, right) => {
      const leftMinute =
        left.status === 'snoozed' ? (left.snoozedUntilMinutes ?? left.triggerMinutes) : left.triggerMinutes;
      const rightMinute =
        right.status === 'snoozed' ? (right.snoozedUntilMinutes ?? right.triggerMinutes) : right.triggerMinutes;
      return leftMinute - rightMinute;
    });
}

function recordIntake(alert: ActiveAlert) {
  if (!session || session.intakeHistory.some((entry) => entry.alertId === alert.id)) return;

  session.intakeHistory.push({
    alertId: alert.id,
    confirmedAt: Date.now(),
    carbsGrams: alert.payload.carbsGrams ?? 0,
    sodiumMg: alert.payload.sodiumMg ?? 0,
    waterMl: alert.payload.waterMl ?? 0,
    detail: alert.payload.detail,
    products: alert.payload.products,
  });
}

function getAlertsToFire(alerts: ActiveAlert[], elapsedMinutes: number) {
  return alerts.filter((alert) => alert.status === 'pending' && elapsedMinutes >= alert.triggerMinutes);
}

function toPendingActiveAlert(alert: LiveAlertSpec): ActiveAlert {
  return {
    ...alert,
    status: 'pending',
  };
}

function applyAutoConfirm(sessionToUpdate: RaceSession, elapsedMinutes: number) {
  if (sessionToUpdate.confirmMode !== 'auto_5' && sessionToUpdate.confirmMode !== 'auto_10') return;

  sessionToUpdate.alerts.forEach((alert) => {
    if (alert.status !== 'snoozed') return;
    if ((alert.snoozedUntilMinutes ?? Number.POSITIVE_INFINITY) > elapsedMinutes) return;
    if (alert.respondedAt) return;

    alert.status = 'confirmed';
    alert.respondedAt = new Date().toISOString();
    recordIntake(alert);
  });
}

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  await setupNotificationCategory();
  return true;
}

export async function startRace(
  plan: StoredRacePlan,
  productMap: Record<string, PlanProduct>,
  confirmMode: AlertConfirmMode = 'manual',
  options: RaceStartOptions = {},
): Promise<void> {
  const waterOnlyReminderIntervalMinutes =
    options.includeWaterOnlyAlerts === false
      ? null
      : (options.waterOnlyReminderIntervalMinutes ?? DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN);
  const alerts = buildLiveAlertSpecs(plan, productMap, {
    waterOnlyReminderIntervalMinutes: waterOnlyReminderIntervalMinutes ?? DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN,
  })
    .filter((alert) => waterOnlyReminderIntervalMinutes !== null || !isWaterOnlyAlertSpec(alert))
    .map<ActiveAlert>(toPendingActiveAlert);

  session = {
    plan,
    confirmMode,
    waterOnlyReminderIntervalMinutes,
    startedAt: Date.now(),
    alerts,
    intakeHistory: [],
  };

  await BackgroundFetch.registerTaskAsync(RACE_ALERT_TASK, {
    minimumInterval: 60,
    stopOnTerminate: false,
    startOnBoot: true,
  }).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Course démarrée',
      body: `${plan.name} - suivi nutrition actif`,
    },
    trigger: null,
  });
}

export async function stopRace(): Promise<void> {
  session = null;
  await BackgroundFetch.unregisterTaskAsync(RACE_ALERT_TASK).catch(() => undefined);
}

export function getSession(): RaceSession | null {
  return session;
}

export function updateWaterOnlyAlertSchedule(
  productMap: Record<string, PlanProduct>,
  waterOnlyReminderIntervalMinutes: WaterOnlyReminderIntervalMinutes | null,
): void {
  if (!session) return;

  const elapsedMinutes = getElapsedMinutes(session.startedAt);
  const alertsToKeep = session.alerts.filter(
    (alert) => alert.status !== 'pending' || alert.firedAt || alert.triggerMinutes <= elapsedMinutes,
  );
  const keptAlertIds = new Set(alertsToKeep.map((alert) => alert.id));
  const futureAlerts = buildLiveAlertSpecs(session.plan, productMap, {
    waterOnlyReminderIntervalMinutes: waterOnlyReminderIntervalMinutes ?? DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN,
  })
    .filter((alert) => waterOnlyReminderIntervalMinutes !== null || !isWaterOnlyAlertSpec(alert))
    .filter((alert) => alert.triggerMinutes > elapsedMinutes && !keptAlertIds.has(alert.id))
    .map<ActiveAlert>(toPendingActiveAlert);

  session.waterOnlyReminderIntervalMinutes = waterOnlyReminderIntervalMinutes;
  session.alerts = [...alertsToKeep, ...futureAlerts].sort((left, right) => {
    if (left.triggerMinutes !== right.triggerMinutes) return left.triggerMinutes - right.triggerMinutes;
    return left.id.localeCompare(right.id);
  });
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
    alert.status = 'snoozed';
    alert.snoozedUntilMinutes = getElapsedMinutes(session.startedAt) + snoozeMinutes;
    return;
  }

  alert.status = response;
  alert.respondedAt = new Date().toISOString();

  if (response === 'confirmed') {
    recordIntake(alert);
  }
}

export function getNutritionStats(currentSession: RaceSession): {
  elapsedMinutes: number;
  totalCarbsConsumed: number;
  totalSodiumConsumed: number;
  totalWaterConsumed: number;
  metrics: LiveMetricState[];
  nextAlert: ActiveAlert | null;
  upcomingAlerts: ActiveAlert[];
  recentIntakes: IntakeRecord[];
  completedCount: number;
  totalCount: number;
  waterOnlyReminderIntervalMinutes: WaterOnlyReminderIntervalMinutes | null;
} {
  const elapsedMinutes = getElapsedMinutes(currentSession.startedAt);
  const totalCarbsConsumed = currentSession.intakeHistory.reduce((sum, intake) => sum + intake.carbsGrams, 0);
  const totalSodiumConsumed = currentSession.intakeHistory.reduce((sum, intake) => sum + intake.sodiumMg, 0);
  const totalWaterConsumed = currentSession.intakeHistory.reduce((sum, intake) => sum + intake.waterMl, 0);
  const metrics = buildLiveMetrics({
    plan: currentSession.plan,
    elapsedMinutes,
    totalCarbsConsumed,
    totalSodiumConsumed,
    totalWaterConsumed,
  });
  const upcomingAlerts = getUpcomingAlerts(currentSession.alerts);

  return {
    elapsedMinutes,
    totalCarbsConsumed,
    totalSodiumConsumed,
    totalWaterConsumed,
    metrics,
    nextAlert: upcomingAlerts[0] ?? null,
    upcomingAlerts: upcomingAlerts.slice(0, 6),
    recentIntakes: [...currentSession.intakeHistory]
      .sort((left, right) => right.confirmedAt - left.confirmedAt)
      .slice(0, 6),
    completedCount: currentSession.intakeHistory.length,
    totalCount: currentSession.alerts.length,
    waterOnlyReminderIntervalMinutes: currentSession.waterOnlyReminderIntervalMinutes,
  };
}

export async function checkAndFireAlerts(): Promise<void> {
  if (!session) return;

  const elapsedMinutes = getElapsedMinutes(session.startedAt);
  applyAutoConfirm(session, elapsedMinutes);

  const alertsToFire = getAlertsToFire(session.alerts, elapsedMinutes);
  for (const alert of alertsToFire) {
    await fireAlertNotification(alert, session.confirmMode);
    alert.firedAt = new Date().toISOString();

    if (session.confirmMode === 'fire_forget') {
      alert.status = 'confirmed';
      alert.respondedAt = alert.firedAt;
      recordIntake(alert);
      continue;
    }

    if (session.confirmMode === 'auto_5' || session.confirmMode === 'auto_10') {
      const autoDelay = session.confirmMode === 'auto_5' ? 5 : 10;
      alert.status = 'snoozed';
      alert.snoozedUntilMinutes = elapsedMinutes + autoDelay;
      continue;
    }

    alert.status = 'snoozed';
    alert.snoozedUntilMinutes = elapsedMinutes + 2;
  }
}

TaskManager.defineTask(RACE_ALERT_TASK, async () => {
  await checkAndFireAlerts();
  return session ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
});

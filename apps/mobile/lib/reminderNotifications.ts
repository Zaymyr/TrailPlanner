import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const REMINDER_NOTIFICATIONS_STORAGE_KEY = 'trailplanner.reminderNotifications';
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
const DEFAULT_UNFINISHED_PLAN_DELAY_MS = 24 * 60 * 60 * 1000;

type ReminderNotificationsState = {
  inactivityNotificationId: string | null;
  unfinishedPlanReminder: {
    notificationId: string;
    planId: string;
  } | null;
};

type ReminderPermissionOptions = {
  requestIfNeeded?: boolean;
};

type PlannerSupply = {
  productId?: string;
  quantity?: number;
};

type PlannerAidStation = {
  supplies?: PlannerSupply[] | null;
};

type PlannerValuesLike = {
  startSupplies?: PlannerSupply[] | null;
  aidStations?: PlannerAidStation[] | null;
};

type ReminderCopy = {
  title: string;
  body: string;
};

type PlanReminderCandidate = {
  id: string;
  name: string;
  updated_at?: string | null;
  planner_values?: PlannerValuesLike | null;
};

const DEFAULT_STATE: ReminderNotificationsState = {
  inactivityNotificationId: null,
  unfinishedPlanReminder: null,
};

async function readState(): Promise<ReminderNotificationsState> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as Partial<ReminderNotificationsState> | null;
    return {
      inactivityNotificationId: parsed?.inactivityNotificationId ?? null,
      unfinishedPlanReminder: parsed?.unfinishedPlanReminder ?? null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(nextState: ReminderNotificationsState): Promise<void> {
  await AsyncStorage.setItem(REMINDER_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(nextState));
}

async function cancelScheduledNotification(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

async function ensureReminderPermissions({
  requestIfNeeded = false,
}: ReminderPermissionOptions = {}): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }

  if (!requestIfNeeded) {
    return false;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function getSupplyCount(plannerValues?: PlannerValuesLike | null): number {
  const startSupplies = Array.isArray(plannerValues?.startSupplies) ? plannerValues.startSupplies : [];
  const aidStations = Array.isArray(plannerValues?.aidStations) ? plannerValues.aidStations : [];
  const aidStationSupplyCount = aidStations.reduce((sum, station) => {
    const supplies = Array.isArray(station?.supplies) ? station.supplies : [];
    return sum + supplies.length;
  }, 0);

  return startSupplies.length + aidStationSupplyCount;
}

function scheduleDateFromDelay(delayMs: number): Date {
  return new Date(Date.now() + delayMs);
}

async function scheduleReminderNotification({
  title,
  body,
  href,
  reminderType,
  planId,
  delayMs,
}: ReminderCopy & {
  href: string;
  reminderType: 'inactivity' | 'unfinished-plan';
  planId?: string;
  delayMs: number;
}): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: {
        href,
        reminderType,
        planId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduleDateFromDelay(delayMs),
    },
  });
}

export function isPlanReminderNeeded(plannerValues?: PlannerValuesLike | null): boolean {
  return getSupplyCount(plannerValues) === 0;
}

export async function refreshInactivityReminder({
  title,
  body,
  href,
  delayMs = THREE_DAYS_MS,
  requestIfNeeded = false,
}: ReminderCopy & {
  href: string;
  delayMs?: number;
  requestIfNeeded?: boolean;
}): Promise<boolean> {
  const hasPermission = await ensureReminderPermissions({ requestIfNeeded });
  if (!hasPermission) {
    return false;
  }

  const currentState = await readState();
  await cancelScheduledNotification(currentState.inactivityNotificationId);

  const notificationId = await scheduleReminderNotification({
    title,
    body,
    href,
    reminderType: 'inactivity',
    delayMs,
  });

  await writeState({
    ...currentState,
    inactivityNotificationId: notificationId,
  });

  return true;
}

export async function clearInactivityReminder(): Promise<void> {
  const currentState = await readState();
  await cancelScheduledNotification(currentState.inactivityNotificationId);
  await writeState({
    ...currentState,
    inactivityNotificationId: null,
  });
}

export async function clearUnfinishedPlanReminder(planId?: string | null): Promise<void> {
  const currentState = await readState();
  const activeReminder = currentState.unfinishedPlanReminder;

  if (!activeReminder) {
    return;
  }

  if (planId && activeReminder.planId !== planId) {
    return;
  }

  await cancelScheduledNotification(activeReminder.notificationId);
  await writeState({
    ...currentState,
    unfinishedPlanReminder: null,
  });
}

export async function syncUnfinishedPlanReminder({
  planId,
  plannerValues,
  title,
  body,
  href,
  delayMs = DEFAULT_UNFINISHED_PLAN_DELAY_MS,
  requestIfNeeded = false,
}: ReminderCopy & {
  planId: string;
  plannerValues?: PlannerValuesLike | null;
  href: string;
  delayMs?: number;
  requestIfNeeded?: boolean;
}): Promise<boolean> {
  if (!isPlanReminderNeeded(plannerValues)) {
    await clearUnfinishedPlanReminder(planId);
    return false;
  }

  const hasPermission = await ensureReminderPermissions({ requestIfNeeded });
  if (!hasPermission) {
    return false;
  }

  const currentState = await readState();
  await cancelScheduledNotification(currentState.unfinishedPlanReminder?.notificationId);

  const notificationId = await scheduleReminderNotification({
    title,
    body,
    href,
    reminderType: 'unfinished-plan',
    planId,
    delayMs,
  });

  await writeState({
    ...currentState,
    unfinishedPlanReminder: {
      notificationId,
      planId,
    },
  });

  return true;
}

export async function syncLatestUnfinishedPlanReminder(
  plans: PlanReminderCandidate[],
  {
    title,
    buildBody,
    hrefForPlan,
    requestIfNeeded = false,
    delayMs = DEFAULT_UNFINISHED_PLAN_DELAY_MS,
  }: {
    title: string;
    buildBody: (planName: string) => string;
    hrefForPlan: (planId: string) => string;
    requestIfNeeded?: boolean;
    delayMs?: number;
  },
): Promise<boolean> {
  const latestIncompletePlan = [...plans]
    .filter((plan) => isPlanReminderNeeded(plan.planner_values))
    .sort((left, right) => {
      const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
      const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;
      return rightTime - leftTime;
    })[0];

  if (!latestIncompletePlan) {
    await clearUnfinishedPlanReminder();
    return false;
  }

  return syncUnfinishedPlanReminder({
    planId: latestIncompletePlan.id,
    plannerValues: latestIncompletePlan.planner_values,
    title,
    body: buildBody(latestIncompletePlan.name),
    href: hrefForPlan(latestIncompletePlan.id),
    delayMs,
    requestIfNeeded,
  });
}

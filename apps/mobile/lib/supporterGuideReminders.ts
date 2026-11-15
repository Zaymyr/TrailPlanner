import AsyncStorage from '@react-native-async-storage/async-storage';

import { getNotificationsModule } from './notifications';
import { toLocalDate, type SupporterGuideTimelineEntry } from './supporterGuide';

/**
 * Local reminders for the Livret accompagnateur: scheduled on the device only
 * (no server, no account), 30 minutes before a programme entry. Stored per
 * edition so they can be re-timed when the organizer republishes and cancelled
 * when an entry disappears.
 */
export const SUPPORTER_REMINDER_LEAD_MINUTES = 30;

type StoredReminder = { notificationId: string; triggerAt: string };
type StoredReminders = Record<string, StoredReminder>;

const storageKey = (editionId: string) => `supporterGuide:reminders:${editionId}`;

export type ReminderCopy = {
  title: (entry: SupporterGuideTimelineEntry) => string;
  body: (entry: SupporterGuideTimelineEntry) => string;
};

async function readStored(editionId: string): Promise<StoredReminders> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(editionId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as StoredReminders : {};
  } catch {
    return {};
  }
}

async function writeStored(editionId: string, reminders: StoredReminders) {
  try {
    await AsyncStorage.setItem(storageKey(editionId), JSON.stringify(reminders));
  } catch {
    // Reminders stay scheduled even if their bookkeeping cannot be saved.
  }
}

export function reminderTriggerDate(entry: SupporterGuideTimelineEntry): Date | null {
  const at = toLocalDate(entry.date, entry.time);
  return at ? new Date(at.getTime() - SUPPORTER_REMINDER_LEAD_MINUTES * 60_000) : null;
}

export async function loadReminderIds(editionId: string): Promise<Set<string>> {
  return new Set(Object.keys(await readStored(editionId)));
}

/** Asks for permission only when the supporter taps a bell. */
export async function ensureReminderPermission(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

async function scheduleOne(entry: SupporterGuideTimelineEntry, href: string, copy: ReminderCopy): Promise<StoredReminder | null> {
  const Notifications = await getNotificationsModule();
  const triggerAt = reminderTriggerDate(entry);
  if (!Notifications || !triggerAt || triggerAt.getTime() <= Date.now()) return null;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: copy.title(entry), body: copy.body(entry), sound: true, data: { href, supporterGuideEntryId: entry.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt },
  });
  return { notificationId, triggerAt: triggerAt.toISOString() };
}

async function cancelOne(reminder: StoredReminder) {
  const Notifications = await getNotificationsModule();
  await Notifications?.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => undefined);
}

/** Adds the reminders that do not exist yet; returns how many were scheduled. */
export async function addReminders(
  editionId: string,
  entries: readonly SupporterGuideTimelineEntry[],
  href: string,
  copy: ReminderCopy,
): Promise<number> {
  const stored = await readStored(editionId);
  let added = 0;
  for (const entry of entries) {
    if (stored[entry.id]) continue;
    const reminder = await scheduleOne(entry, href, copy);
    if (reminder) {
      stored[entry.id] = reminder;
      added += 1;
    }
  }
  await writeStored(editionId, stored);
  return added;
}

export async function removeReminder(editionId: string, entryId: string): Promise<void> {
  const stored = await readStored(editionId);
  const reminder = stored[entryId];
  if (!reminder) return;
  await cancelOne(reminder);
  delete stored[entryId];
  await writeStored(editionId, stored);
}

/**
 * Re-times reminders after a republication and drops the ones whose entry no
 * longer exists or is already past. Returns the active entry ids.
 */
export async function syncReminders(
  editionId: string,
  entries: readonly SupporterGuideTimelineEntry[],
  href: string,
  copy: ReminderCopy,
): Promise<Set<string>> {
  const stored = await readStored(editionId);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  let changed = false;
  for (const [entryId, reminder] of Object.entries(stored)) {
    const entry = byId.get(entryId);
    const triggerAt = entry ? reminderTriggerDate(entry) : null;
    if (!entry || !triggerAt || triggerAt.getTime() <= Date.now()) {
      await cancelOne(reminder);
      delete stored[entryId];
      changed = true;
      continue;
    }
    if (triggerAt.toISOString() !== reminder.triggerAt) {
      await cancelOne(reminder);
      const next = await scheduleOne(entry, href, copy);
      if (next) stored[entryId] = next;
      else delete stored[entryId];
      changed = true;
    }
  }
  if (changed) await writeStored(editionId, stored);
  return new Set(Object.keys(stored));
}

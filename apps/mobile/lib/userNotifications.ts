import { supabase } from './supabase';

export type UserNotificationKind = 'admin_message' | 'race_request_status';

export type UserNotification = {
  id: string;
  userId: string;
  raceRequestId: number | null;
  kind: UserNotificationKind;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type UserNotificationRow = {
  id: string;
  user_id: string;
  race_request_id: number | null;
  kind: UserNotificationKind;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_SELECT =
  'id,user_id,race_request_id,kind,title,body,read_at,created_at';
const unreadListeners = new Set<(count: number) => void>();
let cachedUnreadCount = 0;

function emitUnreadCount(count: number) {
  cachedUnreadCount = Math.max(0, count);
  for (const listener of unreadListeners) listener(cachedUnreadCount);
}

function mapRow(row: UserNotificationRow): UserNotification {
  return {
    id: row.id,
    userId: row.user_id,
    raceRequestId: row.race_request_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function addUnreadNotificationCountListener(listener: (count: number) => void) {
  unreadListeners.add(listener);
  listener(cachedUnreadCount);
  return () => {
    unreadListeners.delete(listener);
  };
}

export function resetUnreadNotificationCount() {
  emitUnreadCount(0);
}

export async function loadUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  const nextCount = count ?? 0;
  emitUnreadCount(nextCount);
  return nextCount;
}

export async function loadUserNotifications(input: {
  userId: string;
  page: number;
  pageSize?: number;
}): Promise<UserNotification[]> {
  const pageSize = input.pageSize ?? 20;
  const from = input.page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from('user_notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return ((data ?? []) as UserNotificationRow[]).map(mapRow);
}

export async function loadUserNotificationById(input: {
  userId: string;
  notificationId: string;
}): Promise<UserNotification | null> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', input.userId)
    .eq('id', input.notificationId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as UserNotificationRow) : null;
}

export async function markUserNotificationRead(input: {
  userId: string;
  notificationId: string;
  readAt?: string;
}) {
  const readAt = input.readAt ?? new Date().toISOString();
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: readAt })
    .eq('user_id', input.userId)
    .eq('id', input.notificationId)
    .is('read_at', null);

  if (error) throw error;
  emitUnreadCount(Math.max(0, cachedUnreadCount - 1));
  return readAt;
}

export async function markAllUserNotificationsRead(userId: string) {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  emitUnreadCount(0);
  return readAt;
}

export function mergeUserNotificationPages(
  current: UserNotification[],
  incoming: UserNotification[],
) {
  const byId = new Map<string, UserNotification>();
  for (const notification of [...current, ...incoming]) {
    byId.set(notification.id, notification);
  }
  return [...byId.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function setNotificationsRead(
  notifications: UserNotification[],
  ids: ReadonlySet<string>,
  readAt: string,
) {
  return notifications.map((notification) =>
    ids.has(notification.id) && !notification.readAt
      ? { ...notification, readAt }
      : notification,
  );
}

export function shouldOpenNotificationsTab(
  tab: string | undefined,
  notificationId: string | undefined,
) {
  return tab === 'notifications' || Boolean(notificationId);
}

export function shouldShowProfileAttentionDot(input: {
  hasPendingOnboarding: boolean;
  hasUnreadNotifications: boolean;
}) {
  return input.hasPendingOnboarding || input.hasUnreadNotifications;
}

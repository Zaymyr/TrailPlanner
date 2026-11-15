import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing } from '@pace-yourself/design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { FeedbackHeaderButton } from '../feedback/FeedbackHeaderButton';
import { RaceRequestHeaderButton } from '../race/RaceRequestHeaderButton';
import {
  deleteUserNotification,
  loadUserNotificationById,
  loadUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  mergeUserNotificationPages,
  removeUserNotification,
  setNotificationsRead,
  type UserNotification,
} from '../../lib/userNotifications';
import { Button } from '../themed/Button';
import { Card } from '../themed/Card';
import { EmptyState } from '../themed/EmptyState';
import { ErrorState } from '../themed/ErrorState';
import { LoadingState } from '../themed/LoadingState';
import { Text } from '../themed/Text';

type Copy = {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
  loadFailed: string;
  refresh: string;
  markAllRead: string;
  markingAllRead: string;
  loadMore: string;
  loadingMore: string;
  unreadLabel: string;
  raceRequestLabel: string;
  adminMessageLabel: string;
  expand: string;
  collapse: string;
  contactTitle: string;
  contactBody: string;
  reportBug: string;
  sendFeedback: string;
  requestRace: string;
  feedbackReplyLabel: string;
  delete: string;
  deleteTitle: string;
  deleteBody: string;
  deleteFailed: string;
  cancel: string;
};

/** Bug, feedback and race request forms, so the runner writes to us where our replies arrive. */
function ContactActions({ copy }: { copy: Copy }) {
  return (
    <Card style={styles.contactCard}>
      <Text weight="bold">{copy.contactTitle}</Text>
      <Text size="sm" tone="secondary">{copy.contactBody}</Text>
      <View style={styles.contactButtons}>
        <FeedbackHeaderButton contextLabel="Notifications" initialKind="bug">
          {(open) => (
            <Button onPress={open} style={styles.contactButton} variant="secondary">{copy.reportBug}</Button>
          )}
        </FeedbackHeaderButton>
        <FeedbackHeaderButton contextLabel="Notifications" initialKind="feedback">
          {(open) => (
            <Button onPress={open} style={styles.contactButton} variant="secondary">{copy.sendFeedback}</Button>
          )}
        </FeedbackHeaderButton>
        <RaceRequestHeaderButton>
          {(open) => (
            <Button onPress={open} style={styles.contactButton} variant="secondary">{copy.requestRace}</Button>
          )}
        </RaceRequestHeaderButton>
      </View>
    </Card>
  );
}

type Props = {
  copy: Copy;
  locale: 'fr' | 'en';
  targetNotificationId?: string | null;
  userId: string | null;
  onUnreadChanged: () => void;
};

const PAGE_SIZE = 20;

export function ProfileNotificationsSection({
  copy,
  locale,
  targetNotificationId,
  userId,
  onUnreadChanged,
}: Props) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);
  const handledTargetRef = useRef<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [firstPage, target] = await Promise.all([
        loadUserNotifications({ userId, page: 0, pageSize: PAGE_SIZE }),
        targetNotificationId
          ? loadUserNotificationById({ userId, notificationId: targetNotificationId })
          : Promise.resolve(null),
      ]);
      const nextNotifications = target
        ? mergeUserNotificationPages(firstPage, [target])
        : firstPage;
      setNotifications(nextNotifications);
      setHasMore(firstPage.length === PAGE_SIZE);
      pageRef.current = 0;
    } catch (caught) {
      console.warn('Unable to load user notifications.', caught);
      setError(copy.loadFailed);
    } finally {
      setLoading(false);
      void onUnreadChanged();
    }
  }, [copy.loadFailed, onUnreadChanged, targetNotificationId, userId]);

  useFocusEffect(useCallback(() => {
    void loadFirstPage();
  }, [loadFirstPage]));

  const openNotification = useCallback(async (notification: UserNotification) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(notification.id)) next.delete(notification.id);
      else next.add(notification.id);
      return next;
    });
    if (notification.readAt || !userId) return;

    try {
      const readAt = await markUserNotificationRead({
        userId,
        notificationId: notification.id,
      });
      setNotifications((current) =>
        setNotificationsRead(current, new Set([notification.id]), readAt),
      );
      void onUnreadChanged();
    } catch (caught) {
      console.warn('Unable to mark user notification as read.', caught);
      setError(copy.loadFailed);
    }
  }, [copy.loadFailed, onUnreadChanged, userId]);

  useEffect(() => {
    if (!targetNotificationId || handledTargetRef.current === targetNotificationId) return;
    const target = notifications.find((notification) => notification.id === targetNotificationId);
    if (!target) return;
    handledTargetRef.current = targetNotificationId;
    if (target.readAt) {
      setExpandedIds((current) => new Set(current).add(target.id));
    } else {
      void openNotification(target);
    }
  }, [notifications, openNotification, targetNotificationId]);

  const handleLoadMore = async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = pageRef.current + 1;
      const rows = await loadUserNotifications({ userId, page: nextPage, pageSize: PAGE_SIZE });
      setNotifications((current) => mergeUserNotificationPages(current, rows));
      setHasMore(rows.length === PAGE_SIZE);
      pageRef.current = nextPage;
    } catch (caught) {
      console.warn('Unable to load more user notifications.', caught);
      setError(copy.loadFailed);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = (notification: UserNotification) => {
    if (!userId) return;
    Alert.alert(copy.deleteTitle, copy.deleteBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteUserNotification({ userId, notification });
              setNotifications((current) => removeUserNotification(current, notification.id));
              void onUnreadChanged();
            } catch (caught) {
              console.warn('Unable to delete user notification.', caught);
              setError(copy.deleteFailed);
            }
          })();
        },
      },
    ]);
  };

  const handleMarkAllRead = async () => {
    if (!userId || markingAllRead) return;
    setMarkingAllRead(true);
    setError(null);
    try {
      const readAt = await markAllUserNotificationsRead(userId);
      setNotifications((current) =>
        setNotificationsRead(current, new Set(current.map((notification) => notification.id)), readAt),
      );
      void onUnreadChanged();
    } catch (caught) {
      console.warn('Unable to mark all user notifications as read.', caught);
      setError(copy.loadFailed);
    } finally {
      setMarkingAllRead(false);
    }
  };

  if (loading) return <LoadingState label={copy.title} />;
  if (error && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <ContactActions copy={copy} />
        <ErrorState
        description={error}
        onRetry={() => void loadFirstPage()}
        retryLabel={copy.refresh}
        title={copy.title}
        />
      </View>
    );
  }
  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <ContactActions copy={copy} />
        <EmptyState
        actionLabel={copy.refresh}
        description={copy.emptyBody}
        icon={<Ionicons color={Colors.brandPrimary} name="notifications-outline" size={30} />}
        onActionPress={() => void loadFirstPage()}
        title={copy.emptyTitle}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text size="xl" weight="bold">{copy.title}</Text>
          <Text size="sm" tone="secondary" style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
        <Button
          isLoading={markingAllRead}
          onPress={() => void handleMarkAllRead()}
          style={styles.markAllButton}
          variant="ghost"
        >
          {markingAllRead ? copy.markingAllRead : copy.markAllRead}
        </Button>
      </View>

      <ContactActions copy={copy} />

      {error ? (
        <Text accessibilityRole="alert" size="sm" style={styles.errorText}>{error}</Text>
      ) : null}

      <View style={styles.list}>
        {notifications.map((notification) => {
          const expanded = expandedIds.has(notification.id);
          const unread = !notification.readAt;
          const kindLabel = notification.kind === 'race_request_status'
            ? copy.raceRequestLabel
            : notification.feedbackId
              ? copy.feedbackReplyLabel
              : copy.adminMessageLabel;
          return (
            <Pressable
              accessibilityHint={expanded ? copy.collapse : copy.expand}
              accessibilityLabel={`${unread ? `${copy.unreadLabel}. ` : ''}${notification.title}`}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              key={notification.id}
              onPress={() => void openNotification(notification)}
              testID={`profile-notification-${notification.id}`}
            >
              <Card style={[styles.card, unread && styles.unreadCard]}>
                <View style={styles.metaRow}>
                  <View style={styles.kindRow}>
                    {unread ? <View style={styles.unreadDot} /> : null}
                    <Text size="xs" tone={unread ? 'brand' : 'tertiary'} weight="semibold">
                      {kindLabel}
                    </Text>
                  </View>
                  <Text size="xs" tone="tertiary">
                    {formatNotificationDate(notification.createdAt, locale)}
                  </Text>
                </View>
                <Text style={styles.notificationTitle} weight="bold">{notification.title}</Text>
                <Text
                  numberOfLines={expanded ? undefined : 2}
                  size="sm"
                  tone="secondary"
                  style={styles.body}
                >
                  {notification.body}
                </Text>
                <View style={styles.cardFooter}>
                  <Text size="xs" tone="brand" weight="semibold" style={styles.expandLabel}>
                    {expanded ? copy.collapse : copy.expand}
                  </Text>
                  <Pressable
                    accessibilityLabel={`${copy.delete} : ${notification.title}`}
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => handleDelete(notification)}
                    testID={`profile-notification-delete-${notification.id}`}
                  >
                    <Ionicons color={Colors.textMuted} name="trash-outline" size={18} />
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerActions}>
        <Button onPress={() => void loadFirstPage()} variant="ghost">{copy.refresh}</Button>
        {hasMore ? (
          <Button
            isLoading={loadingMore}
            onPress={() => void handleLoadMore()}
            variant="secondary"
          >
            {loadingMore ? copy.loadingMore : copy.loadMore}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function formatNotificationDate(value: string, locale: 'fr' | 'en') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  container: { gap: spacing[4] },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  subtitle: { marginTop: spacing[1] },
  markAllButton: { minHeight: 40, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  errorText: { color: Colors.danger },
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  unreadCard: { backgroundColor: Colors.brandSurface, borderColor: Colors.brandBorder },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: spacing[2], justifyContent: 'space-between' },
  kindRow: { alignItems: 'center', flexDirection: 'row', gap: spacing[2] },
  unreadDot: { backgroundColor: Colors.danger, borderRadius: 5, height: 9, width: 9 },
  notificationTitle: { fontSize: 17 },
  body: { lineHeight: 21 },
  expandLabel: { marginTop: spacing[1] },
  cardFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  contactCard: { gap: spacing[2] },
  contactButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
  contactButton: { flexGrow: 1, minHeight: 44 },
  footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center' },
});

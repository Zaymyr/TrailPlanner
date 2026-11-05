import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getNotificationsModule } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import {
  addUnreadNotificationCountListener,
  loadUnreadNotificationCount,
  resetUnreadNotificationCount,
} from '../lib/userNotifications';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (requestedUserId?: string | null) => {
    const resolvedUserId = requestedUserId === undefined ? userIdRef.current : requestedUserId;
    if (!resolvedUserId) {
      resetUnreadNotificationCount();
      return 0;
    }

    try {
      return await loadUnreadNotificationCount(resolvedUserId);
    } catch (error) {
      console.warn('Unable to load unread user notifications.', error);
      return 0;
    }
  }, []);

  useEffect(() => addUnreadNotificationCountListener(setCount), []);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }: any) => {
      if (cancelled) return;
      const nextUserId = data.session?.user.id ?? null;
      if (userIdRef.current !== nextUserId) resetUnreadNotificationCount();
      userIdRef.current = nextUserId;
      setUserId(nextUserId);
      void refresh(nextUserId);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: unknown, session: any) => {
      const nextUserId = session?.user.id ?? null;
      if (userIdRef.current !== nextUserId) resetUnreadNotificationCount();
      userIdRef.current = nextUserId;
      setUserId(nextUserId);
      void refresh(nextUserId);
    });
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    let notificationSubscription: { remove: () => void } | null = null;
    void getNotificationsModule().then((Notifications) => {
      if (!Notifications || cancelled) return;
      notificationSubscription = Notifications.addNotificationReceivedListener(() => {
        void refresh();
      });
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      appStateListener.remove();
      notificationSubscription?.remove();
    };
  }, [refresh]);

  return { count, hasUnread: count > 0, refresh, userId };
}

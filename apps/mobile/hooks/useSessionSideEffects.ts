import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  finalizePendingAccountConversion,
  finalizePendingGuestMerge,
  hasPendingGuestMerge,
} from '../lib/accountConversion';
import { isAnonymousSession } from '../lib/appSession';
import { syncResendContactRegistration } from '../lib/resendContactSync';
import { ensureTrialStatusForSession } from '../lib/trial';

/** Keeps session-bound maintenance out of the root route without owning navigation. */
export function useSessionSideEffects(
  session: Session | null,
  setMergingGuestData: (value: boolean) => void,
) {
  const resendContactSyncUserIdsRef = useRef(new Set<string>());
  const guestMergeOperationIdRef = useRef(0);

  useEffect(() => {
    if (!session) return;
    void ensureTrialStatusForSession(session);
  }, [session]);

  useEffect(() => {
    if (!session || isAnonymousSession(session) || !session.access_token) return;
    const userId = session.user.id;
    if (resendContactSyncUserIdsRef.current.has(userId)) return;

    resendContactSyncUserIdsRef.current.add(userId);
    void syncResendContactRegistration(session)
      .catch((error) => console.error('Unable to sync Resend contact:', error))
      .finally(() => {
        resendContactSyncUserIdsRef.current.delete(userId);
      });
  }, [session]);

  useEffect(() => {
    if (!session || isAnonymousSession(session)) return;
    void finalizePendingAccountConversion(session).then((result) => {
      if (!result.completed && result.reason === 'password-update-failed') {
        console.warn('Pending account conversion could not finalize password automatically.', result.error);
      }
    });
  }, [session]);

  useEffect(() => {
    const operationId = ++guestMergeOperationIdRef.current;
    if (!session || isAnonymousSession(session)) {
      setMergingGuestData(false);
      return;
    }

    void (async () => {
      try {
        const pending = await hasPendingGuestMerge();
        if (guestMergeOperationIdRef.current !== operationId) return;
        if (!pending) {
          setMergingGuestData(false);
          return;
        }

        setMergingGuestData(true);
        const result = await finalizePendingGuestMerge(session);
        if (!result.merged && result.reason === 'merge-request-failed') {
          console.warn('Pending guest merge could not complete automatically.', result.error);
        }
      } catch (error) {
        console.warn('Pending guest merge state could not be resolved.', error);
      } finally {
        if (guestMergeOperationIdRef.current === operationId) {
          setMergingGuestData(false);
        }
      }
    })();
  }, [session, setMergingGuestData]);
}

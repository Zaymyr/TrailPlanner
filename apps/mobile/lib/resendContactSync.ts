import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { isAnonymousSession } from './appSession';
import { WEB_API_BASE_URL } from './webApi';

const RESEND_CONTACT_SYNCED_KEY_PREFIX = 'resend-contact-synced';

export async function syncResendContactRegistration(session: Session | null | undefined) {
  if (!session?.access_token || !session.user.email || isAnonymousSession(session)) {
    return;
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const storageKey = `${RESEND_CONTACT_SYNCED_KEY_PREFIX}:${session.user.id}:${normalizedEmail}`;
  const alreadySynced = await SecureStore.getItemAsync(storageKey);
  if (alreadySynced) return;

  const response = await fetch(`${WEB_API_BASE_URL}/api/resend/contact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as { reason?: string } | null;

  if (response.ok && payload?.reason !== 'missing-config') {
    await SecureStore.setItemAsync(storageKey, new Date().toISOString());
  }
}

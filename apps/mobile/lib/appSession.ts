import type { Session, User } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { ensureTrialStatusForSession } from './trial';

let anonymousSessionRequest: Promise<Session | null> | null = null;

type MaybeAnonymousUser = User & {
  is_anonymous?: boolean;
};

export function isAnonymousUser(user: User | null | undefined) {
  const candidate = user as MaybeAnonymousUser | null | undefined;
  return candidate?.is_anonymous === true || candidate?.app_metadata?.provider === 'anonymous';
}

export function isAnonymousSession(session: Session | null | undefined) {
  return isAnonymousUser(session?.user);
}

export async function ensureAppSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await ensureTrialStatusForSession(session);
    return session;
  }

  if (anonymousSessionRequest) {
    return anonymousSessionRequest;
  }

  anonymousSessionRequest = (async () => {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      throw error;
    }

    if (data.session) {
      await ensureTrialStatusForSession(data.session);
    }

    return data.session ?? null;
  })().finally(() => {
    anonymousSessionRequest = null;
  });

  return anonymousSessionRequest;
}

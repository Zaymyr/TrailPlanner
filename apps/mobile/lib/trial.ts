import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchWithTimeout } from './fetchWithTimeout';
import { WEB_API_BASE_URL } from './webApi';

type TrialStatus = {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialWelcomeSeenAt?: string | null;
};

type TrialStatusResponse = {
  trial?: TrialStatus;
};

type TrialRow = {
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};

const inFlightByUserId = new Map<string, Promise<TrialStatus | null>>();

function mapTrialRow(row: TrialRow | null | undefined): TrialStatus {
  return {
    trialStartedAt: row?.trial_started_at ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
  };
}

async function ensureTrialStatusViaWeb(accessToken: string) {
  try {
    const response = await fetchWithTimeout(`${WEB_API_BASE_URL}/api/trial/status`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as TrialStatusResponse | null;
    return payload?.trial ?? null;
  } catch (error) {
    console.warn('Unable to read historical trial via web API.', error);
    return null;
  }
}

async function ensureTrialStatusViaSupabase(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('trial_started_at, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // The auth trigger owns profile creation. Never repair absent trial dates here.
  return mapTrialRow((data as TrialRow | null) ?? null);
}

export async function ensureTrialStatusForSession(session: Session | null) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token ?? null;

  if (!userId) {
    return null;
  }

  const existingRequest = inFlightByUserId.get(userId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    if (accessToken) {
      const serverTrial = await ensureTrialStatusViaWeb(accessToken);
      if (serverTrial) {
        return serverTrial;
      }
    }

    try {
      return await ensureTrialStatusViaSupabase(userId);
    } catch (error) {
      console.warn('Unable to read historical trial via Supabase.', error);
      return null;
    }
  })().finally(() => {
    inFlightByUserId.delete(userId);
  });

  inFlightByUserId.set(userId, request);
  return request;
}

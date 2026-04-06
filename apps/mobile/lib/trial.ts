import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim() ?? '';
const TRIAL_DURATION_DAYS = 15;

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

function buildTrialDates() {
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  return {
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function mapTrialRow(row: TrialRow | null | undefined): TrialStatus {
  return {
    trialStartedAt: row?.trial_started_at ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
  };
}

async function ensureTrialStatusViaWeb(accessToken: string) {
  if (!WEB_URL) return null;

  try {
    const response = await fetch(`${WEB_URL}/api/trial/status`, {
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
    console.warn('Unable to initialize trial via web API.', error);
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

  const currentRow = (data as TrialRow | null) ?? null;

  if (!currentRow) {
    const { startedAt, endsAt } = buildTrialDates();
    const { error: insertError } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        trial_started_at: startedAt,
        trial_ends_at: endsAt,
      },
      { onConflict: 'user_id' }
    );

    if (insertError) {
      throw insertError;
    }

    return {
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
    };
  }

  if (!currentRow.trial_started_at) {
    const { startedAt, endsAt } = buildTrialDates();
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        trial_started_at: startedAt,
        trial_ends_at: endsAt,
      })
      .eq('user_id', userId)
      .is('trial_started_at', null);

    if (updateError) {
      throw updateError;
    }

    return {
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
    };
  }

  if (!currentRow.trial_ends_at) {
    const trialStart = new Date(currentRow.trial_started_at);

    if (Number.isFinite(trialStart.getTime())) {
      const endsAt = new Date(
        trialStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          trial_ends_at: endsAt,
        })
        .eq('user_id', userId)
        .is('trial_ends_at', null);

      if (updateError) {
        throw updateError;
      }

      return {
        trialStartedAt: currentRow.trial_started_at,
        trialEndsAt: endsAt,
      };
    }
  }

  return mapTrialRow(currentRow);
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
      console.warn('Unable to initialize trial via Supabase.', error);
      return null;
    }
  })().finally(() => {
    inFlightByUserId.delete(userId);
  });

  inFlightByUserId.set(userId, request);
  return request;
}

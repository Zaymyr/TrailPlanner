import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlanRow } from '../components/plans/types';
import { isAnonymousSession } from './appSession';
import { buildLocalDepartureAt, readOrganizerStartTime } from './planDeparture';
import { readOfflineCache, readStoredAuthSession, writeOfflineCache } from './offlineCache';
import { buildUserScopedOfflineKey, isPostgrestNetworkFailure } from './offlineCacheFormat';
import { getPlanSummaryDepartureTimeStorageKey } from './planSummary';
import { supabase } from './supabase';

type PlansScreenBootstrap = {
  fetchedAt: number;
  isAnonymous: boolean;
  plans: PlanRow[];
  userId: string | null;
  /** Set when the list comes from the device copy because the network is unreachable. */
  offlineSavedAt: string | null;
};

const PLANS_SCREEN_BOOTSTRAP_TTL_MS = 30_000;

let cachedPlansScreenBootstrap: PlansScreenBootstrap | null = null;

export function readPlansScreenBootstrap() {
  if (!cachedPlansScreenBootstrap) {
    return null;
  }

  if (Date.now() - cachedPlansScreenBootstrap.fetchedAt > PLANS_SCREEN_BOOTSTRAP_TTL_MS) {
    return null;
  }

  return cachedPlansScreenBootstrap;
}

export function clearPlansScreenBootstrap() {
  cachedPlansScreenBootstrap = null;
}

export async function fetchPlansScreenBootstrap(sessionOverride?: Session | null) {
  // While offline with an expired token, getSession() reports no session although
  // the account is still signed in on the device: its persisted session is used.
  const session =
    sessionOverride ?? (await supabase.auth.getSession()).data.session ?? readStoredAuthSession();
  const userId = session?.user?.id ?? null;
  const isAnonymous = isAnonymousSession(session);

  const result = await supabase
    .from('race_plans')
    .select('id, created_at, name, updated_at, race_id, planner_values, elevation_profile, races(name,race_date,organizer_details,race_events(id,name))')
    .order('updated_at', { ascending: false });
  const { data, error } = result;

  if (error) {
    if (userId && isPostgrestNetworkFailure(result)) {
      const stored = await readOfflineCache<PlanRow[]>('plans-list', buildUserScopedOfflineKey(userId));
      if (stored && Array.isArray(stored.data)) {
        return {
          fetchedAt: Date.now(),
          isAnonymous,
          plans: stored.data,
          userId,
          offlineSavedAt: stored.savedAt,
        } satisfies PlansScreenBootstrap;
      }
    }
    throw error;
  }

  const plans = (data as PlanRow[] | null) ?? [];
  const raceIds = [...new Set(plans.filter((plan) => plan.race_id).map((plan) => plan.race_id!))];
  const firstWaveStartByRace = new Map<string, string>();

  if (raceIds.length > 0) {
    const { data: waveData } = await supabase
      .from('race_start_waves')
      .select('race_id,start_time,order_index')
      .in('race_id', raceIds)
      .order('order_index', { ascending: true });

    for (const wave of waveData ?? []) {
      if (!firstWaveStartByRace.has(wave.race_id) && typeof wave.start_time === 'string') {
        firstWaveStartByRace.set(wave.race_id, wave.start_time.slice(0, 5));
      }
    }
  }

  const manualDepartureTimes = await Promise.all(
    plans.map((plan) => AsyncStorage.getItem(getPlanSummaryDepartureTimeStorageKey(plan.id)).catch(() => null)),
  );
  const hydratedPlans = plans.map((plan, index) => {
    const manualStartTime = manualDepartureTimes[index];
    const organizerStartTime =
      readOrganizerStartTime(plan.races?.organizer_details) ??
      (plan.race_id ? firstWaveStartByRace.get(plan.race_id) ?? null : null);
    const startTime = manualStartTime ?? organizerStartTime;
    return {
      ...plan,
      departureAt: buildLocalDepartureAt(plan.races?.race_date, startTime),
      departureSource: manualStartTime ? 'runner' as const : organizerStartTime ? 'organizer' as const : null,
    };
  });

  cachedPlansScreenBootstrap = {
    fetchedAt: Date.now(),
    isAnonymous,
    plans: hydratedPlans,
    userId,
    offlineSavedAt: null,
  };
  if (userId) void writeOfflineCache('plans-list', buildUserScopedOfflineKey(userId), hydratedPlans);

  return cachedPlansScreenBootstrap;
}

export async function primePlansScreenBootstrap(sessionOverride?: Session | null) {
  return fetchPlansScreenBootstrap(sessionOverride);
}

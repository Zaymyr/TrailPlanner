import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlanRow } from '../components/plans/types';
import { isAnonymousSession } from './appSession';
import { buildLocalDepartureAt, readOrganizerStartTime } from './planDeparture';
import { getPlanSummaryDepartureTimeStorageKey } from './planSummary';
import { supabase } from './supabase';

type PlansScreenBootstrap = {
  fetchedAt: number;
  isAnonymous: boolean;
  plans: PlanRow[];
  raceOwnership: Record<string, string | null>;
  userId: string | null;
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
  const session =
    sessionOverride ?? (await supabase.auth.getSession()).data.session ?? null;
  const userId = session?.user?.id ?? null;
  const isAnonymous = isAnonymousSession(session);

  const { data, error } = await supabase
    .from('race_plans')
    .select('id, created_at, name, updated_at, race_id, planner_values, elevation_profile, races(name,race_date,organizer_details,race_events(id,name))')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const plans = (data as PlanRow[] | null) ?? [];
  const raceIds = [...new Set(plans.filter((plan) => plan.race_id).map((plan) => plan.race_id!))];
  const raceOwnership: Record<string, string | null> = {};
  const firstWaveStartByRace = new Map<string, string>();

  if (raceIds.length > 0 && userId) {
    const [{ data: racesData }, { data: waveData }] = await Promise.all([
      supabase
      .from('races')
      .select('id, created_by')
      .in('id', raceIds),
      supabase
        .from('race_start_waves')
        .select('race_id,start_time,order_index')
        .in('race_id', raceIds)
        .order('order_index', { ascending: true }),
    ]);

    for (const race of racesData ?? []) {
      raceOwnership[race.id] = race.created_by ?? null;
    }

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
    raceOwnership,
    userId,
  };

  return cachedPlansScreenBootstrap;
}

export async function primePlansScreenBootstrap(sessionOverride?: Session | null) {
  return fetchPlansScreenBootstrap(sessionOverride);
}

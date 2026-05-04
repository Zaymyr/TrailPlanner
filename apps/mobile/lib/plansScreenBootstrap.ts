import type { Session } from '@supabase/supabase-js';

import type { PlanRow } from '../components/plans/types';
import { isAnonymousSession } from './appSession';
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
    .select('id, created_at, name, updated_at, race_id, planner_values, races(name)')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const plans = (data as PlanRow[] | null) ?? [];
  const raceIds = [...new Set(plans.filter((plan) => plan.race_id).map((plan) => plan.race_id!))];
  const raceOwnership: Record<string, string | null> = {};

  if (raceIds.length > 0 && userId) {
    const { data: racesData } = await supabase
      .from('races')
      .select('id, created_by')
      .in('id', raceIds);

    for (const race of racesData ?? []) {
      raceOwnership[race.id] = race.created_by ?? null;
    }
  }

  cachedPlansScreenBootstrap = {
    fetchedAt: Date.now(),
    isAnonymous,
    plans,
    raceOwnership,
    userId,
  };

  return cachedPlansScreenBootstrap;
}

export async function primePlansScreenBootstrap(sessionOverride?: Session | null) {
  return fetchPlansScreenBootstrap(sessionOverride);
}

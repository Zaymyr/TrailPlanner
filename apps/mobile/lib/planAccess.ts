import { supabase } from './supabase';
import { isAnonymousUser } from './appSession';

export const GUEST_PLAN_LIMIT = 1;
export const FREE_PLAN_LIMIT = 2;

type PlanAccessRow = {
  id: string;
  created_at: string;
};

function sortPlansByCreatedAt(
  plans: Array<Pick<PlanAccessRow, 'id' | 'created_at'>>,
) {
  return [...plans]
    .sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return rightTime - leftTime;
    });
}

export function getAccessiblePlanIds(
  plans: Array<Pick<PlanAccessRow, 'id' | 'created_at'>>,
  isPremium: boolean,
  isAnonymous: boolean,
) {
  if (isPremium || plans.length === 0) return null;

  const limit = isAnonymous ? GUEST_PLAN_LIMIT : FREE_PLAN_LIMIT;
  const sortedPlans = sortPlansByCreatedAt(plans);
  return new Set(sortedPlans.slice(0, limit).map((plan) => plan.id));
}

export async function getCurrentUserPlanAccess(isPremium: boolean) {
  if (isPremium) {
    return {
      isAnonymous: false,
      planLimit: null,
      planCount: 0,
      accessiblePlanIds: null as Set<string> | null,
      hasReachedPlanLimit: false,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isAnonymous: false,
      planLimit: FREE_PLAN_LIMIT,
      planCount: 0,
      accessiblePlanIds: null as Set<string> | null,
      hasReachedPlanLimit: false,
    };
  }

  const isAnonymous = isAnonymousUser(user);
  const planLimit = isAnonymous ? GUEST_PLAN_LIMIT : FREE_PLAN_LIMIT;

  const { data, error } = await supabase
    .from('race_plans')
    .select('id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Unable to load current user plan access.', error);
    return {
      isAnonymous,
      planLimit,
      planCount: 0,
      accessiblePlanIds: null as Set<string> | null,
      hasReachedPlanLimit: false,
    };
  }

  const plans = (data ?? []) as PlanAccessRow[];

  return {
    isAnonymous,
    planLimit,
    planCount: plans.length,
    accessiblePlanIds: getAccessiblePlanIds(plans, false, isAnonymous),
    hasReachedPlanLimit: plans.length >= planLimit,
  };
}

export async function currentUserHasReachedFreePlanLimit() {
  const access = await getCurrentUserPlanAccess(false);
  return access.hasReachedPlanLimit;
}

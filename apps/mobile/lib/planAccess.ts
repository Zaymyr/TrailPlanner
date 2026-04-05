import { supabase } from './supabase';

export const FREE_PLAN_LIMIT = 1;

type PlanAccessRow = {
  id: string;
  created_at: string;
};

export function getLatestAccessiblePlanId(
  plans: Array<Pick<PlanAccessRow, 'id' | 'created_at'>>,
  isPremium: boolean,
) {
  if (isPremium || plans.length === 0) return null;

  return [...plans]
    .sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return rightTime - leftTime;
    })[0]?.id ?? null;
}

export async function getCurrentUserLatestAccessiblePlanId(isPremium: boolean) {
  if (isPremium) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('race_plans')
    .select('id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Unable to load latest accessible plan.', error);
    return null;
  }

  return data?.id ?? null;
}

export async function currentUserHasReachedFreePlanLimit() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from('race_plans')
    .select('id')
    .eq('user_id', user.id)
    .limit(FREE_PLAN_LIMIT);

  if (error) {
    console.warn('Unable to load current user plan count.', error);
    return false;
  }

  return (data?.length ?? 0) >= FREE_PLAN_LIMIT;
}

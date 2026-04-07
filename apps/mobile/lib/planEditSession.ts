import type { ElevationPoint, PlanFormValues } from '../components/PlanForm';

type PlanEditDraft = {
  elevationProfile: ElevationPoint[];
  lastSavedSnapshot: string | null;
  planName: string;
  values: PlanFormValues;
};

let activePlanEditId: string | null = null;
const draftsByPlanId = new Map<string, PlanEditDraft>();

export function setActivePlanEditSession(planId: string | null) {
  activePlanEditId = planId;
}

export function getActivePlanEditHref() {
  return activePlanEditId ? `/(app)/plan/${activePlanEditId}/edit` : null;
}

export function clearActivePlanEditSession(planId?: string | null) {
  if (!planId || activePlanEditId === planId) {
    activePlanEditId = null;
  }
}

export function setPlanEditDraft(planId: string, draft: PlanEditDraft) {
  draftsByPlanId.set(planId, draft);
}

export function getPlanEditDraft(planId: string) {
  return draftsByPlanId.get(planId) ?? null;
}

export function clearPlanEditDraft(planId: string) {
  draftsByPlanId.delete(planId);
}

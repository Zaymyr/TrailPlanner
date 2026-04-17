import type { ElevationPoint, PlanFormValues } from '../components/PlanForm';
import type { PlanProductsBootstrap } from '../components/plan-form/usePlanProducts';

type PlanEditDraft = {
  elevationProfile: ElevationPoint[];
  lastSavedSnapshot: string | null;
  planName: string;
  values: PlanFormValues;
};

let activePlanEditId: string | null = null;
const draftsByPlanId = new Map<string, PlanEditDraft>();
const productsBootstrapByPlanId = new Map<string, PlanProductsBootstrap>();
let pendingPlanEditHelpId: string | null = null;

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

export function setPlanEditProductsBootstrap(planId: string, bootstrap: PlanProductsBootstrap) {
  productsBootstrapByPlanId.set(planId, bootstrap);
}

export function getPlanEditProductsBootstrap(planId: string) {
  return productsBootstrapByPlanId.get(planId) ?? null;
}

export function clearPlanEditProductsBootstrap(planId: string) {
  productsBootstrapByPlanId.delete(planId);
}

export function setPendingPlanEditHelp(planId: string | null) {
  pendingPlanEditHelpId = planId;
}

export function getPendingPlanEditHelp() {
  return pendingPlanEditHelpId;
}

export function clearPendingPlanEditHelp(planId?: string | null) {
  if (!planId || pendingPlanEditHelpId === planId) {
    pendingPlanEditHelpId = null;
  }
}

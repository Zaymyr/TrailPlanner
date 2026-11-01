import type { ElevationPoint, PlanFormValues } from '../components/PlanForm';
import type { PlanProductsBootstrap } from '../components/plan-form/usePlanProducts';

export type PlanEditDraft = {
  elevationProfile: ElevationPoint[];
  lastSavedSnapshot: string | null;
  planName: string;
  values: PlanFormValues;
};

type PlanWorkspaceWarmStart = {
  draft: PlanEditDraft;
  products: PlanProductsBootstrap;
  token: string;
};

let activePlanEditId: string | null = null;
const draftsByPlanId = new Map<string, PlanEditDraft>();
const productsBootstrapByPlanId = new Map<string, PlanProductsBootstrap>();
const workspaceWarmStartsByPlanId = new Map<string, PlanWorkspaceWarmStart>();
let workspaceWarmStartSequence = 0;
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

export function stagePlanWorkspaceWarmStart(
  planId: string,
  warmStart: Omit<PlanWorkspaceWarmStart, 'token'>,
) {
  workspaceWarmStartSequence += 1;
  const token = `${Date.now().toString(36)}-${workspaceWarmStartSequence.toString(36)}`;
  workspaceWarmStartsByPlanId.set(planId, { ...warmStart, token });
  return token;
}

export function consumePlanWorkspaceWarmStart(planId: string, token: string | null | undefined) {
  const warmStart = workspaceWarmStartsByPlanId.get(planId) ?? null;
  if (!warmStart || !token || warmStart.token !== token) return null;
  workspaceWarmStartsByPlanId.delete(planId);
  return { planId, draft: warmStart.draft, products: warmStart.products };
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

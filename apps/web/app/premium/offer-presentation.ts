import type { RunnerOffer } from "../hooks/useRunnerPrice";

export type SavedPlanSummary = {
  id?: unknown;
  name?: unknown;
  races?: { name?: unknown } | null;
};

export const orderRunnerOffers = (hasPlanScope: boolean): RunnerOffer[] =>
  hasPlanScope ? ["course", "annual"] : ["annual", "course"];

export const resolvePlanCourseName = (plan: SavedPlanSummary | undefined): string | null => {
  if (typeof plan?.races?.name === "string" && plan.races.name.trim()) return plan.races.name.trim();
  if (typeof plan?.name === "string" && plan.name.trim()) return plan.name.trim();
  return null;
};

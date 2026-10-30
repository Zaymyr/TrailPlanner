export type RunnerPlanCapabilities = {
  enabled: boolean;
  canEdit: boolean;
  canViewDetails: boolean;
  mode?: 'real' | 'free' | 'premium';
};

// Server capabilities are authoritative even when the SDK still reports Premium.
export function resolveRunnerPlanCapabilities(payload: RunnerPlanCapabilities | null): RunnerPlanCapabilities {
  if (!payload) return { enabled: true, canEdit: false, canViewDetails: false };
  if (!payload.enabled) return { ...payload, canEdit: true, canViewDetails: true };
  return { ...payload, canEdit: payload.canEdit === true, canViewDetails: payload.canViewDetails === true };
}

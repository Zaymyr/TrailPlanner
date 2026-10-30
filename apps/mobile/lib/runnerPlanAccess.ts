export type RunnerPlanCapabilities = {
  enabled: boolean;
  canEdit: boolean;
  canViewDetails: boolean;
  mode?: 'real' | 'free' | 'premium';
};

export function getRunnerAccessModeErrorMessage(status: number, locale: 'fr' | 'en'): string {
  if (status === 404) {
    return locale === 'fr'
      ? "Le mode de test n’est pas encore disponible sur l’API utilisée par cette version de l’app."
      : 'Test mode is not available yet on the API used by this app version.';
  }
  if (status === 401 || status === 403) {
    return locale === 'fr'
      ? 'Votre session administrateur doit être reconnectée avant de changer le mode.'
      : 'Reconnect your administrator session before changing the mode.';
  }
  return locale === 'fr'
    ? 'Impossible de changer le mode de test pour le moment.'
    : 'Unable to change test mode right now.';
}

// Server capabilities are authoritative even when the SDK still reports Premium.
export function resolveRunnerPlanCapabilities(payload: RunnerPlanCapabilities | null): RunnerPlanCapabilities {
  if (!payload) return { enabled: true, canEdit: false, canViewDetails: false };
  if (payload.mode === 'free') return { ...payload, canEdit: false, canViewDetails: false };
  if (!payload.enabled) return { ...payload, canEdit: true, canViewDetails: true };
  return { ...payload, canEdit: payload.canEdit === true, canViewDetails: payload.canViewDetails === true };
}

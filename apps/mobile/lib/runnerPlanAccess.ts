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
import AsyncStorage from '@react-native-async-storage/async-storage';


export type RunnerPlanAccessResolution =
  | { status: 'verified' | 'cached'; capabilities: RunnerPlanCapabilities }
  | { status: 'unknown'; capabilities: null };

export function resolveRunnerPlanAccess(
  payload: RunnerPlanCapabilities | null,
  cached: RunnerPlanCapabilities | null,
): RunnerPlanAccessResolution {
  if (payload) return { status: 'verified', capabilities: resolveRunnerPlanCapabilities(payload) };
  if (cached) return { status: 'cached', capabilities: resolveRunnerPlanCapabilities(cached) };
  return { status: 'unknown', capabilities: null };
}

function runnerPlanAccessCacheKey(userId: string, planId: string) {
  return `runner-plan-access:${userId}:${planId}`;
}

export async function readCachedRunnerPlanCapabilities(userId: string, planId: string) {
  const raw = await AsyncStorage.getItem(runnerPlanAccessCacheKey(userId, planId)).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RunnerPlanCapabilities;
    return typeof parsed?.enabled === 'boolean'
      && typeof parsed.canEdit === 'boolean'
      && typeof parsed.canViewDetails === 'boolean'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function cacheRunnerPlanCapabilities(userId: string, planId: string, capabilities: RunnerPlanCapabilities) {
  await AsyncStorage.setItem(
    runnerPlanAccessCacheKey(userId, planId),
    JSON.stringify(capabilities),
  ).catch(() => undefined);
}

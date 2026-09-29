import type { ElevationPoint } from '../components/plan-form/profile-utils';

export type PlanWorkspaceTab = 'plan' | 'recap' | 'settings';

export function normalizePlanWorkspaceTab(value: string | string[] | undefined): PlanWorkspaceTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === 'recap' || candidate === 'settings') return candidate;
  return 'plan';
}

export function calculateElevationLoss(profile: readonly ElevationPoint[]): number | null {
  const validPoints = profile.filter(
    (point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM),
  );
  if (validPoints.length < 2) return null;

  return validPoints.slice(1).reduce((loss, point, index) => {
    const previous = validPoints[index];
    const delta = point.elevationM - previous.elevationM;
    return delta < 0 ? loss + Math.abs(delta) : loss;
  }, 0);
}

export function formatAveragePace(totalDurationMin: number, distanceKm: number): string {
  if (!Number.isFinite(totalDurationMin) || !Number.isFinite(distanceKm) || totalDurationMin <= 0 || distanceKm <= 0) {
    return '—';
  }

  const totalSeconds = Math.max(1, Math.round((totalDurationMin / distanceKm) * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

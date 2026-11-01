import { normalizePlanClock } from './planDeparture';

export type PlanStartWave = {
  id: string;
  name: string;
  startTime: string;
};

export function formatDepartureDelta(personal: Date, official: Date, locale: 'fr' | 'en') {
  const deltaMinutes = Math.round((personal.getTime() - official.getTime()) / 60_000);
  if (deltaMinutes === 0) return null;
  const sign = deltaMinutes > 0 ? '+' : '−';
  return locale === 'fr'
    ? `${sign}${Math.abs(deltaMinutes)} min par rapport au départ officiel`
    : `${sign}${Math.abs(deltaMinutes)} min from the official start`;
}

export function normalizePlanStartWaves(rows: unknown): PlanStartWave[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const candidate = row as { id?: unknown; name?: unknown; start_time?: unknown };
    const startTime = normalizePlanClock(candidate.start_time);
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !startTime) return [];
    return [{ id: candidate.id, name: candidate.name, startTime }];
  });
}

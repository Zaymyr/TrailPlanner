import type { SectionSummary, SectionTarget } from './contracts';

export function formatTimelineMinute(minute: number) {
  if (minute <= 0) return 'Départ';
  return `${minute} min`;
}

export function formatSectionDuration(durationMin: number) {
  const hours = Math.floor(durationMin / 60);
  const mins = Math.round(durationMin % 60);
  return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
}

export function formatPace(minutesPerKm: number) {
  const safeValue = Math.max(0.01, minutesPerKm);
  const minutes = Math.floor(safeValue);
  const seconds = Math.round((safeValue - minutes) * 60);
  if (seconds === 60) {
    return `${minutes + 1}:00`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function parsePaceInput(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return undefined;

  if (trimmed.includes(':')) {
    const [minutesPart, secondsPart = '0'] = trimmed.split(':');
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0) {
      return null;
    }
    return minutes + seconds / 60;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function formatSectionTarget(summary: SectionSummary | null): SectionTarget {
  return {
    targetCarbsG: summary?.targetCarbsG ?? 0,
    targetSodiumMg: summary?.targetSodiumMg ?? 0,
    targetWaterMl: summary?.targetWaterMl ?? 0,
  };
}

export function getSegmentCardTitle(label: string | undefined, index: number) {
  let baseLabel: string;
  if (label === 'climb') baseLabel = 'Montee';
  else if (label === 'descent') baseLabel = 'Descente';
  else if (label === 'flat') baseLabel = 'Plat';
  else baseLabel = `Segment ${index + 1}`;

  return baseLabel.startsWith('Segment') ? baseLabel : `${baseLabel} ${index + 1}`;
}

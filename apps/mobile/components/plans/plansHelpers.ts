import type { PickerEventGroup, PlanRow } from './types';

export function estimateDuration(plannerValues: PlanRow['planner_values']): string | null {
  const distanceKm = plannerValues.raceDistanceKm;
  if (!distanceKm) return null;

  let totalMinutes: number;
  if (plannerValues.paceType === 'speed' && plannerValues.speedKph && plannerValues.speedKph > 0) {
    totalMinutes = (distanceKm / plannerValues.speedKph) * 60;
  } else if (plannerValues.paceMinutes != null) {
    const secondsPerKm = (plannerValues.paceMinutes ?? 0) * 60 + (plannerValues.paceSeconds ?? 0);
    totalMinutes = (secondsPerKm * distanceKm) / 60;
  } else {
    return null;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`;
}

export function formatPlanDate(iso: string, locale: 'fr' | 'en'): string {
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatEventDate(isoDate: string | null, locale: 'fr' | 'en'): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getRacePickerLabel(raceName: string, eventName: string): string {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-–—·]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

export function getPickerEventImageUrl(
  event: Pick<PickerEventGroup, 'thumbnail_url' | 'races'>,
): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

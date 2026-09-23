import type { PickerEventGroup, PlanRow } from './types';
import {
  buildPlanSummary,
  buildStoredRacePlanFromRow,
  formatDuration,
  type PlanSummaryRow,
} from '../../lib/planSummary';

export function estimateDuration(plan: PlanRow): string | null {
  if (!plan.planner_values.raceDistanceKm) return null;

  const storedPlan = buildStoredRacePlanFromRow(plan as PlanSummaryRow);
  return formatDuration(buildPlanSummary(storedPlan, {}).totalDurationMin);
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

export function getPlanCardTitle(
  plan: PlanRow,
  eventName: string,
  locale: 'fr' | 'en',
): string {
  const planName = plan.name.trim();
  const raceName = plan.races?.name?.trim() ?? '';
  if (!raceName || planName.localeCompare(raceName, undefined, { sensitivity: 'base' }) !== 0) {
    return planName;
  }

  const escapedEventName = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const formatName = raceName
    .replace(new RegExp(escapedEventName, 'gi'), '')
    .replace(/^[\s\-–—·:]+|[\s\-–—·:]+$/g, '')
    .trim();

  return formatName.length > 2 ? formatName : locale === 'fr' ? 'Plan de course' : 'Race plan';
}

export function getPickerEventImageUrl(
  event: Pick<PickerEventGroup, 'thumbnail_url' | 'races'>,
): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

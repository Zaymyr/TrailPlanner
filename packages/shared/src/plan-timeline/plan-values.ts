// Planner-values normalization applied before any plan-timeline computation.
// Moved from apps/mobile/components/plan-form/helpers.ts, which re-exports it unchanged.
import {
  ARRIVEE_ID,
  DEFAULT_PLAN_VALUES,
  DEPART_ID,
  type AidStationFormItem,
  type PlanFormValues,
  type Supply,
} from './types';
import type { SectionSegment } from './profile-utils';

export function normalizeSupplies(raw: Array<{ productId: string; quantity?: number }> | undefined): Supply[] {
  if (!raw) return [];
  return raw.map((supply) => ({ productId: supply.productId, quantity: supply.quantity ?? 1 }));
}

export function cloneSectionSegments(
  raw: Record<string, SectionSegment[]> | undefined,
): Record<string, SectionSegment[]> | undefined {
  if (!raw) return undefined;
  const entries = Object.entries(raw).map(([key, segments]) => [key, segments.map((segment) => ({ ...segment }))] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function injectSystemStations(stations: AidStationFormItem[], distanceKm: number): AidStationFormItem[] {
  const intermediates = stations.filter(
    (station) =>
      station.id !== DEPART_ID &&
      station.id !== ARRIVEE_ID &&
      !(station.name === 'Départ' && station.distanceKm === 0) &&
      station.name !== 'Arrivée',
  );

  return [
    {
      id: DEPART_ID,
      name: 'Départ',
      distanceKm: 0,
      waterRefill: true,
      solidRefill: true,
      assistanceAllowed: true,
      pauseMinutes: 0,
      supplies: [],
    },
    ...intermediates.map((station) => ({
      ...station,
      waterRefill: station.waterRefill !== false,
      solidRefill: station.solidRefill !== false,
      assistanceAllowed: station.assistanceAllowed !== false,
      pauseMinutes: Math.max(0, station.pauseMinutes ?? 0),
      supplies: station.assistanceAllowed === false ? [] : station.supplies,
    })),
    {
      id: ARRIVEE_ID,
      name: 'Arrivée',
      distanceKm,
      waterRefill: false,
      solidRefill: false,
      assistanceAllowed: false,
      pauseMinutes: 0,
    },
  ];
}

export function buildInitialPlanValues(initialValues: PlanFormValues): PlanFormValues {
  return {
    ...initialValues,
    fatigueLevel:
      typeof initialValues.fatigueLevel === 'number' && Number.isFinite(initialValues.fatigueLevel)
        ? Math.min(1, Math.max(0, initialValues.fatigueLevel))
        : DEFAULT_PLAN_VALUES.fatigueLevel,
    startSupplies: normalizeSupplies(initialValues.startSupplies),
    sectionSegments: cloneSectionSegments(initialValues.sectionSegments),
    aidStations: injectSystemStations(
      initialValues.aidStations.map((station) => ({
        ...station,
        waterRefill: station.waterRefill !== false,
        solidRefill: station.solidRefill !== false,
        assistanceAllowed: station.assistanceAllowed !== false,
        pauseMinutes: Math.max(0, station.pauseMinutes ?? 0),
        supplies: station.assistanceAllowed === false ? [] : normalizeSupplies(station.supplies),
      })),
      initialValues.raceDistanceKm,
    ),
  };
}

import { buildCarryoverCoverages } from '../components/plan-form/carryover';
import {
  ARRIVEE_ID,
  type PlanFormValues,
  type PlanProduct,
  type PlanTarget,
  type SectionSummary,
  type SectionTarget,
  type Supply,
} from '../components/plan-form/contracts';
import { buildInitialPlanValues, getEffectiveSodiumTarget } from '../components/plan-form/helpers';
import { buildGaugeMetrics, getGaugeColor } from '../components/plan-form/metrics';
import type { ElevationPoint } from '../components/plan-form/profile-utils';
import { buildPlanSectionSummary, getBaseSpeedKph } from '../components/plan-form/section-summary';
import { getIntermediateAidStationCount } from './planPersistence';

/**
 * Plan status shown on the "Mes courses" wristband.
 * - draft: no planned time (pace or speed over a distance) or no aid station.
 * - inProgress: planned time and aid stations, but at least one carbohydrate,
 *   sodium or water gauge of a section is red (or empty) in the plan editor.
 * - ready: planned time, aid stations, and every section gauge is at least
 *   orange.
 */
export type PlanReadiness = 'draft' | 'inProgress' | 'ready';

/** Stored `race_plans.planner_values` as the list loads them (all optional). */
export type StoredPlannerValues = {
  raceDistanceKm?: number | null;
  elevationGain?: number | null;
  fatigueLevel?: number | null;
  paceType?: 'pace' | 'speed' | null;
  paceMinutes?: number | null;
  paceSeconds?: number | null;
  speedKph?: number | null;
  targetIntakePerHour?: number | null;
  waterIntakePerHour?: number | null;
  sodiumIntakePerHour?: number | null;
  waterBagLiters?: number | null;
  startSupplies?: Array<{ productId: string; quantity?: number | null }> | null;
  sectionSegments?: Record<string, unknown[]> | null;
  segments?: Record<string, unknown[]> | null;
  aidStations?: Array<{
    id?: string;
    sourceAidStationId?: string;
    name?: string;
    distanceKm?: number;
    waterRefill?: boolean;
    solidRefill?: boolean;
    assistanceAllowed?: boolean;
    pauseMinutes?: number;
    supplies?: Array<{ productId: string; quantity?: number | null }> | null;
  }> | null;
};

export type ReadinessProduct = Pick<PlanProduct, 'id' | 'fuel_type' | 'carbs_g' | 'sodium_mg'> & { name?: string };

/** Gauge fills the plan editor paints red or empty (metrics.getGaugeColor). */
const GAUGE_RED = getGaugeColor('carbs', 0.5);
const GAUGE_EMPTY = getGaugeColor('carbs', 0);

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** True when the stored plan carries a pace or speed that yields a finish time. */
export function hasPlannedTime(values: StoredPlannerValues | null | undefined): boolean {
  if (!values || !finite(values.raceDistanceKm) || values.raceDistanceKm <= 0) return false;
  const paceMinutes = finite(values.paceMinutes) ? values.paceMinutes : 0;
  const paceSeconds = finite(values.paceSeconds) ? values.paceSeconds : 0;
  const hasPace = finite(values.paceMinutes) && paceMinutes * 60 + paceSeconds > 0;
  const hasSpeed = finite(values.speedKph) && values.speedKph > 0;
  if (values.paceType === 'speed') return hasSpeed;
  if (values.paceType === 'pace') return hasPace;
  return hasPace || hasSpeed;
}

export function hasAidStations(values: StoredPlannerValues | null | undefined): boolean {
  return getIntermediateAidStationCount(
    (values?.aidStations ?? []).map((station) => ({ id: station.id, name: station.name ?? '', distanceKm: station.distanceKm })),
  ) > 0;
}

const toSupplies = (raw: Array<{ productId: string; quantity?: number | null }> | null | undefined): Supply[] =>
  (raw ?? []).map((supply) => ({ productId: supply.productId, quantity: supply.quantity ?? 1 }));

/** Same defaults as the plan editor when it opens a stored plan (edit.tsx). */
export function storedPlannerValuesToFormValues(values: StoredPlannerValues): PlanFormValues {
  return buildInitialPlanValues({
    name: '',
    raceDistanceKm: values.raceDistanceKm ?? 0,
    elevationGain: values.elevationGain ?? 0,
    fatigueLevel: finite(values.fatigueLevel) ? Math.min(1, Math.max(0, values.fatigueLevel)) : 0.5,
    paceType: values.paceType ?? 'pace',
    paceMinutes: values.paceMinutes ?? 6,
    paceSeconds: values.paceSeconds ?? 0,
    speedKph: values.speedKph ?? 10,
    targetIntakePerHour: values.targetIntakePerHour ?? 70,
    waterIntakePerHour: values.waterIntakePerHour ?? 500,
    sodiumIntakePerHour: values.sodiumIntakePerHour ?? 600,
    waterBagLiters: values.waterBagLiters ?? 1.5,
    startSupplies: toSupplies(values.startSupplies),
    sectionSegments: (values.sectionSegments ?? values.segments ?? undefined) as PlanFormValues['sectionSegments'],
    aidStations: (values.aidStations ?? []).map((station) => ({
      ...(station.id ? { id: station.id } : {}),
      ...(station.sourceAidStationId ? { sourceAidStationId: station.sourceAidStationId } : {}),
      name: station.name ?? '',
      distanceKm: station.distanceKm ?? 0,
      waterRefill: station.waterRefill !== false,
      solidRefill: station.solidRefill !== false,
      assistanceAllowed: station.assistanceAllowed !== false,
      pauseMinutes: station.pauseMinutes ?? 0,
      supplies: station.assistanceAllowed === false ? [] : toSupplies(station.supplies),
    })),
  });
}

export function sanitizeStoredElevationProfile(raw: unknown): ElevationPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (point): point is ElevationPoint =>
      Boolean(point) && finite((point as ElevationPoint).distanceKm) && finite((point as ElevationPoint).elevationM),
  );
}

/**
 * Reproduces the plan editor's per-section gauges (PlanForm: resupply window
 * targets, effective sodium target, carryover, water availability) and
 * returns true when no carbohydrate, sodium or water gauge is red or empty.
 * A gauge with no target (0) is not applicable.
 */
export function areNutritionTargetsMet(
  values: PlanFormValues,
  elevationProfile: ElevationPoint[],
  productMap: Record<string, ReadinessProduct>,
): boolean {
  const baseSpeedKph = getBaseSpeedKph(values);
  const summaries: SectionSummary[] = values.aidStations
    .slice(0, -1)
    .map((_, index) => buildPlanSectionSummary({ values, elevationProfile, baseSpeedKph, target: index === 0 ? 'start' : index }))
    .filter((summary): summary is SectionSummary => summary !== null);
  if (summaries.length === 0) return false;

  const products = productMap as Record<string, PlanProduct>;
  const getSupplies = (target: PlanTarget): Supply[] => {
    if (target === 'start') return values.startSupplies ?? [];
    if (values.aidStations[target]?.assistanceAllowed === false) return [];
    return values.aidStations[target]?.supplies ?? [];
  };
  const byIndex = new Map(summaries.map((summary) => [summary.sectionIndex, summary] as const));
  const stopsAtArrival = (sectionIndex: number, service: 'solid' | 'water') => {
    const arrival = values.aidStations[sectionIndex + 1];
    if (!arrival || arrival.id === ARRIVEE_ID) return true;
    return service === 'solid' ? arrival.assistanceAllowed !== false : arrival.waterRefill !== false;
  };

  const carryover = buildCarryoverCoverages(
    summaries.map((summary) => {
      const target: PlanTarget = summary.sectionIndex === 0 ? 'start' : summary.sectionIndex;
      const allowsAssistance = target === 'start' || values.aidStations[summary.sectionIndex]?.assistanceAllowed !== false;
      return {
        sectionIndex: summary.sectionIndex,
        targetCarbsG: summary.targetCarbsG,
        targetSodiumMg: getEffectiveSodiumTarget(summary.targetSodiumMg),
        supplies: allowsAssistance ? getSupplies(target) : [],
      };
    }),
    products,
  );

  const waterCapacityMl = Math.max(0, values.waterBagLiters * 1000);
  let availableWaterMl = waterCapacityMl;

  return summaries.every((summary) => {
    const target: PlanTarget = summary.sectionIndex === 0 ? 'start' : summary.sectionIndex;
    const sectionTarget: SectionTarget = { targetCarbsG: 0, targetSodiumMg: 0, targetWaterMl: 0 };
    for (let index = summary.sectionIndex; index < values.aidStations.length - 1; index += 1) {
      const section = byIndex.get(index);
      if (!section) break;
      sectionTarget.targetCarbsG += section.targetCarbsG;
      sectionTarget.targetSodiumMg += getEffectiveSodiumTarget(section.targetSodiumMg);
      if (stopsAtArrival(index, 'solid')) break;
    }
    for (let index = summary.sectionIndex; index < values.aidStations.length - 1; index += 1) {
      const section = byIndex.get(index);
      if (!section) break;
      sectionTarget.targetWaterMl += section.targetWaterMl;
      if (stopsAtArrival(index, 'water')) break;
    }

    const sectionWaterMl = Math.max(0, availableWaterMl);
    availableWaterMl = Math.max(0, availableWaterMl - summary.targetWaterMl);
    const arrival = values.aidStations[summary.sectionIndex + 1];
    if (arrival?.id !== ARRIVEE_ID && arrival?.waterRefill !== false) availableWaterMl = waterCapacityMl;

    const metrics = buildGaugeMetrics({
      target,
      sectionTarget,
      carryoverCoverage: carryover.get(summary.sectionIndex) ?? null,
      getSupplies,
      productMap: products,
      aidStations: values.aidStations,
      waterBagLiters: values.waterBagLiters,
      availableWaterMl: sectionWaterMl,
    });

    return metrics.every((metric) => {
      if (!(metric.target > 0)) return true;
      const color = getGaugeColor(metric.key, metric.statusRatio ?? metric.ratio);
      return color !== GAUGE_RED && color !== GAUGE_EMPTY;
    });
  });
}

/**
 * Status of a stored plan. `productMap` null means product nutrition is not
 * loaded yet: a structurally complete plan then stays "inProgress".
 */
export function computePlanReadiness(
  plannerValues: StoredPlannerValues | null | undefined,
  elevationProfile: unknown,
  productMap: Record<string, ReadinessProduct> | null,
): PlanReadiness {
  if (!plannerValues || !hasPlannedTime(plannerValues) || !hasAidStations(plannerValues)) return 'draft';
  if (!productMap) return 'inProgress';
  const values = storedPlannerValuesToFormValues(plannerValues);
  return areNutritionTargetsMet(values, sanitizeStoredElevationProfile(elevationProfile), productMap) ? 'ready' : 'inProgress';
}

/** Product ids referenced by a stored plan (start and aid-station supplies). */
export function collectStoredPlanProductIds(plannerValues: StoredPlannerValues | null | undefined): string[] {
  const ids = new Set<string>();
  (plannerValues?.startSupplies ?? []).forEach((supply) => ids.add(supply.productId));
  (plannerValues?.aidStations ?? []).forEach((station) =>
    (station.supplies ?? []).forEach((supply) => ids.add(supply.productId)),
  );
  return [...ids].filter(Boolean);
}

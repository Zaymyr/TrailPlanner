import type { IntakeTimelineItem, PlanFormValues, PlanProduct, PlanTarget } from '../components/plan-form/contracts';
import { DEFAULT_PLAN_VALUES } from '../components/plan-form/contracts';
import type { AidStationFormItem } from '../components/plan-form/contracts';
import { buildInitialPlanValues } from '../components/plan-form/helpers';
import { buildPlanSectionSummary, getBaseSpeedKph } from '../components/plan-form/section-summary';
import type { ElevationPoint } from '../components/plan-form/profile-utils';
import {
  buildContinuousIntakeTimeline,
  buildContinuousSections,
} from './continuousNutrition';

export type StoredRacePlan = {
  id: string;
  name: string;
  updatedAt: string;
  raceDistanceKm: number;
  elevationGainM: number;
  targetCarbsPerHour: number;
  targetWaterPerHour: number;
  targetSodiumPerHour: number;
  plannerValues?: Partial<PlanFormValues> & {
    segments?: PlanFormValues['sectionSegments'];
  };
  elevationProfile?: ElevationPoint[];
};

export type LiveIntakeEvent = IntakeTimelineItem & {
  id: string;
  sectionIndex: number;
  absoluteMinute: number;
  sectionStartMinute: number;
  sectionEndMinute: number;
  fromName: string;
  toName: string;
  startKm: number;
  endKm: number;
};

export type LiveRaceSection = {
  id: string;
  sectionIndex: number;
  target: PlanTarget;
  fromName: string;
  toName: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  durationMin: number;
  pauseMinutes: number;
  startMinute: number;
  endMinute: number;
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
  timeline: LiveIntakeEvent[];
};

export type LiveAlertSpec = {
  id: string;
  triggerMinutes: number;
  title: string;
  body: string;
  payload: {
    sectionIndex: number;
    fromName: string;
    toName: string;
    carbsGrams: number;
    sodiumMg: number;
    waterMl: number;
    detail: string;
    products: NonNullable<IntakeTimelineItem['products']>;
  };
};

export type LiveMetricState = {
  key: 'carbs' | 'sodium' | 'water';
  label: string;
  unit: string;
  targetPerHour: number;
  depletion: number;
  consumed: number;
  current: number;
  ratio: number;
};

function getStoredAidStations(raw: Partial<PlanFormValues>['aidStations'] | undefined) {
  return Array.isArray(raw) ? (raw as AidStationFormItem[]) : [];
}

function getStoredStartSupplies(raw: Partial<PlanFormValues>['startSupplies'] | undefined) {
  return Array.isArray(raw) ? raw : [];
}

export function normalizeStoredPlanValues(plan: StoredRacePlan): PlanFormValues {
  const plannerValues = plan.plannerValues ?? {};

  return buildInitialPlanValues({
    ...DEFAULT_PLAN_VALUES,
    name: plan.name,
    raceDistanceKm: plannerValues.raceDistanceKm ?? plan.raceDistanceKm ?? DEFAULT_PLAN_VALUES.raceDistanceKm,
    elevationGain: plannerValues.elevationGain ?? plan.elevationGainM ?? DEFAULT_PLAN_VALUES.elevationGain,
    paceType: plannerValues.paceType ?? DEFAULT_PLAN_VALUES.paceType,
    paceMinutes: plannerValues.paceMinutes ?? DEFAULT_PLAN_VALUES.paceMinutes,
    paceSeconds: plannerValues.paceSeconds ?? DEFAULT_PLAN_VALUES.paceSeconds,
    speedKph: plannerValues.speedKph ?? DEFAULT_PLAN_VALUES.speedKph,
    targetIntakePerHour: plannerValues.targetIntakePerHour ?? plan.targetCarbsPerHour ?? DEFAULT_PLAN_VALUES.targetIntakePerHour,
    waterIntakePerHour: plannerValues.waterIntakePerHour ?? plan.targetWaterPerHour ?? DEFAULT_PLAN_VALUES.waterIntakePerHour,
    sodiumIntakePerHour: plannerValues.sodiumIntakePerHour ?? plan.targetSodiumPerHour ?? DEFAULT_PLAN_VALUES.sodiumIntakePerHour,
    waterBagLiters: plannerValues.waterBagLiters ?? DEFAULT_PLAN_VALUES.waterBagLiters,
    startSupplies: getStoredStartSupplies(plannerValues.startSupplies),
    aidStations: getStoredAidStations(plannerValues.aidStations),
    sectionSegments: plannerValues.sectionSegments ?? plannerValues.segments,
  });
}

export function buildLiveRaceSections(
  plan: StoredRacePlan,
  productMap: Record<string, PlanProduct>,
): LiveRaceSection[] {
  const values = normalizeStoredPlanValues(plan);
  const elevationProfile = plan.elevationProfile ?? [];
  const baseSpeedKph = getBaseSpeedKph(values);
  const continuousSections = buildContinuousSections({ values, elevationProfile });
  const continuousTimeline = buildContinuousIntakeTimeline({ values, productMap, elevationProfile });

  const sections: LiveRaceSection[] = [];
  for (let sectionIndex = 0; sectionIndex < values.aidStations.length - 1; sectionIndex += 1) {
    const target: PlanTarget = sectionIndex === 0 ? 'start' : sectionIndex;
    const summary = buildPlanSectionSummary({
      values,
      elevationProfile,
      baseSpeedKph,
      target,
    });
    if (!summary) continue;

    const fromStation = values.aidStations[summary.sectionIndex];
    const toStation = values.aidStations[summary.sectionIndex + 1];
    const continuousSection = continuousSections.find((section) => section.sectionIndex === summary.sectionIndex);
    const sectionStartMinute = continuousSection?.startMinute ?? sections.at(-1)?.endMinute ?? 0;
    const sectionTimeline = continuousSection
      ? continuousTimeline.filter((event) => event.sectionIndex === continuousSection.sectionIndex)
      : [];
    const timeline = sectionTimeline.map<LiveIntakeEvent>((event, eventIndex) => ({
      ...event,
      id: `section-${summary.sectionIndex}-intake-${eventIndex}`,
      sectionIndex: summary.sectionIndex,
      absoluteMinute: event.absoluteMinute,
      sectionStartMinute,
      sectionEndMinute: sectionStartMinute + summary.durationMin,
      fromName: fromStation?.name ?? 'Depart',
      toName: toStation?.name ?? 'Arrivee',
      startKm: summary.startKm,
      endKm: summary.endKm,
    }));

    sections.push({
      id: `section-${summary.sectionIndex}`,
      sectionIndex: summary.sectionIndex,
      target,
      fromName: fromStation?.name ?? 'Depart',
      toName: toStation?.name ?? 'Arrivee',
      startKm: summary.startKm,
      endKm: summary.endKm,
      distanceKm: summary.distanceKm,
      durationMin: summary.durationMin,
      pauseMinutes: Math.max(0, fromStation?.pauseMinutes ?? 0),
      startMinute: sectionStartMinute,
      endMinute: sectionStartMinute + summary.durationMin,
      targetCarbsG: summary.targetCarbsG,
      targetSodiumMg: summary.targetSodiumMg,
      targetWaterMl: summary.targetWaterMl,
      timeline,
    });

  }

  return sections;
}

function buildAlertTitle(event: LiveIntakeEvent) {
  return event.label === 'Eau' ? 'Boire' : `Prendre ${event.label}`;
}

function buildAlertBody(event: LiveIntakeEvent) {
  const sectionLabel = `${event.fromName} -> ${event.toName}`;
  return `${event.detail} | ${sectionLabel}`;
}

export function buildLiveAlertSpecs(
  plan: StoredRacePlan,
  productMap: Record<string, PlanProduct>,
): LiveAlertSpec[] {
  return buildLiveRaceSections(plan, productMap).flatMap((section) =>
    section.timeline.map((event) => ({
      id: event.id,
      triggerMinutes: Math.max(0, Math.round(event.absoluteMinute)),
      title: buildAlertTitle(event),
      body: buildAlertBody(event),
      payload: {
        sectionIndex: section.sectionIndex,
        fromName: section.fromName,
        toName: section.toName,
        carbsGrams: Math.round(event.carbsGrams ?? 0),
        sodiumMg: Math.round(event.sodiumMg ?? 0),
        waterMl: Math.round(event.waterMl ?? 0),
        detail: event.detail,
        products: event.products ?? [],
      },
    })),
  );
}

export function buildLiveMetrics(args: {
  plan: StoredRacePlan;
  elapsedMinutes: number;
  totalCarbsConsumed: number;
  totalSodiumConsumed: number;
  totalWaterConsumed: number;
}): LiveMetricState[] {
  const { plan, elapsedMinutes, totalCarbsConsumed, totalSodiumConsumed, totalWaterConsumed } = args;
  const metrics = [
    {
      key: 'carbs' as const,
      label: 'Glucides',
      unit: 'g',
      targetPerHour: plan.targetCarbsPerHour,
      consumed: totalCarbsConsumed,
    },
    {
      key: 'sodium' as const,
      label: 'Sodium',
      unit: 'mg',
      targetPerHour: plan.targetSodiumPerHour,
      consumed: totalSodiumConsumed,
    },
    {
      key: 'water' as const,
      label: 'Eau',
      unit: 'ml',
      targetPerHour: plan.targetWaterPerHour,
      consumed: totalWaterConsumed,
    },
  ];

  return metrics.map((metric) => {
    const depletion = (elapsedMinutes / 60) * metric.targetPerHour;
    const current = metric.targetPerHour - depletion + metric.consumed;
    const denominator = Math.max(metric.targetPerHour, 1);
    return {
      ...metric,
      depletion,
      current,
      ratio: current / denominator,
    };
  });
}

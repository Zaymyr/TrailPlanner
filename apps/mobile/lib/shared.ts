export type SegmentPlanData = {
  carbsGrams: number;
  waterMl: number;
  sodiumMg: number;
  durationMinutes: number;
  distanceKm: number;
  gelsCount?: number;
  products?: Array<{
    id: string;
    name: string;
    carbsGrams: number;
    sodiumMg: number;
    quantity: number;
  }>;
};

export type AidStation = {
  name: string;
  distanceKm: number;
  waterRefill?: boolean;
  segmentPlan?: SegmentPlanData;
};

export type PlannerValues = {
  raceDistanceKm: number;
  elevationGain: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  waterBagLiters: number;
  paceMinutes: number;
  paceSeconds: number;
  aidStations: AidStation[];
  finishPlan?: SegmentPlanData;
  sectionSegments?: Record<string, unknown>;
};

export type RacePlan = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  plannerValues: PlannerValues;
  elevationProfile: Array<{ distanceKm: number; elevationM: number }>;
};

export type AlertTimingMode = 'time';

export type FuelAlert = {
  id: string;
  segmentIndex: number;
  triggerMinutes: number;
  title: string;
  body: string;
  payload: Record<string, unknown>;
};

export type ActiveAlert = FuelAlert & {
  status: 'pending' | 'snoozed' | 'confirmed' | 'skipped';
  snoozedUntilMinutes?: number;
};

export const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;

export function buildAlertSchedule(plan: RacePlan, _mode: AlertTimingMode): FuelAlert[] {
  const { plannerValues } = plan;
  const { aidStations, paceMinutes, paceSeconds, raceDistanceKm } = plannerValues;
  const paceMinPerKm = paceMinutes + paceSeconds / 60;
  const alerts: FuelAlert[] = [];

  const sortedStations = [...aidStations].sort((left, right) => left.distanceKm - right.distanceKm);
  const waypoints: Array<{ name: string; distanceKm: number; segmentPlan?: SegmentPlanData }> = [
    { name: 'Depart', distanceKm: 0 },
    ...sortedStations,
    { name: 'Arrivee', distanceKm: raceDistanceKm, segmentPlan: plannerValues.finishPlan },
  ];

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const from = waypoints[index];
    const to = waypoints[index + 1];
    const segmentDistanceKm = to.distanceKm - from.distanceKm;
    const segmentMinutes = segmentDistanceKm * paceMinPerKm;
    const cumulativeMinutes = from.distanceKm * paceMinPerKm;
    const hours = segmentMinutes / 60;
    const carbsGrams = to.segmentPlan?.carbsGrams ?? Math.round(plannerValues.targetIntakePerHour * hours);
    const waterMl = to.segmentPlan?.waterMl ?? Math.round(plannerValues.waterIntakePerHour * hours);
    const sodiumMg = to.segmentPlan?.sodiumMg ?? Math.round(plannerValues.sodiumIntakePerHour * hours);

    let productsLine = '';
    if (to.segmentPlan?.products?.length) {
      productsLine = ` · ${to.segmentPlan.products.map((product) => `${product.quantity}x ${product.name}`).join(', ')}`;
    } else if (to.segmentPlan?.gelsCount) {
      productsLine = ` · ${to.segmentPlan.gelsCount}x Gel`;
    }

    alerts.push({
      id: `seg-${index}`,
      segmentIndex: index,
      triggerMinutes: Math.round(cumulativeMinutes),
      title: `Seg ${index + 1} -> ${to.name}`,
      body: `${carbsGrams}g glucides · ${waterMl}ml eau · ${sodiumMg}mg sodium${productsLine}`,
      payload: {
        fromName: from.name,
        toName: to.name,
        segmentDistanceKm,
        carbsGrams,
        waterMl,
        sodiumMg,
      },
    });
  }

  return alerts;
}

export function getAlertsToFire(alerts: ActiveAlert[], elapsedMinutes: number): ActiveAlert[] {
  return alerts.filter((alert) => {
    if (alert.status === 'confirmed' || alert.status === 'skipped') {
      return false;
    }

    if (alert.status === 'snoozed') {
      return alert.snoozedUntilMinutes != null && elapsedMinutes >= alert.snoozedUntilMinutes;
    }

    return elapsedMinutes >= alert.triggerMinutes;
  });
}

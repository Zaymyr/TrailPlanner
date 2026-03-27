// ─── Types ───────────────────────────────────────────────────────────────────

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

export type AidStationNutritionItem = {
  fuelType: string;
  productId: string;
  productName: string;
  quantity: number;
  carbsG: number;
};

export type AidStation = {
  name: string;
  distanceKm: number;
  waterRefill?: boolean;
  segmentPlan?: SegmentPlanData;
  nutrition?: AidStationNutritionItem[];
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
  fuelTypes?: string[];
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

export type AlertTimingMode = 'time' | 'gps' | 'auto';

export type FuelAlert = {
  id: string;
  segmentIndex: number;
  triggerMinutes?: number;
  triggerDistanceKm?: number;
  title: string;
  body: string;
  payload: Record<string, unknown>;
};

export type ActiveAlert = FuelAlert & {
  status: 'pending' | 'snoozed' | 'confirmed' | 'skipped';
  snoozedUntilMinutes?: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;

// ─── Alert logic ─────────────────────────────────────────────────────────────

/**
 * Build an alert schedule from a race plan.
 * One alert per segment (at the beginning of each segment between aid stations).
 */
export function buildAlertSchedule(
  plan: RacePlan,
  mode: AlertTimingMode,
): FuelAlert[] {
  const { plannerValues } = plan;
  const { aidStations, paceMinutes, paceSeconds, raceDistanceKm } =
    plannerValues;

  const paceMinPerKm = paceMinutes + paceSeconds / 60;
  const alerts: FuelAlert[] = [];

  // Build waypoints: start → aid stations (sorted by distance) → finish
  const sortedStations = [...aidStations].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  );

  const waypoints: Array<{ name: string; distanceKm: number; segmentPlan?: SegmentPlanData }> = [
    { name: 'Départ', distanceKm: 0 },
    ...sortedStations,
    { name: 'Arrivée', distanceKm: raceDistanceKm, segmentPlan: plannerValues.finishPlan },
  ];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const segmentDistanceKm = to.distanceKm - from.distanceKm;
    const segmentMinutes = segmentDistanceKm * paceMinPerKm;
    const cumulativeMinutes = from.distanceKm * paceMinPerKm;
    const cumulativeKm = from.distanceKm;

    // Compute nutrition targets for this segment
    const hours = segmentMinutes / 60;
    const carbsGrams = to.segmentPlan?.carbsGrams ?? Math.round(plannerValues.targetIntakePerHour * hours);
    const waterMl = to.segmentPlan?.waterMl ?? Math.round(plannerValues.waterIntakePerHour * hours);
    const sodiumMg = to.segmentPlan?.sodiumMg ?? Math.round(plannerValues.sodiumIntakePerHour * hours);

    // Build product summary line
    let productsLine = '';
    if (to.segmentPlan?.products && to.segmentPlan.products.length > 0) {
      productsLine =
        ' · 📦 ' +
        to.segmentPlan.products
          .map((p) => `${p.quantity}x ${p.name}`)
          .join(', ');
    } else if (to.segmentPlan?.gelsCount) {
      productsLine = ` · 📦 ${to.segmentPlan.gelsCount}x Gel`;
    }

    const body = `🍬 ${carbsGrams}g glucides · 💧 ${waterMl}ml eau · 🧂 ${sodiumMg}mg sodium${productsLine}`;
    const title = `Seg ${i + 1} → ${to.name}`;

    const alert: FuelAlert = {
      id: `seg-${i}`,
      segmentIndex: i,
      title,
      body,
      payload: {
        fromName: from.name,
        toName: to.name,
        segmentDistanceKm,
        carbsGrams,
        waterMl,
        sodiumMg,
      },
    };

    // Set trigger based on mode
    if (mode === 'time' || mode === 'auto') {
      alert.triggerMinutes = Math.round(cumulativeMinutes);
    }
    if (mode === 'gps' || mode === 'auto') {
      alert.triggerDistanceKm = cumulativeKm;
    }

    alerts.push(alert);
  }

  return alerts;
}

/**
 * Returns alerts that should fire now.
 * - Pending alerts whose trigger has been reached
 * - Snoozed alerts whose snooze period has expired
 */
export function getAlertsToFire(
  alerts: ActiveAlert[],
  elapsedMinutes: number,
  elapsedKm?: number,
): ActiveAlert[] {
  return alerts.filter((alert) => {
    if (alert.status === 'confirmed' || alert.status === 'skipped') {
      return false;
    }

    if (alert.status === 'snoozed') {
      return (
        alert.snoozedUntilMinutes != null &&
        elapsedMinutes >= alert.snoozedUntilMinutes
      );
    }

    // status === 'pending'
    const timeTriggered =
      alert.triggerMinutes != null && elapsedMinutes >= alert.triggerMinutes;
    const gpsTriggered =
      alert.triggerDistanceKm != null &&
      elapsedKm != null &&
      elapsedKm >= alert.triggerDistanceKm;

    return timeTriggered || gpsTriggered;
  });
}

import { buildPlanShareTimeline, type PlanShareTrackingCheckpoint, type PlanShareTrackingPassage } from './plan-share-tracking';

export const FOLLOWED_PLAN_KM_MATCH_TOLERANCE = 0.15;
export const FOLLOWED_PLAN_COMPLETION_MARGIN_MINUTES = 6 * 60;

export type FollowedPlanCheckpoint = PlanShareTrackingCheckpoint & {
  distanceKm: number;
  pauseMinutes?: number;
  waterState?: string;
  supplies?: Array<{ productId: string; name: string; quantity: number }>;
};

export function estimateFollowedPointMinute(
  distanceKm: number,
  checkpoints: readonly FollowedPlanCheckpoint[],
  passages: readonly PlanShareTrackingPassage[],
) {
  const ordered = checkpoints.slice().sort((left, right) => left.distanceKm - right.distanceKm);
  if (!Number.isFinite(distanceKm) || ordered.length === 0) return null;
  const upperIndex = ordered.findIndex((checkpoint) => checkpoint.distanceKm >= distanceKm);
  const upper = upperIndex < 0 ? ordered.at(-1)! : ordered[upperIndex]!;
  const lower = upperIndex <= 0 ? ordered[0]! : ordered[upperIndex - 1]!;
  const span = upper.distanceKm - lower.distanceKm;
  const ratio = span <= 0 ? 0 : Math.max(0, Math.min(1, (distanceKm - lower.distanceKm) / span));
  const planned = lower.arrivalMinute + (upper.arrivalMinute - lower.arrivalMinute) * ratio;
  const precedingPassages = passages
    .map((passage) => ({ passage, checkpoint: checkpoints.find((checkpoint) => checkpoint.index === passage.checkpointIndex) }))
    .filter((entry) => entry.checkpoint && entry.checkpoint.distanceKm <= distanceKm)
    .sort((left, right) => left.checkpoint!.distanceKm - right.checkpoint!.distanceKm);
  const anchor = precedingPassages.at(-1);
  const correction = anchor ? anchor.passage.actualMinute - anchor.checkpoint!.arrivalMinute : 0;
  return Math.max(0, planned + correction);
}

export function buildFollowedSupporterTimeline(
  points: Array<{ id: string; km: number }>,
  checkpoints: readonly FollowedPlanCheckpoint[],
  passages: readonly PlanShareTrackingPassage[],
  startTime: string,
) {
  const timeline = buildPlanShareTimeline([...checkpoints], [...passages], startTime);
  return points.map((point) => {
    const elapsedMinute = estimateFollowedPointMinute(point.km, checkpoints, passages);
    return {
      ...point,
      elapsedMinute,
      absoluteMinute: elapsedMinute === null || timeline.startMinutes === null ? null : timeline.startMinutes + elapsedMinute,
    };
  });
}

export function buildFollowedPreparation(checkpoints: readonly FollowedPlanCheckpoint[], waterBagLiters: number) {
  const points = checkpoints
    .filter((checkpoint) => checkpoint.assistanceState === 'available' && !checkpoint.isStart && !checkpoint.isFinish)
    .map((checkpoint) => ({
      checkpointIndex: checkpoint.index,
      name: checkpoint.name,
      water: checkpoint.waterState === 'refill' ? waterBagLiters : 0,
      products: (checkpoint.supplies ?? []).filter((product) => product.quantity > 0),
    }));
  const totals = new Map<string, { productId: string; name: string; quantity: number }>();
  points.flatMap((point) => point.products).forEach((product) => {
    const current = totals.get(product.productId);
    totals.set(product.productId, { ...product, quantity: (current?.quantity ?? 0) + product.quantity });
  });
  return {
    points,
    totals: [...totals.values()],
    totalWaterLiters: points.reduce((sum, point) => sum + point.water, 0),
  };
}

const clockMinutes = (value: string | null | undefined) => {
  const match = /^(\d{1,2}):([0-5]\d)/.exec(value ?? '');
  if (!match || Number(match[1]) > 23) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export function resolveFollowedPlanCompletionAt(input: {
  raceDate: string | null;
  officialStartTime: string | null;
  totalDurationMin: number;
  finishCutoffTime?: string | null;
  finishCutoffDayOffset?: number;
  checkpointCutoffs?: Array<{ cutoffTime: string | null; cutoffDayOffset: number }>;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.raceDate ?? '')) return null;
  const dayStart = Date.parse(`${input.raceDate}T00:00:00.000Z`);
  const start = clockMinutes(input.officialStartTime) ?? 0;
  const durations = [Math.max(0, input.totalDurationMin)];
  const addCutoff = (time: string | null | undefined, dayOffset = 0) => {
    const minute = clockMinutes(time);
    if (minute === null) return;
    let elapsed = Math.max(0, Math.floor(dayOffset)) * 1440 + minute - start;
    while (elapsed < 0) elapsed += 1440;
    durations.push(elapsed);
  };
  addCutoff(input.finishCutoffTime, input.finishCutoffDayOffset);
  input.checkpointCutoffs?.forEach((cutoff) => addCutoff(cutoff.cutoffTime, cutoff.cutoffDayOffset));
  return new Date(dayStart + (start + Math.max(...durations) + FOLLOWED_PLAN_COMPLETION_MARGIN_MINUTES) * 60_000).toISOString();
}

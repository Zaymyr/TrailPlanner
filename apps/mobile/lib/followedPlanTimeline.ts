export type TrackingCheckpoint = {
  index: number;
  name: string;
  arrivalMinute: number;
  isStart: boolean;
  isFinish: boolean;
  assistanceState: 'available' | 'unavailable' | 'start' | 'finish';
  distanceKm: number;
  waterState?: string;
  supplies?: { productId: string; name: string; quantity: number }[];
};

export type TrackingPassage = {
  checkpointIndex: number;
  actualMinute: number;
  confirmedAt: string;
};

export function parsePlanShareClock(value: string) {
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function resolvePlanShareClockNearPlanned(clockMinutes: number, plannedAbsoluteMinutes: number) {
  let resolved = clockMinutes;
  while (resolved - plannedAbsoluteMinutes > 720) resolved -= 1440;
  while (plannedAbsoluteMinutes - resolved > 720) resolved += 1440;
  return resolved;
}

export function isPlanShareCrewCheckpoint(checkpoint: TrackingCheckpoint) {
  return checkpoint.assistanceState === 'available' && !checkpoint.isStart && !checkpoint.isFinish;
}

export function isPlanShareTrackableCheckpoint(checkpoint: TrackingCheckpoint) {
  return isPlanShareCrewCheckpoint(checkpoint) || checkpoint.isFinish;
}

export function normalizePlanSharePassages<T extends TrackingPassage>(passages: T[], checkpoints: TrackingCheckpoint[]) {
  const checkpointOrder = new Map(checkpoints.map((checkpoint, order) => [checkpoint.index, order]));
  const byCheckpoint = new Map<number, T>();
  for (const passage of passages) {
    if (!checkpointOrder.has(passage.checkpointIndex)) continue;
    byCheckpoint.set(passage.checkpointIndex, { ...passage, actualMinute: Math.max(0, Math.round(passage.actualMinute)) });
  }
  return [...byCheckpoint.values()].sort(
    (left, right) => (checkpointOrder.get(left.checkpointIndex) ?? 0) - (checkpointOrder.get(right.checkpointIndex) ?? 0),
  );
}

export function buildPlanShareTimeline(checkpoints: TrackingCheckpoint[], passages: TrackingPassage[], startTime: string) {
  const startMinutes = parsePlanShareClock(startTime);
  const passagesByIndex = new Map(passages.map((passage) => [passage.checkpointIndex, passage]));
  const startCheckpoint = checkpoints.find((checkpoint) => checkpoint.isStart) ?? checkpoints[0] ?? null;
  const trackableCheckpoints = checkpoints.filter(isPlanShareTrackableCheckpoint);
  const confirmedTrackable = trackableCheckpoints.filter((checkpoint) => passagesByIndex.has(checkpoint.index));
  const anchorCheckpoint = confirmedTrackable.at(-1) ?? startCheckpoint;
  const anchorPassage = anchorCheckpoint ? passagesByIndex.get(anchorCheckpoint.index) ?? null : null;
  const anchorActualMinute = anchorPassage?.actualMinute ?? 0;
  const anchorAbsolute = startMinutes !== null && anchorCheckpoint ? startMinutes + anchorActualMinute : null;
  const nextCheckpoint = anchorCheckpoint
    ? trackableCheckpoints.find((checkpoint) => checkpoint.index > anchorCheckpoint.index && !passagesByIndex.has(checkpoint.index)) ?? null
    : null;
  const getCheckpointAbsolute = (checkpoint: TrackingCheckpoint) => {
    const confirmed = passagesByIndex.get(checkpoint.index);
    if (startMinutes === null || !anchorCheckpoint) return null;
    if (confirmed) return startMinutes + confirmed.actualMinute;
    if (checkpoint.index >= anchorCheckpoint.index) return startMinutes + anchorActualMinute + checkpoint.arrivalMinute - anchorCheckpoint.arrivalMinute;
    return startMinutes + checkpoint.arrivalMinute;
  };
  const nextAbsolute = nextCheckpoint ? getCheckpointAbsolute(nextCheckpoint) : null;
  const delta = anchorPassage && anchorCheckpoint ? anchorPassage.actualMinute - anchorCheckpoint.arrivalMinute : null;
  return { startMinutes, passagesByIndex, anchorCheckpoint, anchorPassage, anchorAbsolute, nextCheckpoint, nextAbsolute, delta, getCheckpointAbsolute };
}

function estimatePointMinute(distanceKm: number, checkpoints: readonly TrackingCheckpoint[], passages: readonly TrackingPassage[]) {
  const ordered = checkpoints.slice().sort((left, right) => left.distanceKm - right.distanceKm);
  if (!Number.isFinite(distanceKm) || ordered.length === 0) return null;
  const upperIndex = ordered.findIndex((checkpoint) => checkpoint.distanceKm >= distanceKm);
  const upper = upperIndex < 0 ? ordered.at(-1)! : ordered[upperIndex]!;
  const lower = upperIndex <= 0 ? ordered[0]! : ordered[upperIndex - 1]!;
  const span = upper.distanceKm - lower.distanceKm;
  const ratio = span <= 0 ? 0 : Math.max(0, Math.min(1, (distanceKm - lower.distanceKm) / span));
  const planned = lower.arrivalMinute + (upper.arrivalMinute - lower.arrivalMinute) * ratio;
  const anchor = passages
    .map((passage) => ({ passage, checkpoint: checkpoints.find((checkpoint) => checkpoint.index === passage.checkpointIndex) }))
    .filter((entry) => entry.checkpoint && entry.checkpoint.distanceKm <= distanceKm)
    .sort((left, right) => left.checkpoint!.distanceKm - right.checkpoint!.distanceKm)
    .at(-1);
  return Math.max(0, planned + (anchor ? anchor.passage.actualMinute - anchor.checkpoint!.arrivalMinute : 0));
}

export function buildFollowedSupporterTimeline(points: { id: string; km: number }[], checkpoints: readonly TrackingCheckpoint[], passages: readonly TrackingPassage[], startTime: string) {
  const timeline = buildPlanShareTimeline([...checkpoints], [...passages], startTime);
  return points.map((point) => {
    const elapsedMinute = estimatePointMinute(point.km, checkpoints, passages);
    return { ...point, elapsedMinute, absoluteMinute: elapsedMinute === null || timeline.startMinutes === null ? null : timeline.startMinutes + elapsedMinute };
  });
}

export function buildFollowedPreparation(checkpoints: readonly TrackingCheckpoint[], waterBagLiters: number) {
  const points = checkpoints.filter(isPlanShareCrewCheckpoint).map((checkpoint) => ({
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
  return { points, totals: [...totals.values()], totalWaterLiters: points.reduce((sum, point) => sum + point.water, 0) };
}

export type PlanShareTrackingCheckpoint = {
  index: number;
  name: string;
  arrivalMinute: number;
  isStart: boolean;
  isFinish: boolean;
  assistanceState: 'available' | 'unavailable' | 'start' | 'finish';
  waterState?: string;
};

export type PlanShareTrackingPassage = {
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

export function isPlanShareCrewCheckpoint(checkpoint: PlanShareTrackingCheckpoint) {
  return checkpoint.assistanceState === 'available' && !checkpoint.isStart && !checkpoint.isFinish;
}

export function isPlanShareTrackableCheckpoint(checkpoint: PlanShareTrackingCheckpoint) {
  return isPlanShareCrewCheckpoint(checkpoint) || checkpoint.isFinish;
}

export function normalizePlanSharePassages<T extends PlanShareTrackingPassage>(
  passages: T[],
  checkpoints: PlanShareTrackingCheckpoint[],
) {
  const checkpointOrder = new Map(checkpoints.map((checkpoint, order) => [checkpoint.index, order]));
  const byCheckpoint = new Map<number, T>();

  for (const passage of passages) {
    if (!checkpointOrder.has(passage.checkpointIndex)) continue;
    byCheckpoint.set(passage.checkpointIndex, {
      ...passage,
      actualMinute: Math.max(0, Math.round(passage.actualMinute)),
    });
  }

  return Array.from(byCheckpoint.values()).sort(
    (a, b) => (checkpointOrder.get(a.checkpointIndex) ?? 0) - (checkpointOrder.get(b.checkpointIndex) ?? 0),
  );
}

export function buildPlanShareTimeline(
  checkpoints: PlanShareTrackingCheckpoint[],
  passages: PlanShareTrackingPassage[],
  startTime: string,
) {
  const startMinutes = parsePlanShareClock(startTime);
  const passagesByIndex = new Map(passages.map((passage) => [passage.checkpointIndex, passage]));
  const startCheckpoint = checkpoints.find((checkpoint) => checkpoint.isStart) ?? checkpoints[0] ?? null;
  const trackableCheckpoints = checkpoints.filter(isPlanShareTrackableCheckpoint);
  const confirmedTrackable = trackableCheckpoints.filter((checkpoint) => passagesByIndex.has(checkpoint.index));
  const anchorCheckpoint = confirmedTrackable[confirmedTrackable.length - 1] ?? startCheckpoint;
  const anchorPassage = anchorCheckpoint ? passagesByIndex.get(anchorCheckpoint.index) ?? null : null;
  const anchorActualMinute = anchorPassage?.actualMinute ?? 0;
  const anchorAbsolute = startMinutes !== null && anchorCheckpoint ? startMinutes + anchorActualMinute : null;
  const nextCheckpoint = anchorCheckpoint
    ? trackableCheckpoints.find(
        (checkpoint) => checkpoint.index > anchorCheckpoint.index && !passagesByIndex.has(checkpoint.index),
      ) ?? null
    : null;

  const getCheckpointAbsolute = (checkpoint: PlanShareTrackingCheckpoint) => {
    const confirmed = passagesByIndex.get(checkpoint.index);
    if (startMinutes === null || !anchorCheckpoint) return null;
    if (confirmed) return startMinutes + confirmed.actualMinute;
    if (checkpoint.index >= anchorCheckpoint.index) {
      return startMinutes + anchorActualMinute + checkpoint.arrivalMinute - anchorCheckpoint.arrivalMinute;
    }
    return startMinutes + checkpoint.arrivalMinute;
  };

  const nextAbsolute = nextCheckpoint ? getCheckpointAbsolute(nextCheckpoint) : null;
  const delta = anchorPassage && anchorCheckpoint
    ? anchorPassage.actualMinute - anchorCheckpoint.arrivalMinute
    : null;

  return {
    startMinutes,
    passagesByIndex,
    anchorCheckpoint,
    anchorPassage,
    anchorAbsolute,
    nextCheckpoint,
    nextAbsolute,
    delta,
    getCheckpointAbsolute,
  };
}

/**
 * Elapsed minute for a crew-corrected passage clock ("HH:mm"), resolved to the
 * day closest to the planned passage so overnight races stay coherent.
 */
export function resolvePlanSharePassageCorrection(
  clock: string,
  startTime: string,
  checkpoint: Pick<PlanShareTrackingCheckpoint, 'arrivalMinute'>,
) {
  const startMinutes = parsePlanShareClock(startTime);
  const clockMinutes = parsePlanShareClock(clock);
  if (startMinutes === null || clockMinutes === null) return null;
  const absolute = resolvePlanShareClockNearPlanned(clockMinutes, startMinutes + checkpoint.arrivalMinute);
  return Math.max(0, Math.round(absolute - startMinutes));
}

/** A checkpoint is behind the runner once it, or a later checkpoint, has a confirmed passage. */
export function isPlanShareCheckpointPassed(
  checkpoint: Pick<PlanShareTrackingCheckpoint, 'index'>,
  timeline: Pick<ReturnType<typeof buildPlanShareTimeline>, 'anchorCheckpoint' | 'anchorPassage' | 'passagesByIndex'>,
) {
  if (timeline.passagesByIndex.has(checkpoint.index)) return true;
  return Boolean(timeline.anchorPassage && timeline.anchorCheckpoint && checkpoint.index < timeline.anchorCheckpoint.index);
}

/** "HH:mm" wall clock of an absolute minute (day offset dropped), for prefilling a correction. */
export function formatPlanShareClockInput(absoluteMinutes: number) {
  const minute = ((Math.round(absoluteMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export type PlanShareHandoverItem = {
  key: string;
  kind: 'product' | 'water';
  name: string;
  quantity: number | null;
  liters: number | null;
};

/** Checklist of what the crew hands over at one assistance checkpoint. */
export function buildPlanShareCheckpointHandover(
  checkpoint: Pick<PlanShareTrackingCheckpoint, 'index' | 'waterState'> & {
    supplies?: ReadonlyArray<{ productId: string; name: string; quantity: number }>;
  },
  waterBagLiters: number,
): PlanShareHandoverItem[] {
  const products: PlanShareHandoverItem[] = (checkpoint.supplies ?? [])
    .filter((product) => product.quantity > 0)
    .map((product) => ({
      key: `${checkpoint.index}:${product.productId}`,
      kind: 'product',
      name: product.name,
      quantity: product.quantity,
      liters: null,
    }));
  if (checkpoint.waterState !== 'refill') return products;
  return [
    ...products,
    { key: `${checkpoint.index}:water`, kind: 'water', name: 'water', quantity: null, liters: waterBagLiters > 0 ? waterBagLiters : null },
  ];
}

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

export function normalizePlanClock(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})(?:(?::|h)(\d{0,2}))?(?::\d{2})?$/i);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function readOrganizerStartTime(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const schedule = (details as Record<string, unknown>).schedule;
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return null;
  return normalizePlanClock((schedule as Record<string, unknown>).startTime);
}

export function readOrganizerFinishCutoffTime(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const schedule = (details as Record<string, unknown>).schedule;
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return null;
  return normalizePlanClock((schedule as Record<string, unknown>).finishCutoffTime);
}

export function resolveMaximumRaceMinutes(startTime: string | null | undefined, finishCutoffTime: string | null | undefined) {
  const start = normalizePlanClock(startTime);
  const finish = normalizePlanClock(finishCutoffTime);
  if (!start || !finish) return null;
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [finishHours, finishMinutes] = finish.split(':').map(Number);
  const elapsed = (finishHours * 60 + finishMinutes - (startHours * 60 + startMinutes) + 1440) % 1440;
  return elapsed > 0 ? elapsed : 1440;
}

export function buildLocalDepartureAt(raceDate: string | null | undefined, startTime: string | null) {
  if (!raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate) || !startTime) return null;
  return `${raceDate}T${startTime}:00`;
}

export function buildRaceDateBase(raceDate: string | null | undefined, fallback = new Date()) {
  if (!raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) return fallback;
  const date = new Date(`${raceDate}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

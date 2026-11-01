/**
 * Matching rules for the personal-plan reflection shown in the RaceBook.
 *
 * New plan rows retain the official aid-station id. Older rows predate that
 * field, so they may only fall back to the normalized name + nearby kilometer
 * pair. A row which has a source id is never used by that legacy fallback: an
 * outdated id must not silently become a different official aid station.
 */
export const LEGACY_AID_STATION_KM_TOLERANCE = 0.15;

export type OfficialAidStationForReflection = {
  id: string;
  name: string;
  km: number;
};

export type PersonalAidStationForReflection = {
  sourceAidStationId?: string | null;
  name: string;
  distanceKm: number;
};

export type AidStationPlanMatch<T extends PersonalAidStationForReflection> = {
  checkpoint: T;
  index: number;
  matchedBy: 'sourceAidStationId' | 'legacyNameAndKm';
};

export type PersonalPassageCheckpoint = {
  distanceKm: number;
  arrivalMinute: number;
  pauseMinutes?: number | null;
};

export function estimatePersonalSegmentDuration(
  target: Pick<PersonalPassageCheckpoint, 'arrivalMinute' | 'pauseMinutes'> | null | undefined,
  previous: Pick<PersonalPassageCheckpoint, 'arrivalMinute' | 'pauseMinutes'> | null | undefined,
) {
  if (!target || !Number.isFinite(target.arrivalMinute)) return null;
  const previousDepartureMinute = previous
    ? previous.arrivalMinute + Math.max(0, previous.pauseMinutes ?? 0)
    : 0;
  return Math.max(0, target.arrivalMinute - previousDepartureMinute);
}

function clockToMinutes(value: string | null | undefined) {
  const match = /^(\d{1,2})(?:(?::|h)(\d{0,2}))?(?::\d{2})?$/i.exec(value?.trim() ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Returns a display-safe 24-hour clock only for a standalone clock value.
 * Rich organizer wording deliberately remains unparsed so callers can retain
 * it verbatim instead of guessing which time within it is the cutoff.
 */
export function normalizeSimpleClock(value: string | null | undefined) {
  const minutes = clockToMinutes(value);
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Formats a plan arrival without creating a Date, so race timezone and device
 * timezone cannot change the displayed day. Day zero is the race departure
 * day; later passages receive an explicit J+N prefix.
 */
export function formatPersonalPassageClock(
  departureClock: string | null | undefined,
  passageMinute: number,
) {
  const departureMinute = clockToMinutes(departureClock);
  if (departureMinute === null || !Number.isFinite(passageMinute) || passageMinute < 0) return null;

  const absoluteMinute = departureMinute + passageMinute;
  const dayOffset = Math.floor(absoluteMinute / (24 * 60));
  const clockMinute = absoluteMinute % (24 * 60);
  const hours = Math.floor(clockMinute / 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(clockMinute % 60).padStart(2, '0')}`;
  return dayOffset === 0 ? clock : `J+${dayOffset} · ${clock}`;
}

/**
 * Resolves a standalone organizer cutoff clock to elapsed race minutes.
 * Clock-only cutoffs recur every 24 hours for multi-day races, so the
 * occurrence closest to the planned-passage anchor wins. It is never allowed
 * before the first chronological cutoff following departure; exact ties keep
 * the earlier occurrence. Rich cutoff text intentionally returns null.
 */
export function resolveCutoffMinuteAfterDeparture(
  departureClock: string | null | undefined,
  cutoffClock: string | null | undefined,
  passageMinute?: number | null,
) {
  const departureClockMinute = clockToMinutes(departureClock);
  const cutoffClockMinute = clockToMinutes(cutoffClock);
  if (departureClockMinute === null || cutoffClockMinute === null) return null;

  const dayMinutes = 24 * 60;
  const firstOccurrence = (cutoffClockMinute - departureClockMinute + dayMinutes) % dayMinutes;
  if (typeof passageMinute !== 'number' || !Number.isFinite(passageMinute) || passageMinute < 0) {
    return firstOccurrence;
  }

  const anchor = passageMinute;
  const approximateDay = Math.max(0, Math.floor((anchor - firstOccurrence) / dayMinutes));
  const candidates = [approximateDay, approximateDay + 1]
    .map((day) => firstOccurrence + day * dayMinutes)
    .sort((left, right) => Math.abs(left - anchor) - Math.abs(right - anchor) || left - right);
  return candidates[0] ?? firstOccurrence;
}

/**
 * Compares a plan passage with the cutoff occurrence whose race day is closest
 * to that passage. The organizer contract stores standalone clocks only, so
 * richer cutoff wording intentionally remains non-comparable.
 */
export function isPersonalPassageAfterCutoff(
  departureClock: string | null | undefined,
  passageMinute: number,
  cutoffClock: string | null | undefined,
) {
  const cutoffMinuteAfterDeparture = resolveCutoffMinuteAfterDeparture(
    departureClock,
    cutoffClock,
    passageMinute,
  );
  if (cutoffMinuteAfterDeparture === null || !Number.isFinite(passageMinute)) return false;
  return passageMinute > cutoffMinuteAfterDeparture;
}

/**
 * Estimates an official passage omitted by an older or simplified plan.
 * Interpolation includes the pause at the preceding personal checkpoint.
 */
export function estimatePersonalPassageMinute(
  distanceKm: number,
  checkpoints: readonly PersonalPassageCheckpoint[] | null | undefined,
) {
  if (!Number.isFinite(distanceKm) || !Array.isArray(checkpoints)) return null;

  const ordered = checkpoints
    .filter((checkpoint) =>
      Number.isFinite(checkpoint.distanceKm) && Number.isFinite(checkpoint.arrivalMinute),
    )
    .slice()
    .sort((left, right) => left.distanceKm - right.distanceKm);
  if (ordered.length === 0) return null;

  const exact = ordered.find((checkpoint) => Math.abs(checkpoint.distanceKm - distanceKm) < 0.001);
  if (exact) return Math.max(0, exact.arrivalMinute);

  const upperIndex = ordered.findIndex((checkpoint) => checkpoint.distanceKm > distanceKm);
  if (upperIndex === 0) {
    const upper = ordered[0];
    if (!upper || upper.distanceKm <= 0) return Math.max(0, upper?.arrivalMinute ?? 0);
    return Math.max(0, upper.arrivalMinute * (distanceKm / upper.distanceKm));
  }

  if (upperIndex < 0) {
    const last = ordered.at(-1);
    const previous = ordered.at(-2);
    if (!last) return null;
    if (!previous || last.distanceKm <= previous.distanceKm) return Math.max(0, last.arrivalMinute);
    const previousDepartureMinute = previous.arrivalMinute + Math.max(0, previous.pauseMinutes ?? 0);
    const minutesPerKm = (last.arrivalMinute - previousDepartureMinute) / (last.distanceKm - previous.distanceKm);
    return Math.max(0, last.arrivalMinute + Math.max(0, distanceKm - last.distanceKm) * minutesPerKm);
  }

  const lower = ordered[upperIndex - 1];
  const upper = ordered[upperIndex];
  if (!lower || !upper || upper.distanceKm <= lower.distanceKm) return null;

  const lowerDepartureMinute = lower.arrivalMinute + Math.max(0, lower.pauseMinutes ?? 0);
  const ratio = (distanceKm - lower.distanceKm) / (upper.distanceKm - lower.distanceKm);
  return Math.max(0, lowerDepartureMinute + (upper.arrivalMinute - lowerDepartureMinute) * ratio);
}

export function resolvePersonalAidStationTargetIndex(
  checkpoints: readonly { id?: string | null; sourceAidStationId?: string | null }[],
  targetAidStationId: string,
) {
  const sourceIndex = checkpoints.findIndex(
    (checkpoint) => checkpoint.sourceAidStationId === targetAidStationId,
  );
  if (sourceIndex >= 0) return sourceIndex;
  return checkpoints.findIndex((checkpoint) => checkpoint.id === targetAidStationId);
}

/** Normalizes only the historic name identity: case, accents and whitespace. */
export function normalizeAidStationNameForReflection(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasSameSourceId(
  official: OfficialAidStationForReflection,
  checkpoint: PersonalAidStationForReflection,
) {
  return Boolean(official.id) && checkpoint.sourceAidStationId === official.id;
}

function compareCandidate<T extends PersonalAidStationForReflection>(
  left: { checkpoint: T; index: number },
  right: { checkpoint: T; index: number },
  officialKm: number,
) {
  const leftDistance = Math.abs(left.checkpoint.distanceKm - officialKm);
  const rightDistance = Math.abs(right.checkpoint.distanceKm - officialKm);
  return leftDistance - rightDistance || left.index - right.index;
}

/**
 * Finds the single personal checkpoint corresponding to an official ravito.
 * The selection is deterministic when legacy data contains duplicates: the
 * closest kilometer wins, then the earliest checkpoint in plan order.
 */
export function matchPersonalAidStation<T extends PersonalAidStationForReflection>(
  official: OfficialAidStationForReflection,
  checkpoints: readonly T[] | null | undefined,
  options: { legacyKmTolerance?: number } = {},
): AidStationPlanMatch<T> | null {
  if (!Array.isArray(checkpoints) || !Number.isFinite(official.km)) return null;

  const sourceMatches = checkpoints
    .map((checkpoint, index) => ({ checkpoint, index }))
    .filter(({ checkpoint }) => hasSameSourceId(official, checkpoint));

  if (sourceMatches.length > 0) {
    sourceMatches.sort((left, right) => compareCandidate(left, right, official.km));
    const selected = sourceMatches[0];
    return selected ? { ...selected, matchedBy: 'sourceAidStationId' } : null;
  }

  const tolerance = options.legacyKmTolerance ?? LEGACY_AID_STATION_KM_TOLERANCE;
  if (!Number.isFinite(tolerance) || tolerance < 0) return null;

  const normalizedName = normalizeAidStationNameForReflection(official.name);
  if (!normalizedName) return null;

  const legacyMatches = checkpoints
    .map((checkpoint, index) => ({ checkpoint, index }))
    .filter(({ checkpoint }) =>
      !checkpoint.sourceAidStationId &&
      Number.isFinite(checkpoint.distanceKm) &&
      normalizeAidStationNameForReflection(checkpoint.name) === normalizedName &&
      Math.abs(checkpoint.distanceKm - official.km) <= tolerance,
    );

  legacyMatches.sort((left, right) => compareCandidate(left, right, official.km));
  const selected = legacyMatches[0];
  return selected ? { ...selected, matchedBy: 'legacyNameAndKm' } : null;
}

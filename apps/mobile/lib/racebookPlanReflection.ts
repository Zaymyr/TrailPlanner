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

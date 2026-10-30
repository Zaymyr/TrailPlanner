/**
 * Presentation-only classification for the RaceBook ravito chronology.
 *
 * The organizer may persist an arrival checkpoint at a slightly different
 * kilometer than the format's official distance. Do not use proximity for
 * this classification: a genuine ravito can legitimately be close to the
 * finish. Only an explicit arrival label turns the last checkpoint into the
 * finish card.
 */
export type RacebookFinishCandidate = {
  name: string;
};

function normalizeFinishName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isExplicitRacebookFinishName(name: string) {
  const normalized = normalizeFinishName(name);
  return normalized === 'arrivee' || normalized === 'finish';
}

/**
 * Only the last organizer checkpoint can replace the official endpoint.
 * This keeps a nearby ordinary ravito in the chronology, while allowing a
 * deliberately named Arrivée/Finish row to retain its organizer services and
 * notes on the arrival card.
 */
export function resolveRacebookFinishStation<T extends RacebookFinishCandidate>(
  stations: readonly T[],
) {
  const lastStation = stations.at(-1);
  return lastStation && isExplicitRacebookFinishName(lastStation.name) ? lastStation : null;
}

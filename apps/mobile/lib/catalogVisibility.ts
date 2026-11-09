const FAVORITE_PAST_EVENT_RETENTION_DAYS = 14;

type CatalogEditionRace = {
  edition_id?: string | null;
  race_date?: string | null;
};

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseCatalogDate(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

export function isCatalogEventVisible(
  isoDate: string | null | undefined,
  isFavorite: boolean,
  now = new Date(),
) {
  if (!isoDate) return true;

  const raceDate = parseCatalogDate(isoDate);
  if (!raceDate) return true;

  const today = startOfLocalDay(now);
  if (raceDate >= today) return true;
  if (!isFavorite) return false;

  const oldestVisibleFavoriteDate = new Date(today);
  oldestVisibleFavoriteDate.setDate(
    oldestVisibleFavoriteDate.getDate() - FAVORITE_PAST_EVENT_RETENTION_DAYS,
  );

  return raceDate >= oldestVisibleFavoriteDate;
}

export function filterCatalogRacesByEditionRetention<TRace extends CatalogEditionRace>(
  races: TRace[],
  now = new Date(),
) {
  const editionEndDates = new Map<string, Date>();

  for (const race of races) {
    if (!race.edition_id || !race.race_date) continue;

    const raceDate = parseCatalogDate(race.race_date);
    if (!raceDate) continue;

    const currentEndDate = editionEndDates.get(race.edition_id);
    if (!currentEndDate || raceDate > currentEndDate) {
      editionEndDates.set(race.edition_id, raceDate);
    }
  }

  if (editionEndDates.size < 2) return races;

  const newestEdition = [...editionEndDates.entries()].sort(
    ([, leftEndDate], [, rightEndDate]) => rightEndDate.getTime() - leftEndDate.getTime(),
  )[0];
  if (!newestEdition) return races;

  const oldestRetainedEditionEndDate = startOfLocalDay(now);
  oldestRetainedEditionEndDate.setDate(
    oldestRetainedEditionEndDate.getDate() - FAVORITE_PAST_EVENT_RETENTION_DAYS,
  );

  const retainedEditionIds = new Set(
    [...editionEndDates.entries()]
      .filter(([editionId, editionEndDate]) => (
        editionId === newestEdition[0] || editionEndDate >= oldestRetainedEditionEndDate
      ))
      .map(([editionId]) => editionId),
  );

  return races.filter((race) => (
    !race.edition_id
    || !editionEndDates.has(race.edition_id)
    || retainedEditionIds.has(race.edition_id)
  ));
}

/** True when the event date is strictly before today (local calendar day). */
export function isCatalogEventPast(isoDate: string | null | undefined, now = new Date()) {
  if (!isoDate) return false;
  const raceDate = parseCatalogDate(isoDate);
  if (!raceDate) return false;
  return raceDate < startOfLocalDay(now);
}

type SortableCatalogEvent = { id: string; name: string; race_date: string | null };

/**
 * Upcoming events always come before past ones; favorites are pinned first only
 * inside each group so a finished favorite never sits above an upcoming race.
 */
export function sortCatalogEvents<TEvent extends SortableCatalogEvent>(
  events: TEvent[],
  favoriteEventIds: string[] = [],
  now = new Date(),
) {
  const getTimestamp = (value: string | null) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const parsed = parseCatalogDate(value);
    return parsed ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
  };
  const favoriteIds = new Set(favoriteEventIds);

  return [...events].sort((left, right) => {
    const leftPast = isCatalogEventPast(left.race_date, now);
    const rightPast = isCatalogEventPast(right.race_date, now);
    if (leftPast !== rightPast) return leftPast ? 1 : -1;

    const leftFavorite = favoriteIds.has(left.id);
    const rightFavorite = favoriteIds.has(right.id);
    if (leftFavorite !== rightFavorite) return leftFavorite ? -1 : 1;

    const timestampDiff = leftPast
      ? getTimestamp(right.race_date) - getTimestamp(left.race_date)
      : getTimestamp(left.race_date) - getTimestamp(right.race_date);
    if (timestampDiff !== 0) return timestampDiff;
    return left.name.localeCompare(right.name);
  });
}

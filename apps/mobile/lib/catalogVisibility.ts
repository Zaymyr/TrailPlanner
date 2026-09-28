const FAVORITE_PAST_EVENT_RETENTION_DAYS = 14;

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

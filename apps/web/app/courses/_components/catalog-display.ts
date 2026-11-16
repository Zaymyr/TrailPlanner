import type { PublicRace } from "../../../lib/public-races";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

const shortMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short", timeZone: "UTC",
});

const parseCatalogDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) return null;
  const isoDate = value.slice(0, 10);
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate ? null : parsed;
};

export const formatCatalogDate = (date: string | null) => {
  const parsed = parseCatalogDate(date);
  return parsed ? dateFormatter.format(parsed) : "Date à confirmer";
};

const getSharedValue = (races: PublicRace[], select: (race: PublicRace) => string | null) => {
  const selectedValues = races.map(select);
  if (selectedValues.some((value) => !value)) return null;
  const values = Array.from(new Set(selectedValues.filter((value): value is string => Boolean(value))));
  return values.length === 1 ? values[0] : null;
};

export const getEventDateLabel = (races: PublicRace[]) => {
  const dates = Array.from(
    new Map(races.map((race) => parseCatalogDate(race.date)).filter((date): date is Date => date !== null).map((date) => [date.toISOString().slice(0, 10), date])).values(),
  ).sort((left, right) => left.getTime() - right.getTime());
  if (!dates.length) return "Date à confirmer";
  if (dates.length === 1) return races.every((race) => parseCatalogDate(race.date)) ? dateFormatter.format(dates[0]) : "Dates selon le format";

  const first = dates[0];
  const last = dates.at(-1) ?? first;
  const firstMonth = shortMonthFormatter.format(first);
  const lastMonth = shortMonthFormatter.format(last);
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  const sameMonth = sameYear && first.getUTCMonth() === last.getUTCMonth();
  if (sameMonth) return `${first.getUTCDate()}–${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
  if (sameYear) return `${first.getUTCDate()} ${firstMonth} – ${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
  return `${first.getUTCDate()} ${firstMonth} ${first.getUTCFullYear()} – ${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
};

export const getEventLocationLabel = (races: PublicRace[]) => {
  const sharedLocation = getSharedValue(races, (race) => race.location);
  if (sharedLocation) return sharedLocation;
  const sharedCity = getSharedValue(races, (race) => race.locationCity);
  if (sharedCity) return sharedCity;
  const distinctLocations = new Set(races.map((race) => race.location?.trim()).filter((value): value is string => Boolean(value)));
  if (!distinctLocations.size) return "Lieu à confirmer";
  return `${distinctLocations.size} lieu${distinctLocations.size > 1 ? "x" : ""} de départ`;
};

const normalizeLabel = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Display-only format label inside its event context: drops a leading copy of
 * the event name (« SaintéLyon — SaintéTic » → « SaintéTic »). The full name is
 * kept when nothing meaningful would remain.
 */
export const getFormatLabelWithinEvent = (name: string, eventName: string | null | undefined) => {
  if (!eventName) return name;
  const normalizedName = normalizeLabel(name);
  const normalizedEvent = normalizeLabel(eventName.trim());
  if (!normalizedEvent || !normalizedName.startsWith(normalizedEvent)) return name;
  const remainder = name.slice(eventName.trim().length).replace(/^[\s\-–—:|·,]+/, "").trim();
  return remainder.length >= 2 ? remainder : name;
};

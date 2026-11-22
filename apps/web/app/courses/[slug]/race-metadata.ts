import type { PublicRace } from "../../../lib/public-races";

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const truncateSeoText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const candidate = value.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const cutAt = lastSpace >= Math.floor(maxLength * 0.7) ? lastSpace : candidate.length;
  return `${candidate.slice(0, cutAt).trimEnd()}…`;
};

const truncateSeoIdentity = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return "…";

  // Race formats often share a long event prefix and differ only by the code
  // or format name at the end. Preserve both ends so truncation does not erase
  // the part that distinguishes two sibling course pages.
  const availableLength = maxLength - 1;
  const tailLength = Math.max(1, Math.floor(availableLength * 0.4));
  const headLength = availableLength - tailLength;
  return `${value.slice(0, headLength).trimEnd()}…${value.slice(-tailLength).trimStart()}`;
};

export const formatPublicRaceDate = (date: string | null) => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return dateFormatter.format(parsed);
};

const getEditionYear = (race: PublicRace) => {
  const match = race.date?.match(/^(\d{4})-/);
  return match?.[1] ?? null;
};

const normalizeForMatch = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");

// A format name such as « 10 km » or « Trail 22 km » is shared by many events;
// prefix the parent event so two course pages never emit the same title.
const buildRaceIdentity = (race: PublicRace) => {
  const eventName = race.eventName?.trim();
  if (!eventName) return race.name;
  const name = normalizeForMatch(race.name);
  const event = normalizeForMatch(eventName);
  if (name.includes(event) || event.includes(name)) return race.name;
  return `${eventName} — ${race.name}`;
};

export const buildRaceMetadataTitle = (race: PublicRace) => {
  const year = getEditionYear(race);
  const identity = buildRaceIdentity(race);
  const distanceLabel = race.distanceKm !== null ? `${race.distanceKm.toLocaleString("fr-FR")} km` : null;
  // Do not repeat a distance the race name already carries (« SaintéLyon — 80 km »)
  // unless the name has to be truncated, where the suffix keeps formats distinct.
  const nameCarriesDistance = distanceLabel !== null && normalizeForMatch(identity).includes(normalizeForMatch(distanceLabel));
  const buildSuffix = (includeDistance: boolean) => {
    const facts = [includeDistance ? distanceLabel : null, year].filter((value): value is string => Boolean(value));
    return facts.length ? ` | ${facts.join(" · ")}` : " | infos course";
  };
  const compactSuffix = buildSuffix(!nameCarriesDistance);
  const compact = `${identity}${compactSuffix}`;
  if (compact.length <= MAX_TITLE_LENGTH) {
    const hook = " · temps & ravitos";
    return compact.length + hook.length <= MAX_TITLE_LENGTH ? `${compact}${hook}` : compact;
  }
  const suffix = buildSuffix(true);
  return `${truncateSeoIdentity(identity, MAX_TITLE_LENGTH - suffix.length)}${suffix}`;
};

const EVENT_TITLE_SUFFIXES = [" : formats, parcours et ravitos", " : parcours et ravitos", " : formats et parcours"];

export const buildEventEditionMetadataTitle = (eventName: string, editionYear: number | string | null) => {
  const name = eventName.trim();
  const year = editionYear === null ? "" : String(editionYear);
  const identity = year && !name.includes(year) ? `${name} ${year}` : name;
  for (const suffix of EVENT_TITLE_SUFFIXES) {
    if (identity.length + suffix.length <= MAX_TITLE_LENGTH) return `${identity}${suffix}`;
  }
  if (identity.length <= MAX_TITLE_LENGTH) return identity;
  const yearSuffix = year && identity.endsWith(year) ? ` ${year}` : "";
  return `${truncateSeoText(identity.slice(0, identity.length - yearSuffix.length), MAX_TITLE_LENGTH - yearSuffix.length)}${yearSuffix}`;
};

export const buildRaceMetadataDescription = (race: PublicRace | null, estimateRange: string | null = null) => {
  if (!race) return "Fiche d’une course de trail sur Pace Yourself.";
  const details = [
    // French decimal comma, like the title (« 158,68 km », never « 158.68 km »).
    race.distanceKm !== null ? `${race.distanceKm.toLocaleString("fr-FR")} km` : null,
    race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : null,
    race.location,
    formatPublicRaceDate(race.date),
  ].filter(Boolean);
  const identity = buildRaceIdentity(race);
  const intro = details.length ? `${identity} : ${details.join(", ")}.` : `${identity} sur Pace Yourself.`;
  const hook = estimateRange
    ? ` Temps estimé de ${estimateRange} selon ton niveau. Parcours, ravitos, infos pratiques.`
    : " Parcours, ravitos, infos pratiques et ton temps estimé gratuitement.";
  return truncateSeoText(`${intro}${hook}`, MAX_DESCRIPTION_LENGTH);
};

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
  const cutAt = lastSpace > 0 ? lastSpace : candidate.length;
  return `${candidate.slice(0, cutAt).trimEnd()}…`;
};

// Trademark signs and import underscores add nothing to a search title.
const cleanDisplayName = (value: string) =>
  value.replace(/[®™]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

const FORMAT_SEPARATOR = /\s+[—–-]\s+/;
const GENERIC_FORMAT_WORDS = new Set([
  "trail", "ultra", "course", "format", "race", "run", "marathon", "semi", "relais", "duo", "solo",
  "km", "mile", "miles", "the", "de", "du", "des", "la", "le", "les", "et",
]);

// A format name carries its own identity when it keeps at least one word that
// is neither a distance nor a generic word (« Ultra-Trail des Chevaliers »,
// « OCC »), unlike « Trail 22 km » that many events share.
const isDistinctiveFormat = (format: string) =>
  normalizeWords(format).some((word) => /[a-z]{3,}/.test(word) && !GENERIC_FORMAT_WORDS.has(word));

const normalizeWords = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !/^\d+(k|km|m)?$/.test(word));

// « Trail Alsace by UTMB — Ultra-Trail des Chevaliers » → « Ultra-Trail des Chevaliers ».
const extractFormatName = (name: string, eventName: string | null) => {
  if (!eventName) return name;
  const parts = name.split(FORMAT_SEPARATOR);
  const event = normalizeForMatch(eventName);
  // Drop the shortest leading part that repeats the event name, keep the rest
  // (« … by UTMB - Monistrail - 50K » → « Monistrail - 50K »).
  for (let index = 1; index < parts.length; index += 1) {
    const head = normalizeForMatch(parts.slice(0, index).join(" "));
    const repeatsEvent = head.includes(event) || (event.includes(head) && head.length >= event.length * 0.6);
    if (repeatsEvent) return parts.slice(index).join(" - ");
  }
  return name;
};

// « Trail du Saint Jacques by UTMB » → « Trail du Saint Jacques ».
const shortenEventName = (eventName: string) => eventName.replace(/\s+by\s+UTMB\b/i, "").trim();

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
  // Punctuation is ignored too, so « d’Azur » matches « d'Azur ».
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// A format name such as « 10 km » or « Trail 22 km » is shared by many events;
// prefix the parent event so two course pages never emit the same title.
const composeIdentity = (raceName: string, eventName: string | null) => {
  if (!eventName) return raceName;
  const name = normalizeForMatch(raceName);
  const event = normalizeForMatch(eventName);
  if (name.includes(event) || event.includes(name)) return raceName;
  return `${eventName} — ${raceName}`;
};

const buildRaceIdentity = (race: PublicRace) =>
  composeIdentity(cleanDisplayName(race.name), race.eventName ? cleanDisplayName(race.eventName) || null : null);

// Shorter identities, most informative first, used when the full one does not
// fit. Each keeps the format name so sibling course pages stay distinct.
const buildShorterIdentities = (race: PublicRace) => {
  const eventName = race.eventName ? cleanDisplayName(race.eventName) || null : null;
  const format = extractFormatName(cleanDisplayName(race.name), eventName);
  const candidates: string[] = [];
  if (eventName) {
    const shortEvent = shortenEventName(eventName);
    candidates.push(composeIdentity(format, eventName));
    if (shortEvent !== eventName) candidates.push(composeIdentity(format, shortEvent));
    if (isDistinctiveFormat(format)) candidates.push(format);
    // Generic format (« Marathon »): keep it with the leading words of the event.
    const eventWords = shortEvent.split(" ");
    for (let count = eventWords.length - 1; count >= 2; count -= 1) {
      const head = eventWords.slice(0, count);
      while (head.length > 1 && TRAILING_STOP_WORDS.has(head[head.length - 1].toLowerCase())) head.pop();
      if (head.length >= 2) candidates.push(composeIdentity(format, head.join(" ")));
    }
  }
  return candidates;
};

const TRAILING_STOP_WORDS = new Set(["by", "de", "du", "des", "la", "le", "les", "à", "a", "et", "en", "d'", "l'", "-", "—"]);

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
  const maxIdentityLength = MAX_TITLE_LENGTH - suffix.length;
  const shorter = buildShorterIdentities(race).find((candidate) => candidate.length <= maxIdentityLength);
  if (shorter) return `${shorter}${suffix}`;
  // Last resort: cut on a word boundary, never inside a word.
  return `${truncateSeoText(identity, maxIdentityLength)}${suffix}`;
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
  const buildIntro = (identity: string, withLocation: boolean) => {
    const details = [
      // French decimal comma, like the title (« 158,68 km », never « 158.68 km »).
      race.distanceKm !== null ? `${race.distanceKm.toLocaleString("fr-FR")} km` : null,
      race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : null,
      withLocation ? race.location : null,
      formatPublicRaceDate(race.date),
    ].filter(Boolean);
    return details.length ? `${identity} : ${details.join(", ")}.` : `${identity} sur Pace Yourself.`;
  };
  const hooks = estimateRange
    ? [
        ` Temps estimé de ${estimateRange} selon ton niveau. Parcours, ravitos, infos pratiques.`,
        ` Temps estimé de ${estimateRange} selon ton niveau.`,
      ]
    : [" Parcours, ravitos, infos pratiques et ton temps estimé gratuitement.", " Parcours, ravitos et temps estimé."];
  const identities = [buildRaceIdentity(race), ...buildShorterIdentities(race)];
  // Prefer a complete sentence over a snippet cut with « … »: drop the
  // optional parts (long hook, location, long event name) before truncating.
  for (const identity of identities) {
    for (const withLocation of [true, false]) {
      for (const hook of hooks) {
        const text = `${buildIntro(identity, withLocation)}${hook}`;
        if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
      }
    }
  }
  return truncateSeoText(`${buildIntro(identities[0], true)}${hooks[0]}`, MAX_DESCRIPTION_LENGTH);
};

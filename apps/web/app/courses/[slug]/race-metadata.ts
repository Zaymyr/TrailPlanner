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

export const buildRaceMetadataTitle = (race: PublicRace) => {
  const year = getEditionYear(race);
  const distance = race.distanceKm !== null ? `${race.distanceKm.toLocaleString("fr-FR")} km` : null;
  const facts = [distance, year].filter((value): value is string => Boolean(value));
  const suffix = facts.length ? ` | ${facts.join(" · ")}` : " | infos course";
  return `${truncateSeoIdentity(race.name, MAX_TITLE_LENGTH - suffix.length)}${suffix}`;
};

export const buildRaceMetadataDescription = (race: PublicRace | null) => {
  if (!race) return "Fiche d’une course de trail sur Pace Yourself.";
  const details = [
    race.distanceKm !== null ? `${race.distanceKm} km` : null,
    race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : null,
    race.location,
    formatPublicRaceDate(race.date),
  ].filter(Boolean);
  const intro = details.length ? `${race.name} : ${details.join(", ")}.` : `${race.name} sur Pace Yourself.`;
  return truncateSeoText(
    `${intro} Retrouvez les informations de course et la source officielle.`,
    MAX_DESCRIPTION_LENGTH,
  );
};

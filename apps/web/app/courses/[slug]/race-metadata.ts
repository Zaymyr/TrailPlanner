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

export const formatPublicRaceDate = (date: string | null) => {
  if (!date) return null;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
};

const getEditionYear = (race: PublicRace) => {
  const match = race.date?.match(/^(\d{4})-/);
  return match?.[1] ?? null;
};

export const buildRaceMetadataTitle = (race: PublicRace) => {
  const year = getEditionYear(race);
  const yearSuffix = year && !new RegExp(`(^|\\D)${year}(\\D|$)`).test(race.name) ? ` ${year}` : "";
  const suffix = `${yearSuffix} : parcours et profil`;
  return `${truncateSeoText(race.name, MAX_TITLE_LENGTH - suffix.length)}${suffix}`;
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
    `${intro} Consultez le parcours, le profil altimétrique et les informations pratiques.`,
    MAX_DESCRIPTION_LENGTH,
  );
};

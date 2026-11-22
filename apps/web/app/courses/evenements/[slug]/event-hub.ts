import type { PublicRaceEventEdition, PublicRaceEventHub } from "../../../../lib/public-race-events";
import { buildEventEditionMetadataTitle } from "../../[slug]/race-metadata";

const MAX_DESCRIPTION_LENGTH = 160;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Permanent hub path when the event has a durable slug, otherwise the edition page itself. */
export const getEventEditionCanonicalPath = (edition: Pick<PublicRaceEventEdition, "slug" | "eventSlug">) =>
  `/courses/evenements/${edition.eventSlug ?? edition.slug}`;

/** A year stored at the end of an event name (« Grand Raid Réunion 2026 ») is not part of the permanent identity. */
export const getEventHubName = (eventName: string) => eventName.replace(/\s+(19|20)\d{2}\s*$/, "").trim() || eventName;

/**
 * Hub titles carry the featured edition year only while that edition is still
 * to come, so the permanent URL is never titled with a finished year.
 */
export const buildEventHubMetadataTitle = (hub: Pick<PublicRaceEventHub, "eventName">, featuredYear: number | null) =>
  buildEventEditionMetadataTitle(getEventHubName(hub.eventName), featuredYear);

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const candidate = value.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastSpace > maxLength * 0.7 ? lastSpace : candidate.length).trimEnd()}…`;
};

export const buildEventHubDescription = (hub: PublicRaceEventHub, featuredIsPast: boolean) => {
  const name = getEventHubName(hub.eventName);
  const { featured } = hub;
  const date = dateFormatter.format(new Date(`${featured.startDate}T12:00:00Z`));
  const distances = featured.formats
    .map((format) => format.distanceKm)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const formatCount = featured.formats.length;
  const range = distances.length > 1
    ? ` de ${distances[0].toLocaleString("fr-FR")} à ${distances.at(-1)?.toLocaleString("fr-FR")} km`
    : distances.length ? ` de ${distances[0].toLocaleString("fr-FR")} km` : "";
  const intro = featuredIsPast
    ? `${name} : dernière édition le ${date}, ${formatCount} format${formatCount > 1 ? "s" : ""}${range}.`
    : `${name} : prochaine édition le ${date}, ${formatCount} format${formatCount > 1 ? "s" : ""}${range}.`;
  return truncate(`${intro} Parcours, dénivelés, ravitos et toutes les éditions.`, MAX_DESCRIPTION_LENGTH);
};

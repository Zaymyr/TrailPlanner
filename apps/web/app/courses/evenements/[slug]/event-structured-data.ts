import type { PublicRaceEventEdition } from "../../../../lib/public-race-events";
import { DEFAULT_SOCIAL_IMAGE_PATH } from "../../../seo";

export const buildEventEditionDescription = (edition: PublicRaceEventEdition) => {
  const formatCount = edition.formats.length;
  const distances = edition.formats
    .map((format) => format.distanceKm)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const distanceSummary = distances.length
    ? ` de ${distances[0].toLocaleString("fr-FR")} à ${distances.at(-1)?.toLocaleString("fr-FR")} km`
    : "";
  return `${edition.eventName} ${edition.editionYear} propose ${formatCount} format${formatCount > 1 ? "s" : ""}${distanceSummary}. Consultez les dates, parcours, dénivelés et ravitaillements publiés.`;
};

const isHttpUrl = (value: string | null | undefined): value is string => Boolean(value && /^https?:\/\//i.test(value));

/** Normalized parent-event locality carried by the formats; never parsed from display labels. */
const buildEditionAddress = (edition: PublicRaceEventEdition) => {
  const source = edition.formats.find((format) => format.locationCity || format.locationRegion || format.locationCountry);
  if (!source) return null;
  const address = {
    "@type": "PostalAddress",
    ...(source.locationCity ? { addressLocality: source.locationCity } : {}),
    ...(source.locationRegion ?? source.locationDepartment ? { addressRegion: source.locationRegion ?? source.locationDepartment } : {}),
    ...(source.locationCountry ? { addressCountry: source.locationCountry } : {}),
  };
  return Object.keys(address).length > 1 ? address : null;
};

export const buildEventEditionStructuredData = (
  edition: PublicRaceEventEdition,
  canonicalUrl: string,
) => {
  const siteOrigin = new URL(canonicalUrl).origin;
  const address = buildEditionAddress(edition);
  const placeName = edition.location ?? address?.addressLocality ?? null;
  const image = isHttpUrl(edition.thumbnailUrl)
    ? edition.thumbnailUrl
    : edition.formats.map((format) => format.raceThumbnailUrl).find(isHttpUrl)
      ?? new URL(DEFAULT_SOCIAL_IMAGE_PATH, siteOrigin).toString();
  return ({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${canonicalUrl}#event`,
    name: `${edition.eventName} ${edition.editionYear}`,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    startDate: edition.startDate,
    endDate: edition.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Course à pied",
    image: [image],
    ...(placeName || address ? {
      location: {
        "@type": "Place",
        ...(placeName ? { name: placeName } : {}),
        ...(address ? { address } : {}),
      },
    } : {}),
    organizer: {
      "@type": "Organization",
      name: edition.eventName,
      ...(isHttpUrl(edition.websiteUrl) ? { url: edition.websiteUrl } : {}),
    },
    ...(isHttpUrl(edition.websiteUrl) ? {
      offers: { "@type": "Offer", url: edition.websiteUrl },
    } : {}),
    description: buildEventEditionDescription(edition),
    // Each format page publishes its complete SportsEvent under this @id. A bare
    // reference links them without Google validating a second, partial Event.
    subEvent: edition.formats.map((format) => ({ "@id": `${siteOrigin}/courses/${format.slug}#event` })),
  });
};

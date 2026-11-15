import type { PublicRaceEventEdition } from "../../../../lib/public-race-events";

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

export const buildEventEditionStructuredData = (
  edition: PublicRaceEventEdition,
  canonicalUrl: string,
) => {
  const siteOrigin = new URL(canonicalUrl).origin;
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
  ...(edition.thumbnailUrl ? { image: [edition.thumbnailUrl] } : {}),
  ...(edition.location ? {
    location: {
      "@type": "Place",
      name: edition.location,
    },
  } : {}),
  organizer: {
    "@type": "Organization",
    name: edition.eventName,
    ...(edition.websiteUrl && /^https?:\/\//i.test(edition.websiteUrl) ? { url: edition.websiteUrl } : {}),
  },
  ...(edition.websiteUrl && /^https?:\/\//i.test(edition.websiteUrl) ? {
    offers: { "@type": "Offer", url: edition.websiteUrl },
  } : {}),
  description: buildEventEditionDescription(edition),
  subEvent: edition.formats.map((format) => ({
    "@type": "SportsEvent",
    "@id": `${siteOrigin}/courses/${format.slug}#event`,
    name: format.name,
    url: `${siteOrigin}/courses/${format.slug}`,
    ...(format.date ? { startDate: format.date } : {}),
  })),
  });
};

import type { PublicRaceDetail } from "../../../lib/public-race-detail";

import { buildRaceMetadataDescription } from "./race-metadata";

export const buildRaceStructuredData = (race: PublicRaceDetail, canonicalUrl: string) => {
  const heroImage = race.raceThumbnailUrl ?? race.eventThumbnailUrl;
  const sameAs = Array.from(
    new Set(
      [race.externalSiteUrl, race.officialWebsiteUrl, race.instagramUrl, race.facebookUrl]
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${canonicalUrl}#event`,
    name: race.name,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    startDate: race.date ?? undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Course à pied",
    image: heroImage ? [heroImage] : undefined,
    location: race.location
      ? {
          "@type": "Place",
          name: race.location,
          address: {
            "@type": "PostalAddress",
            name: race.location,
          },
        }
      : undefined,
    description: buildRaceMetadataDescription(race),
    sameAs: sameAs.length ? sameAs : undefined,
  };
};

export const buildRaceOverview = (race: PublicRaceDetail, formattedDate: string | null) => {
  const eventContext = race.eventName && race.eventName !== race.name
    ? `Cette course fait partie de l’événement ${race.eventName}. `
    : "";
  const schedule = [formattedDate ? `le ${formattedDate}` : null, race.location ? `à ${race.location}` : null]
    .filter(Boolean)
    .join(" ");
  const metrics = [
    race.distanceKm !== null ? `${race.distanceKm} km` : null,
    race.elevationGainM !== null ? `${Math.round(race.elevationGainM).toLocaleString("fr-FR")} m de dénivelé positif` : null,
  ].filter(Boolean);

  return `${eventContext}${race.name} est une course${schedule ? ` prévue ${schedule}` : ""}${metrics.length ? ` sur ${metrics.join(" et ")}` : ""}. Cette fiche rassemble les caractéristiques vérifiées, les informations pratiques disponibles et le lien vers la source officielle.`;
};

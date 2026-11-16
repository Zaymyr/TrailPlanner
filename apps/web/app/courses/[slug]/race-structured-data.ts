import type { PublicRaceDetail } from "../../../lib/public-race-detail";

import { DEFAULT_SOCIAL_IMAGE_PATH } from "../../seo";
import { buildRaceMetadataDescription, formatPublicRaceDate } from "./race-metadata";

export const buildRaceStructuredData = (race: PublicRaceDetail, canonicalUrl: string, estimateRange: string | null = null) => {
  // Google requires a valid startDate for Event rich results. Omitting the
  // complete SportsEvent is safer than publishing an ineligible partial item.
  if (!race.date || !formatPublicRaceDate(race.date)) return null;

  const heroImage = race.raceThumbnailUrl ?? race.eventThumbnailUrl;
  const registrationUrl = [race.eventWebsiteUrl, race.externalSiteUrl]
    .find((value): value is string => Boolean(value && /^https?:\/\//i.test(value)));
  const organizerUrl = [race.officialWebsiteUrl, race.eventWebsiteUrl]
    .find((value): value is string => Boolean(value && /^https?:\/\//i.test(value)));
  const sameAs = Array.from(
    new Set(
      [race.externalSiteUrl, race.officialWebsiteUrl, race.instagramUrl, race.facebookUrl]
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const postalAddress = {
    "@type": "PostalAddress",
    ...(race.practical.access.startAddress ? { streetAddress: race.practical.access.startAddress } : {}),
    ...(race.locationCity ? { addressLocality: race.locationCity } : {}),
    ...(race.locationRegion ?? race.locationDepartment ? { addressRegion: race.locationRegion ?? race.locationDepartment } : {}),
    ...(race.locationCountry ? { addressCountry: race.locationCountry } : {}),
  };
  const hasStructuredAddress = Object.keys(postalAddress).length > 1;
  const hasGeo = race.startLatitude !== null
    && race.startLongitude !== null
    && race.startLatitude >= -90
    && race.startLatitude <= 90
    && race.startLongitude >= -180
    && race.startLongitude <= 180;
  const placeName = race.practical.access.startLocation.label ?? race.location;
  const hasLocation = Boolean(placeName || hasStructuredAddress || hasGeo);

  const parseClockMinutes = (value: string | null) => {
    if (!value) return null;
    const match = value.trim().match(/^(?:([01]?\d|2[0-3])(?::([0-5]\d)(?::[0-5]\d)?|h([0-5]\d)?)?)$/i);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2] ?? match[3] ?? 0);
  };
  const startMinutes = parseClockMinutes(race.practical.schedule.startTime);
  const finishMinutes = parseClockMinutes(race.practical.schedule.finishCutoffTime);
  const validEventEndDate = race.eventEndDate && formatPublicRaceDate(race.eventEndDate)
    ? race.eventEndDate
    : null;
  const endDate = validEventEndDate === race.date
    ? validEventEndDate
    : validEventEndDate && validEventEndDate > race.date
      && startMinutes !== null && finishMinutes !== null && finishMinutes <= startMinutes
      ? validEventEndDate
      : null;

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${canonicalUrl}#event`,
    name: race.name,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    startDate: race.date,
    ...(endDate ? { endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Course à pied",
    // Google recommends an image on every Event; fall back to the site preview.
    image: [heroImage && /^https?:\/\//i.test(heroImage) ? heroImage : new URL(DEFAULT_SOCIAL_IMAGE_PATH, canonicalUrl).toString()],
    ...(hasLocation ? {
      location: {
        "@type": "Place",
        ...(placeName ? { name: placeName } : {}),
        ...(hasStructuredAddress ? { address: postalAddress } : {}),
        ...(hasGeo ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: race.startLatitude,
            longitude: race.startLongitude,
          },
        } : {}),
      },
    } : {}),
    organizer: {
      "@type": "Organization",
      name: race.eventName ?? race.name,
      ...(organizerUrl ? { url: organizerUrl } : {}),
    },
    ...(race.eventEditionSlug && race.eventName ? {
      // The edition page publishes the complete parent SportsEvent under this
      // @id; a bare reference avoids Google validating a partial nested Event.
      superEvent: {
        "@id": `${new URL(`/courses/evenements/${race.eventEditionSlug}`, canonicalUrl).toString()}#event`,
      },
    } : {}),
    ...(registrationUrl ? {
      offers: {
        "@type": "Offer",
        url: registrationUrl,
      },
    } : {}),
    description: buildRaceMetadataDescription(race, estimateRange),
    ...(sameAs.length ? { sameAs } : {}),
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

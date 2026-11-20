import type { VideoGeneratorDetail } from "../../../lib/video-generator";
import type { VideoRaceInfo } from "./VideoCompositionOverlay";
import { getReelFormatName, getReelShortName } from "./reel-hook";

/**
 * The race as the reel shows it (title with the edition year, start detail, short name), from the
 * video generator detail. Pure: shared by the editor page and the server-built automatic reels, so
 * both produce the same render snapshot.
 */

const formatStartDetail = (race: VideoGeneratorDetail["race"]) => {
  const date = race.raceDate && /^\d{4}-\d{2}-\d{2}/.test(race.raceDate)
    ? new Date(`${race.raceDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;
  const parts = [shortenPlace(race.startLocation), date, race.startTime].filter((part): part is string => Boolean(part?.trim()));
  return parts.length ? parts.join(" · ") : null;
};

/**
 * Organizer start places are often full postal addresses ("Musée de Bibracte, Mont Beuvray, 71990
 * Saint-Léger-sous-Beuvray"). The video only needs the landmark: the first part of the address.
 */
const shortenPlace = (place: string | null | undefined) => {
  const first = place?.split(/[,\n]/)[0]?.trim();
  if (!first) return null;
  return first.length > 48 ? `${first.slice(0, 47).trimEnd()}…` : first;
};

export const buildVideoRaceInfo = (detail: VideoGeneratorDetail): VideoRaceInfo => {
  const { race } = detail;
  const baseTitle = race.eventName ?? race.name;
  return {
    id: race.id,
    title: race.editionYear && !baseTitle.includes(String(race.editionYear))
      ? `${baseTitle} ${race.editionYear}`
      : baseTitle,
    subtitle: race.eventName && race.eventName !== race.name ? race.name : null,
    distanceKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
    startDetail: formatStartDetail(race),
    shortName: getReelShortName(race.eventName ?? race.name, race.eventShortName),
    formatName: race.eventName ? getReelFormatName(race.name, race.eventName, race.eventShortName) : null,
    startPlace: shortenPlace(race.startLocation),
    raceDate: race.raceDate,
    startTime: race.startTime,
  };
};


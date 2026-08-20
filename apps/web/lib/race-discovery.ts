import type { PublicRace } from "./public-races";

export const MIN_INDEXABLE_RACES = 5;

export const distanceLandingPages = [
  {
    slug: "trail-court",
    label: "Trails de moins de 30 km",
    shortLabel: "Trail court",
    title: "Trails courts de moins de 30 km",
    description:
      "Découvrez les trails courts de moins de 30 km publiés sur Pace Yourself, avec leur date, leur lieu et leur dénivelé.",
    matches: (distanceKm: number) => distanceKm < 30,
  },
  {
    slug: "trail-30-79-km",
    label: "Trails de 30 à 79 km",
    shortLabel: "30 à 79 km",
    title: "Courses de trail de 30 à 79 km",
    description:
      "Comparez les courses de trail de 30 à 79 km publiées sur Pace Yourself avant de préparer votre allure et votre nutrition.",
    matches: (distanceKm: number) => distanceKm >= 30 && distanceKm < 80,
  },
  {
    slug: "ultra-trail",
    label: "Ultra-trails de 80 km et plus",
    shortLabel: "Ultra-trail",
    title: "Ultra-trails de 80 km et plus",
    description:
      "Trouvez un ultra-trail de 80 km ou plus et consultez les informations disponibles pour préparer votre stratégie de course.",
    matches: (distanceKm: number) => distanceKm >= 80,
  },
] as const;

export type DistanceLandingPage = (typeof distanceLandingPages)[number];

export function getDistanceLandingPage(slug: string): DistanceLandingPage | null {
  return distanceLandingPages.find((page) => page.slug === slug) ?? null;
}

export function getRacesForDistancePage(races: PublicRace[], page: DistanceLandingPage): PublicRace[] {
  return races.filter((race) => race.distanceKm !== null && page.matches(race.distanceKm));
}

export function getIndexableDistancePages(races: PublicRace[]) {
  return distanceLandingPages
    .map((page) => ({ page, races: getRacesForDistancePage(races, page) }))
    .filter(({ races: matchingRaces }) => matchingRaces.length >= MIN_INDEXABLE_RACES);
}

export function getOtherEventFormats(race: PublicRace, races: PublicRace[], limit = 6): PublicRace[] {
  if (!race.eventId) return [];

  return races
    .filter((candidate) => candidate.id !== race.id && candidate.eventId === race.eventId)
    .sort((left, right) => (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY))
    .slice(0, limit);
}

export function getSimilarRaces(race: PublicRace, races: PublicRace[], limit = 3): PublicRace[] {
  if (race.distanceKm === null) return [];
  const sourceDistanceKm = race.distanceKm;

  return races
    .filter(
      (candidate) =>
        candidate.id !== race.id &&
        (!race.eventId || candidate.eventId !== race.eventId) &&
        candidate.distanceKm !== null,
    )
    .map((candidate) => ({
      candidate,
      distanceDelta: Math.abs((candidate.distanceKm as number) - sourceDistanceKm),
      elevationDelta:
        candidate.elevationGainM !== null && race.elevationGainM !== null
          ? Math.abs(candidate.elevationGainM - race.elevationGainM)
          : Number.POSITIVE_INFINITY,
    }))
    .sort(
      (left, right) =>
        left.distanceDelta - right.distanceDelta ||
        left.elevationDelta - right.elevationDelta ||
        left.candidate.name.localeCompare(right.candidate.name, "fr"),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

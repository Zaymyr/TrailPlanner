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

export type PublicRaceGroup = {
  key: string;
  eventId: string | null;
  editionId: string | null;
  eventName: string | null;
  races: PublicRace[];
};

export type RaceTemporalStatus = "upcoming" | "past" | "undated";
export type RaceDistanceFilter = "all" | "short" | "trail" | "ultra";
export type RacePeriodFilter = "upcoming" | "past" | "all";

const validDateTimestamp = (value: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const compareRaceFormats = (left: PublicRace, right: PublicRace) =>
  (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY) ||
  left.name.localeCompare(right.name, "fr") ||
  left.id.localeCompare(right.id);

const compareRaceGroups = (left: PublicRaceGroup, right: PublicRaceGroup) => {
  const leftDate = Math.min(...left.races.map((race) => validDateTimestamp(race.date)));
  const rightDate = Math.min(...right.races.map((race) => validDateTimestamp(race.date)));
  const leftName = left.eventName ?? left.races[0]?.name ?? "";
  const rightName = right.eventName ?? right.races[0]?.name ?? "";

  return leftDate - rightDate || leftName.localeCompare(rightName, "fr") || left.key.localeCompare(right.key);
};

/**
 * Groups an already-public catalog by stable event identity. Standalone races
 * deliberately stay independent; display names are never used as identities.
 */
export function groupPublicRacesByEvent(races: PublicRace[]): PublicRaceGroup[] {
  const groups = new Map<string, PublicRaceGroup>();
  const seenRaceIds = new Set<string>();

  for (const race of races) {
    if (seenRaceIds.has(race.id)) continue;
    seenRaceIds.add(race.id);

    const key = race.eventId
      ? race.editionId
        ? `event:${race.eventId}:edition:${race.editionId}`
        : `event:${race.eventId}`
      : `race:${race.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.races.push(race);
      if (!existing.eventName && race.eventName) existing.eventName = race.eventName;
      continue;
    }

    groups.set(key, {
      key,
      eventId: race.eventId,
      editionId: race.editionId,
      eventName: race.eventName,
      races: [race],
    });
  }

  return [...groups.values()]
    .map((group) => ({ ...group, races: [...group.races].sort(compareRaceFormats) }))
    .sort(compareRaceGroups);
}

export function getRaceTemporalStatus(race: PublicRace, todayIso: string): RaceTemporalStatus {
  if (!race.date || !/^\d{4}-\d{2}-\d{2}/.test(race.date)) return "undated";
  return race.date.slice(0, 10) < todayIso ? "past" : "upcoming";
}

const normalizeCatalogSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

export function filterPublicRaces(
  races: PublicRace[],
  filters: { search: string; distance: RaceDistanceFilter; period: RacePeriodFilter; todayIso: string },
) {
  const query = normalizeCatalogSearch(filters.search.trim());
  return races.filter((race) => {
    const searchable = normalizeCatalogSearch([race.name, race.eventName, race.location].filter(Boolean).join(" "));
    const km = race.distanceKm;
    const matchesDistance =
      filters.distance === "all" ||
      (filters.distance === "short" && km !== null && km < 30) ||
      (filters.distance === "trail" && km !== null && km >= 30 && km < 80) ||
      (filters.distance === "ultra" && km !== null && km >= 80);
    const temporalStatus = getRaceTemporalStatus(race, filters.todayIso);
    const matchesPeriod =
      filters.period === "all" ||
      (filters.period === "past"
        ? temporalStatus === "past"
        : temporalStatus === "upcoming" || temporalStatus === "undated");
    return (!query || searchable.includes(query)) && matchesDistance && matchesPeriod;
  });
}

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
    .filter(
      (candidate) =>
        candidate.id !== race.id &&
        candidate.eventId === race.eventId &&
        (!race.editionId || candidate.editionId === race.editionId),
    )
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

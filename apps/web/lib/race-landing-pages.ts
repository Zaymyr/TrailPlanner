import { isDemoRaceEventId } from "./demo-race";
import type { PublicRace } from "./public-races";
import {
  getIndexableDistancePages,
  getRaceTemporalStatus,
  groupPublicRacesByEvent,
  MIN_INDEXABLE_RACES,
  type PublicRaceGroup,
} from "./race-discovery";

/**
 * Prefiltered landing pages (distance, French region, month). Pure helpers so
 * routes, the sitemap and tests share one definition of the page contents.
 */

export const LANDING_GROUPS_PER_PAGE = 12;
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

/** INSEE region codes stored in `race_events.location_region_code`. */
export const frenchRegions = [
  { code: "01", slug: "guadeloupe", label: "Guadeloupe", inLabel: "en Guadeloupe" },
  { code: "02", slug: "martinique", label: "Martinique", inLabel: "en Martinique" },
  { code: "03", slug: "guyane", label: "Guyane", inLabel: "en Guyane" },
  { code: "04", slug: "la-reunion", label: "La Réunion", inLabel: "à La Réunion" },
  { code: "06", slug: "mayotte", label: "Mayotte", inLabel: "à Mayotte" },
  { code: "11", slug: "ile-de-france", label: "Île-de-France", inLabel: "en Île-de-France" },
  { code: "24", slug: "centre-val-de-loire", label: "Centre-Val de Loire", inLabel: "en Centre-Val de Loire" },
  { code: "27", slug: "bourgogne-franche-comte", label: "Bourgogne-Franche-Comté", inLabel: "en Bourgogne-Franche-Comté" },
  { code: "28", slug: "normandie", label: "Normandie", inLabel: "en Normandie" },
  { code: "32", slug: "hauts-de-france", label: "Hauts-de-France", inLabel: "dans les Hauts-de-France" },
  { code: "44", slug: "grand-est", label: "Grand Est", inLabel: "dans le Grand Est" },
  { code: "52", slug: "pays-de-la-loire", label: "Pays de la Loire", inLabel: "dans les Pays de la Loire" },
  { code: "53", slug: "bretagne", label: "Bretagne", inLabel: "en Bretagne" },
  { code: "75", slug: "nouvelle-aquitaine", label: "Nouvelle-Aquitaine", inLabel: "en Nouvelle-Aquitaine" },
  { code: "76", slug: "occitanie", label: "Occitanie", inLabel: "en Occitanie" },
  { code: "84", slug: "auvergne-rhone-alpes", label: "Auvergne-Rhône-Alpes", inLabel: "en Auvergne-Rhône-Alpes" },
  { code: "93", slug: "provence-alpes-cote-d-azur", label: "Provence-Alpes-Côte d’Azur", inLabel: "en Provence-Alpes-Côte d’Azur" },
  { code: "94", slug: "corse", label: "Corse", inLabel: "en Corse" },
] as const;

export type FrenchRegion = (typeof frenchRegions)[number];

export const getFrenchRegionByCode = (code: string | null | undefined): FrenchRegion | null =>
  frenchRegions.find((region) => region.code === code) ?? null;

export const getFrenchRegionBySlug = (slug: string): FrenchRegion | null =>
  frenchRegions.find((region) => region.slug === slug) ?? null;

const monthNames = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;
const monthSlugs = monthNames.map((name) => name.normalize("NFD").replace(/[̀-ͯ]/g, ""));

export type MonthLandingPage = { key: string; slug: string; label: string; year: number; month: number };

/** `2027-05` → `{ slug: "mai-2027", label: "mai 2027" }`. */
export const getMonthLandingPage = (key: string): MonthLandingPage | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { key, slug: `${monthSlugs[month - 1]}-${year}`, label: `${monthNames[month - 1]} ${year}`, year, month };
};

export const parseMonthSlug = (slug: string): MonthLandingPage | null => {
  const match = /^([a-z]+)-(\d{4})$/.exec(slug);
  if (!match) return null;
  const monthIndex = monthSlugs.indexOf(match[1]);
  if (monthIndex < 0) return null;
  return getMonthLandingPage(`${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`);
};

export const getTodayInFrance = (now: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/**
 * Landing pages only list dated, upcoming formats (today included) and never
 * the Trail TST demo. A finished format stays reachable from its event hub.
 */
export const getLandingRaces = (races: PublicRace[], todayIso: string) =>
  races.filter((race) => !isDemoRaceEventId(race.eventId) && getRaceTemporalStatus(race, todayIso) === "upcoming");

export const getIndexableDistanceLandingPages = (races: PublicRace[], todayIso: string) =>
  getIndexableDistancePages(getLandingRaces(races, todayIso));

export const getRacesForRegion = (landingRaces: PublicRace[], region: FrenchRegion) =>
  landingRaces.filter((race) => race.regionSlug === region.slug);

export const getIndexableRegionPages = (races: PublicRace[], todayIso: string) => {
  const landingRaces = getLandingRaces(races, todayIso);
  return frenchRegions
    .map((region) => ({ region, races: getRacesForRegion(landingRaces, region) }))
    .filter(({ races: matching }) => matching.length >= MIN_INDEXABLE_RACES);
};

export const getRacesForMonth = (landingRaces: PublicRace[], month: MonthLandingPage) =>
  landingRaces.filter((race) => race.date?.slice(0, 7) === month.key);

export const getIndexableMonthPages = (races: PublicRace[], todayIso: string) => {
  const landingRaces = getLandingRaces(races, todayIso);
  const keys = Array.from(new Set(landingRaces.map((race) => race.date?.slice(0, 7) ?? ""))).sort();
  return keys
    .map((key) => getMonthLandingPage(key))
    .filter((month): month is MonthLandingPage => Boolean(month))
    .map((month) => ({ month, races: getRacesForMonth(landingRaces, month) }))
    .filter(({ races: matching }) => matching.length >= MIN_INDEXABLE_RACES);
};

/**
 * Optional `[[...page]]` segment: none → page 1, `page/<n>` with n ≥ 2 → n.
 * Anything else (including `page/1`, which duplicates the base URL) is invalid.
 */
export const parseLandingPageSegments = (segments: string[] | undefined): number | null => {
  if (!segments || segments.length === 0) return 1;
  if (segments.length !== 2 || segments[0] !== "page" || !/^[1-9]\d*$/.test(segments[1])) return null;
  const page = Number(segments[1]);
  return page >= 2 && Number.isSafeInteger(page) ? page : null;
};

export const getLandingPagePath = (basePath: string, page: number) => (page > 1 ? `${basePath}/page/${page}` : basePath);

export type LandingPageView = {
  page: number;
  totalPages: number;
  groups: PublicRaceGroup[];
  raceCount: number;
  firstRacePosition: number;
};

export const paginateLandingRaces = (races: PublicRace[], page: number, perPage = LANDING_GROUPS_PER_PAGE): LandingPageView => {
  const allGroups = groupPublicRacesByEvent(races);
  const totalPages = Math.max(1, Math.ceil(allGroups.length / perPage));
  const offset = (page - 1) * perPage;
  return {
    page,
    totalPages,
    groups: allGroups.slice(offset, offset + perPage),
    raceCount: races.length,
    firstRacePosition: allGroups.slice(0, offset).reduce((count, group) => count + group.races.length, 0) + 1,
  };
};

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const candidate = value.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastSpace > maxLength * 0.7 ? lastSpace : candidate.length).trimEnd()}…`;
};

/** First candidate that fits 60 characters with the page suffix. */
export const buildLandingTitle = (candidates: string[], page: number) => {
  const suffix = page > 1 ? ` – page ${page}` : "";
  const fitting = candidates.find((candidate) => candidate.length + suffix.length <= MAX_TITLE_LENGTH);
  return `${fitting ?? truncate(candidates.at(-1) ?? "", MAX_TITLE_LENGTH - suffix.length)}${suffix}`;
};

export const buildLandingDescription = (description: string, page: number) =>
  truncate(page > 1 ? `Page ${page}. ${description}` : description, MAX_DESCRIPTION_LENGTH);

export const regionLandingCopy = (region: FrenchRegion, raceCount: number) => ({
  titleCandidates: [
    `Trail ${region.inLabel} : calendrier des courses`,
    `Trail ${region.inLabel} : calendrier`,
    `Trail ${region.inLabel}`,
  ],
  heading: `Courses de trail ${region.inLabel}`,
  description: `${raceCount} courses de trail à venir ${region.inLabel} : dates, distances, dénivelés et lieux. Choisissez votre format et estimez votre temps.`,
});

export const monthLandingCopy = (month: MonthLandingPage, raceCount: number) => ({
  titleCandidates: [
    `Trail en ${month.label} : calendrier des courses`,
    `Trail en ${month.label} : calendrier`,
  ],
  heading: `Courses de trail en ${month.label}`,
  description: `${raceCount} courses de trail en ${month.label} : dates, distances, dénivelés et lieux. Choisissez votre format et estimez votre temps.`,
});

export const buildLandingItemList = (name: string, view: LandingPageView, siteUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  numberOfItems: view.raceCount,
  itemListElement: view.groups.flatMap((group) => group.races).map((race, index) => ({
    "@type": "ListItem",
    position: view.firstRacePosition + index,
    name: race.name,
    url: new URL(`/courses/${race.slug}`, siteUrl).toString(),
  })),
});

export const latestUpdatedAt = (races: PublicRace[]) =>
  races
    .map((race) => race.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

export type LandingLinkGroup = {
  heading: string;
  links: Array<{ href: string; label: string; count: number; current?: boolean }>;
};

/** Internal links between every indexable distance, region and month page. */
export const buildLandingCrossLinks = (races: PublicRace[], todayIso: string, currentPath: string | null = null): LandingLinkGroup[] => [
  {
    heading: "Par distance",
    links: getIndexableDistanceLandingPages(races, todayIso).map(({ page, races: matching }) => ({
      href: `/courses/distances/${page.slug}`,
      label: page.label,
      count: matching.length,
      current: currentPath === `/courses/distances/${page.slug}`,
    })),
  },
  {
    heading: "Par région",
    links: getIndexableRegionPages(races, todayIso).map(({ region, races: matching }) => ({
      href: `/courses/regions/${region.slug}`,
      label: region.label,
      count: matching.length,
      current: currentPath === `/courses/regions/${region.slug}`,
    })),
  },
  {
    heading: "Par mois",
    links: getIndexableMonthPages(races, todayIso).map(({ month, races: matching }) => ({
      href: `/courses/mois/${month.slug}`,
      label: month.label.charAt(0).toUpperCase() + month.label.slice(1),
      count: matching.length,
      current: currentPath === `/courses/mois/${month.slug}`,
    })),
  },
];

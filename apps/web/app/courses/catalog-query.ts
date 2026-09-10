import {
  filterPublicRaces,
  getRaceTemporalStatus,
  groupPublicRacesByEvent,
  type PublicRaceGroup,
  type RaceDistanceFilter,
  type RacePeriodFilter,
} from "../../lib/race-discovery";
import type { PublicRace } from "../../lib/public-races";

export const CATALOG_GROUPS_PER_PAGE = 12;

type SearchParamValue = string | string[] | undefined;

export type CatalogSearchParams = {
  q?: SearchParamValue;
  distance?: SearchParamValue;
  period?: SearchParamValue;
  page?: SearchParamValue;
};

export type CatalogQuery = {
  search: string;
  distance: RaceDistanceFilter;
  period: RacePeriodFilter;
  page: number;
};

export type CatalogView = CatalogQuery & {
  groups: PublicRaceGroup[];
  filteredRaceCount: number;
  eventGroupCount: number;
  totalPages: number;
  firstRacePosition: number;
};

const firstValue = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value);

export const parseCatalogQuery = (searchParams: CatalogSearchParams = {}): CatalogQuery => {
  const distanceValue = firstValue(searchParams.distance);
  const periodValue = firstValue(searchParams.period);
  const parsedPage = Number.parseInt(firstValue(searchParams.page) ?? "1", 10);

  return {
    search: (firstValue(searchParams.q) ?? "").trim().slice(0, 100),
    distance: (["short", "trail", "ultra"] as const).includes(distanceValue as "short" | "trail" | "ultra")
      ? (distanceValue as RaceDistanceFilter)
      : "all",
    period: (["past", "all"] as const).includes(periodValue as "past" | "all")
      ? (periodValue as RacePeriodFilter)
      : "upcoming",
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
};

const orderGroups = (groups: PublicRaceGroup[], period: RacePeriodFilter, todayIso: string) => {
  if (period === "past") return [...groups].reverse();
  if (period !== "all") return groups;

  const upcoming = groups.filter((group) =>
    group.races.some((race) => getRaceTemporalStatus(race, todayIso) === "upcoming"),
  );
  const undated = groups.filter((group) =>
    group.races.every((race) => getRaceTemporalStatus(race, todayIso) === "undated"),
  );
  const past = groups
    .filter((group) => group.races.every((race) => getRaceTemporalStatus(race, todayIso) === "past"))
    .reverse();
  return [...upcoming, ...undated, ...past];
};

export const getCatalogView = (races: PublicRace[], query: CatalogQuery, todayIso: string): CatalogView => {
  const filteredRaces = filterPublicRaces(races, { ...query, todayIso });
  const allGroups = orderGroups(groupPublicRacesByEvent(filteredRaces), query.period, todayIso);
  const totalPages = Math.max(1, Math.ceil(allGroups.length / CATALOG_GROUPS_PER_PAGE));
  const groupOffset = (query.page - 1) * CATALOG_GROUPS_PER_PAGE;
  const groups = allGroups.slice(groupOffset, groupOffset + CATALOG_GROUPS_PER_PAGE);
  const firstRacePosition = allGroups
    .slice(0, groupOffset)
    .reduce((count, group) => count + group.races.length, 0) + 1;

  return {
    ...query,
    groups,
    filteredRaceCount: filteredRaces.length,
    eventGroupCount: allGroups.filter((group) => Boolean(group.eventId && group.eventName)).length,
    totalPages,
    firstRacePosition,
  };
};

export const getCatalogHref = (query: CatalogQuery, page: number) => {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.distance !== "all") params.set("distance", query.distance);
  if (query.period !== "upcoming") params.set("period", query.period);
  if (page > 1) params.set("page", String(page));
  const serialized = params.toString();
  return serialized ? `/courses?${serialized}` : "/courses";
};

export const isCanonicalPaginationQuery = (searchParams: CatalogSearchParams = {}, query: CatalogQuery) => {
  const keys = Object.keys(searchParams);
  if (keys.some((key) => key !== "page")) return false;
  if (!("page" in searchParams)) return true;

  const rawPage = firstValue(searchParams.page);
  return query.page > 1 && rawPage === String(query.page);
};

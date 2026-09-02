"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  filterPublicRaces,
  getRaceTemporalStatus,
  groupPublicRacesByEvent,
  type PublicRaceGroup,
  type RaceDistanceFilter,
  type RacePeriodFilter,
} from "../../../lib/race-discovery";
import type { PublicRace } from "../../../lib/public-races";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (date: string | null) => {
  if (!date) return "Date à confirmer";
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "Date à confirmer" : dateFormatter.format(parsed);
};

const isHttpUrl = (value: string | null) => Boolean(value && /^https?:\/\//i.test(value));

const getSharedValue = (races: PublicRace[], select: (race: PublicRace) => string | null) => {
  const selectedValues = races.map(select);
  if (selectedValues.some((value) => !value)) return null;
  const values = Array.from(new Set(selectedValues.filter((value): value is string => Boolean(value))));
  return values.length === 1 ? values[0] : null;
};

const getEditionYear = (races: PublicRace[]) => {
  const years = Array.from(
    new Set(races.map((race) => race.date?.slice(0, 4)).filter((year): year is string => /^\d{4}$/.test(year ?? ""))),
  );
  return years.length === 1 ? years[0] : null;
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

function EventRaceGroup({ group }: { group: PublicRaceGroup }) {
  const { races, eventName } = group;
  const sharedDate = getSharedValue(races, (race) => race.date);
  const sharedLocation = getSharedValue(races, (race) => race.location);
  const editionYear = getEditionYear(races);
  const headingId = `event-${group.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const imageUrl = races.find((race) => isHttpUrl(race.eventThumbnailUrl))?.eventThumbnailUrl ?? null;

  return (
    <section aria-labelledby={headingId}>
      <Card className="overflow-hidden">
        <div className={imageUrl ? "grid lg:grid-cols-[260px_minmax(0,1fr)]" : undefined}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Événement ${eventName ?? races[0]?.name ?? "course"}`}
              loading="lazy"
              className="h-48 w-full object-cover lg:h-full lg:min-h-52"
            />
          ) : null}
          <div className="min-w-0">
            <CardHeader className="border-b border-border bg-brand-surface/70 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                  Événement{editionYear ? ` · édition ${editionYear}` : ""}
                </p>
                <CardTitle id={headingId} className="text-2xl leading-tight">
                  {eventName}
                </CardTitle>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{sharedDate ? formatDate(sharedDate) : "Dates selon le format"}</span>
                  <span>{sharedLocation ?? "Lieu selon le format"}</span>
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {races.length} format{races.length > 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {races.map((race) => (
                  <li key={race.id}>
                    <Link
                      href={`/courses/${race.slug}` as Route}
                      className="group grid min-h-16 gap-3 px-5 py-4 transition hover:bg-brand-surface/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                    >
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground transition group-hover:text-brand">{race.name}</h3>
                        {!sharedDate || !sharedLocation ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {!sharedDate ? formatDate(race.date) : null}
                            {!sharedDate && !sharedLocation ? " · " : null}
                            {!sharedLocation ? (race.location ?? "Lieu à confirmer") : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
                        <span className="rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                          {race.distanceKm !== null ? `${race.distanceKm} km` : "Distance à confirmer"}
                        </span>
                        <span className="rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                          {race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : "D+ à confirmer"}
                        </span>
                        <span aria-hidden="true" className="pl-1 text-brand transition group-hover:translate-x-1">→</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </div>
        </div>
      </Card>
    </section>
  );
}

function StandaloneRaceCard({ race }: { race: PublicRace }) {
  const imageUrl = isHttpUrl(race.raceThumbnailUrl) ? race.raceThumbnailUrl : null;
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {imageUrl ? <img src={imageUrl} alt={race.name} loading="lazy" className="h-44 w-full object-cover" /> : null}
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Course indépendante</p>
        <CardTitle className="leading-snug">
          <Link className="transition hover:text-brand" href={`/courses/${race.slug}` as Route}>{race.name}</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Distance</dt>
            <dd className="font-semibold text-foreground">{race.distanceKm !== null ? `${race.distanceKm} km` : "À confirmer"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dénivelé</dt>
            <dd className="font-semibold text-foreground">
              {race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : "À confirmer"}
            </dd>
          </div>
        </dl>
        <div className="mt-auto space-y-1 text-sm text-muted-foreground">
          <p>{formatDate(race.date)}</p>
          <p>{race.location ?? "Lieu à confirmer"}</p>
        </div>
        <Link
          href={`/courses/${race.slug}` as Route}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground transition hover:bg-brand-light"
        >
          Voir la fiche course
        </Link>
      </CardContent>
    </Card>
  );
}

export function RaceCatalogFilter({ races, todayIso }: { races: PublicRace[]; todayIso: string }) {
  const [search, setSearch] = useState("");
  const [distance, setDistance] = useState<RaceDistanceFilter>("all");
  const [period, setPeriod] = useState<RacePeriodFilter>("upcoming");

  const filteredRaces = useMemo(
    () => filterPublicRaces(races, { search, distance, period, todayIso }),
    [distance, period, races, search, todayIso],
  );

  const raceGroups = useMemo(
    () => orderGroups(groupPublicRacesByEvent(filteredRaces), period, todayIso),
    [filteredRaces, period, todayIso],
  );
  const eventGroups = raceGroups.filter((group) => Boolean(group.eventId && group.eventName));
  const standaloneRaces = raceGroups.filter((group) => !group.eventId || !group.eventName).flatMap((group) => group.races);
  const hasFilters = search.length > 0 || distance !== "all" || period !== "upcoming";

  const resetFilters = () => {
    setSearch("");
    setDistance("all");
    setPeriod("upcoming");
  };

  return (
    <section aria-labelledby="race-catalog-heading" className="space-y-5">
      <div className="sticky top-2 z-10 grid gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-sm backdrop-blur sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto] lg:items-end">
        <label className="space-y-1 text-sm font-medium text-foreground">
          Rechercher une course ou un lieu
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Annecy, Mont-Blanc, UTMB…"
            className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal text-foreground outline-none transition focus:border-brand-border focus:ring-2 focus:ring-ring/30"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          Distance
          <select
            value={distance}
            onChange={(event) => setDistance(event.target.value as RaceDistanceFilter)}
            className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal text-foreground outline-none transition focus:border-brand-border focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">Toutes les distances</option>
            <option value="short">Moins de 30 km</option>
            <option value="trail">30 à 79 km</option>
            <option value="ultra">80 km et plus</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          Période
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as RacePeriodFilter)}
            className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal text-foreground outline-none transition focus:border-brand-border focus:ring-2 focus:ring-ring/30"
          >
            <option value="upcoming">À venir</option>
            <option value="past">Passées</option>
            <option value="all">Toutes</option>
          </select>
        </label>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasFilters}
          className="min-h-11 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-45"
        >
          Réinitialiser
        </button>
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 id="race-catalog-heading" className="text-2xl font-semibold text-foreground">Événements et courses</h2>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {filteredRaces.length} course{filteredRaces.length !== 1 ? "s" : ""} · {eventGroups.length} événement{eventGroups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {filteredRaces.length ? (
        <div className="space-y-6">
          {eventGroups.map((group) => <EventRaceGroup key={group.key} group={group} />)}
          {standaloneRaces.length ? (
            <section aria-labelledby="standalone-races-heading" className="space-y-4">
              <h3 id="standalone-races-heading" className="text-xl font-semibold text-foreground">Autres courses</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {standaloneRaces.map((race) => <StandaloneRaceCard key={race.id} race={race} />)}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-8 text-center text-muted-foreground">
            <p>Aucune course ne correspond à ces filtres.</p>
            <button type="button" onClick={resetFilters} className="min-h-11 font-semibold text-brand hover:underline">
              Réinitialiser les filtres
            </button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

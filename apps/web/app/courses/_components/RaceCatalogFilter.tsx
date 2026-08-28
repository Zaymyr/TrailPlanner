"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { groupPublicRacesByEvent } from "../../../lib/race-discovery";
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

const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

type DistanceFilter = "all" | "short" | "trail" | "ultra";

const getSharedValue = (races: PublicRace[], select: (race: PublicRace) => string | null) => {
  const selectedValues = races.map(select);
  if (selectedValues.some((value) => !value)) return null;
  const values = Array.from(new Set(selectedValues.filter((value): value is string => Boolean(value))));
  return values.length === 1 ? values[0] : null;
};

function EventRaceGroup({ eventId, races, eventName }: { eventId: string; races: PublicRace[]; eventName: string }) {
  const sharedDate = getSharedValue(races, (race) => race.date);
  const sharedLocation = getSharedValue(races, (race) => race.location);
  const headingId = `event-${eventId}`;

  return (
    <section aria-labelledby={headingId}>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-brand-surface/70 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Événement</p>
            <CardTitle id={headingId} className="text-2xl leading-tight">
              {eventName}
            </CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{sharedDate ? formatDate(sharedDate) : "Dates selon le format"}</span>
              <span>{sharedLocation ?? "Lieu selon le format"}</span>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {races.length} course{races.length > 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {races.map((race) => (
              <li key={race.id}>
                <Link
                  href={`/courses/${race.slug}` as Route}
                  className="group grid gap-3 px-6 py-4 transition hover:bg-brand-surface/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-foreground transition group-hover:text-brand">{race.name}</h4>
                    {!sharedDate || !sharedLocation ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {!sharedDate ? formatDate(race.date) : null}
                        {!sharedDate && !sharedLocation ? " · " : null}
                        {!sharedLocation ? (race.location ?? "Lieu à confirmer") : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
                    <dl className="contents">
                      <div className="rounded-full border border-border bg-background px-3 py-1.5">
                        <dt className="sr-only">Distance</dt>
                        <dd className="font-semibold text-foreground">
                          {race.distanceKm !== null ? `${race.distanceKm} km` : "Distance à confirmer"}
                        </dd>
                      </div>
                      <div className="rounded-full border border-border bg-background px-3 py-1.5">
                        <dt className="sr-only">Dénivelé</dt>
                        <dd className="font-semibold text-foreground">
                          {race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : "D+ à confirmer"}
                        </dd>
                      </div>
                    </dl>
                    <span aria-hidden="true" className="pl-1 text-brand transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function StandaloneRaceCard({ race }: { race: PublicRace }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Course indépendante</p>
        <CardTitle className="leading-snug">
          <Link className="transition hover:text-brand" href={`/courses/${race.slug}` as Route}>
            {race.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Distance</dt>
            <dd className="font-semibold text-foreground">
              {race.distanceKm !== null ? `${race.distanceKm} km` : "À confirmer"}
            </dd>
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
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground transition hover:bg-brand-light"
        >
          Voir la fiche course
        </Link>
      </CardContent>
    </Card>
  );
}

export function RaceCatalogFilter({ races }: { races: PublicRace[] }) {
  const [search, setSearch] = useState("");
  const [distance, setDistance] = useState<DistanceFilter>("all");

  const filteredRaces = useMemo(() => {
    const query = normalizeSearch(search.trim());

    return races.filter((race) => {
      const searchable = normalizeSearch([race.name, race.eventName, race.location].filter(Boolean).join(" "));
      const matchesSearch = !query || searchable.includes(query);
      const km = race.distanceKm;
      const matchesDistance =
        distance === "all" ||
        (distance === "short" && km !== null && km < 30) ||
        (distance === "trail" && km !== null && km >= 30 && km < 80) ||
        (distance === "ultra" && km !== null && km >= 80);

      return matchesSearch && matchesDistance;
    });
  }, [distance, races, search]);

  const raceGroups = useMemo(() => groupPublicRacesByEvent(filteredRaces), [filteredRaces]);
  const eventGroups = raceGroups.filter(
    (group): group is typeof group & { eventId: string; eventName: string } => Boolean(group.eventId && group.eventName),
  );
  const standaloneRaces = raceGroups
    .filter((group) => !group.eventId || !group.eventName)
    .flatMap((group) => group.races);
  const eventCount = eventGroups.length;

  return (
    <section aria-labelledby="race-catalog-heading" className="space-y-5">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_220px]">
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
            onChange={(event) => setDistance(event.target.value as DistanceFilter)}
            className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal text-foreground outline-none transition focus:border-brand-border focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">Toutes les distances</option>
            <option value="short">Moins de 30 km</option>
            <option value="trail">30 à 79 km</option>
            <option value="ultra">80 km et plus</option>
          </select>
        </label>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <h2 id="race-catalog-heading" className="text-2xl font-semibold text-foreground">
          Événements et courses
        </h2>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {filteredRaces.length} course{filteredRaces.length !== 1 ? "s" : ""}
          {eventCount ? ` · ${eventCount} événement${eventCount > 1 ? "s" : ""}` : ""}
        </p>
      </div>

      {filteredRaces.length ? (
        <div className="space-y-6">
          {eventGroups.map((group) => (
            <EventRaceGroup
              key={group.key}
              eventId={group.eventId}
              eventName={group.eventName}
              races={group.races}
            />
          ))}
          {standaloneRaces.length ? (
            <section aria-labelledby="standalone-races-heading" className="space-y-4">
              <h3 id="standalone-races-heading" className="text-xl font-semibold text-foreground">
                Autres courses
              </h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {standaloneRaces.map((race) => (
                  <StandaloneRaceCard key={race.id} race={race} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune course ne correspond à ces filtres.
          </CardContent>
        </Card>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
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
          Courses de trail
        </h2>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {filteredRaces.length} résultat{filteredRaces.length > 1 ? "s" : ""}
        </p>
      </div>

      {filteredRaces.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRaces.map((race) => (
            <Card key={race.id} className="flex h-full flex-col">
              <CardHeader>
                {race.eventName && race.eventName !== race.name ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{race.eventName}</p>
                ) : null}
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
          ))}
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

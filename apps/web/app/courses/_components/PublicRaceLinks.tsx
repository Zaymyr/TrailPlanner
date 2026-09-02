import type { Route } from "next";
import Link from "next/link";

import type { PublicRace } from "../../../lib/public-races";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

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

export function PublicRaceLinks({ races }: { races: PublicRace[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {races.map((race) => (
        <Card key={race.id} className="h-full overflow-hidden">
          {race.thumbnailUrl && /^https?:\/\//i.test(race.thumbnailUrl) ? (
            <img src={race.thumbnailUrl} alt={race.name} loading="lazy" className="h-40 w-full object-cover" />
          ) : null}
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
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {race.distanceKm !== null ? `${race.distanceKm} km` : "Distance à confirmer"}
              {race.elevationGainM !== null ? ` · ${Math.round(race.elevationGainM)} m D+` : ""}
            </p>
            <p>{formatDate(race.date)}</p>
            {race.location ? <p>{race.location}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

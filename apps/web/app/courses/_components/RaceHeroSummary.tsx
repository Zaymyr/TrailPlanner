import type { Route } from "next";
import Link from "next/link";

import type { PublicRace } from "../../../lib/public-races";
import type { PublicRaceDetail } from "../../../lib/public-race-detail";
import { PublicRaceShare } from "./PublicRaceShare";

export function RaceHeroSummary({
  race,
  formattedDate,
  formattedEndDate,
  canonicalUrl,
  otherFormats,
}: {
  race: PublicRaceDetail;
  formattedDate: string | null;
  formattedEndDate: string | null;
  canonicalUrl: string;
  otherFormats: PublicRace[];
}) {
  const heroImage = race.raceThumbnailUrl ?? race.eventThumbnailUrl;
  const dateAndLocation =
    [formattedDate && formattedEndDate ? `Du ${formattedDate} au ${formattedEndDate}` : formattedDate, race.location]
      .filter(Boolean)
      .join(" · ") || "Informations à confirmer";

  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {heroImage && /^https?:\/\//i.test(heroImage) ? (
        <img
          src={heroImage}
          alt={race.name}
          width={1200}
          height={512}
          loading="eager"
          fetchPriority="high"
          className="h-40 w-full object-cover sm:h-56 lg:h-64"
        />
      ) : null}
      <div className="space-y-5 p-5 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            {race.eventName && race.eventName !== race.name ? (
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{race.eventName}</p>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">{race.name}</h1>
            <p className="text-base text-muted-foreground sm:text-lg">{dateAndLocation}</p>
            {race.participationMode ? (
              <p className="inline-flex rounded-full bg-brand-surface px-3 py-1 text-sm font-semibold text-brand">
                {race.participationMode === "solo" ? "Solo" : race.participationMode === "relay" ? "Relais" : "Solo et relais"}
              </p>
            ) : null}
          </div>
          <PublicRaceShare title={race.name} url={canonicalUrl} variant="icon" />
        </div>

        <dl className="flex flex-wrap gap-6">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Distance</dt>
            <dd className="mt-1 text-3xl font-bold text-foreground">
              {race.distanceKm === null ? "À confirmer" : `${race.distanceKm} km`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dénivelé positif</dt>
            <dd className="mt-1 text-3xl font-bold text-foreground">
              {race.elevationGainM === null ? "À confirmer" : `${Math.round(race.elevationGainM).toLocaleString("fr-FR")} m D+`}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/race-planner?catalogRaceId=${race.id}` as Route}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
          >
            Planifier cette course
          </Link>
        </div>

        {otherFormats.length ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Autres formats</p>
            <ul className="flex flex-wrap gap-2">
              {otherFormats.map((format) => (
                <li key={format.id}>
                  <Link
                    href={`/courses/${format.slug}` as Route}
                    className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm font-medium text-foreground transition hover:border-brand-border hover:bg-brand-surface"
                  >
                    {format.distanceKm !== null ? `${format.distanceKm} km` : format.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </header>
  );
}

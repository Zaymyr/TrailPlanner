import type { Route } from "next";
import Link from "next/link";

import type { PublicRaceGroup } from "../../../lib/race-discovery";
import { getPublicRaceRegistrationUrl, type PublicRace } from "../../../lib/public-races";
import { getCatalogHref, type CatalogView } from "../catalog-query";
import { formatCatalogDate, getEventDateLabel, getEventLocationLabel, getFormatLabelWithinEvent } from "./catalog-display";

const isHttpUrl = (value: string | null) => Boolean(value && /^https?:\/\//i.test(value));

/** Formats visible before the « autres formats » disclosure on a catalog card. */
const VISIBLE_FORMATS = 3;

const getEditionYear = (races: PublicRace[]) => {
  const years = Array.from(
    new Set(races.map((race) => race.date?.slice(0, 4)).filter((year): year is string => /^\d{4}$/.test(year ?? ""))),
  );
  return years.length === 1 ? years[0] : null;
};

const formatDistance = (race: PublicRace) => (race.distanceKm !== null ? race.distanceKm.toLocaleString("fr-FR") : "?");

/** One tappable format row, like the app's format list: distance badge, name, D+. */
function FormatRow({ race, showDate, eventName = null }: { race: PublicRace; showDate: boolean; eventName?: string | null }) {
  const facts = [
    race.elevationGainM !== null ? `${Math.round(race.elevationGainM).toLocaleString("fr-FR")} m D+` : "D+ à confirmer",
    showDate ? formatCatalogDate(race.date) : null,
  ].filter(Boolean);
  return (
    <li>
      <Link
        href={`/courses/${race.slug}` as Route}
        className="group flex min-h-14 items-center gap-3 px-4 py-2.5 transition hover:bg-brand-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-10 min-w-[3rem] shrink-0 flex-col items-center justify-center rounded-lg bg-brand-surface px-1.5 text-brand">
          <span className="text-sm font-bold leading-none tabular-nums">{formatDistance(race)}</span>
          <span className="text-[9px] font-semibold uppercase leading-none">km</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground group-hover:text-brand" title={race.name}>{getFormatLabelWithinEvent(race.name, eventName)}</span>
          <span className="block truncate text-xs text-muted-foreground">{facts.join(" · ")}</span>
        </span>
        <span aria-hidden="true" className="text-lg text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand">›</span>
      </Link>
    </li>
  );
}

export function EventRaceGroup({ group }: { group: PublicRaceGroup }) {
  const { races, eventName } = group;
  const dateLabel = getEventDateLabel(races);
  const locationLabel = getEventLocationLabel(races);
  const editionYear = getEditionYear(races);
  const headingId = `event-${group.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const imageUrl = races.find((race) => isHttpUrl(race.eventThumbnailUrl))?.eventThumbnailUrl ?? null;
  const registrationUrl = races.map(getPublicRaceRegistrationUrl).find(Boolean) ?? null;
  // Link the permanent event hub when it exists; edition pages canonicalize to it.
  const eventSlug = races.find((race) => race.eventSlug)?.eventSlug ?? races[0]?.eventEditionSlug ?? null;
  const eventHref = eventSlug ? (`/courses/evenements/${eventSlug}` as Route) : null;
  const showFormatDates = new Set(races.map((race) => race.date)).size > 1;
  const visible = races.slice(0, VISIBLE_FORMATS);
  const hidden = races.slice(VISIBLE_FORMATS);

  const identity = (
    <>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${imageUrl ? "text-white/80" : "text-brand"}`}>
        {editionYear ? `Édition ${editionYear}` : "Événement"} · {races.length} format{races.length > 1 ? "s" : ""}
      </p>
      <h3 id={headingId} className={`text-lg font-bold leading-tight ${imageUrl ? "text-white" : "text-foreground"}`}>{eventName}</h3>
      <p className={`truncate text-sm ${imageUrl ? "text-white/90" : "text-muted-foreground"}`}>{dateLabel} · {locationLabel}</p>
    </>
  );

  return (
    <article aria-labelledby={headingId} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {imageUrl ? (
        <div className="relative isolate flex min-h-[7.5rem] flex-col justify-end gap-0.5 px-4 pb-3 pt-6">
          <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/50 to-black/10" aria-hidden="true" />
          {eventHref ? <Link href={eventHref} className="absolute inset-0 z-0" aria-label={`Voir l’événement ${eventName}`} /> : null}
          <div className="pointer-events-none relative">{identity}</div>
        </div>
      ) : (
        <div className="space-y-0.5 border-b border-border bg-brand-surface/70 px-4 py-3">{identity}</div>
      )}

      <ul className="divide-y divide-border">
        {visible.map((race) => <FormatRow key={race.id} race={race} showDate={showFormatDates} eventName={eventName} />)}
      </ul>
      {hidden.length ? (
        <details className="group border-t border-border">
          <summary className="flex min-h-11 cursor-pointer items-center justify-center gap-1 text-sm font-semibold text-brand marker:content-none">
            <span className="group-open:hidden">+ {hidden.length} autre{hidden.length > 1 ? "s" : ""} format{hidden.length > 1 ? "s" : ""}</span>
            <span className="hidden group-open:inline">Masquer</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {hidden.map((race) => <FormatRow key={race.id} race={race} showDate={showFormatDates} eventName={eventName} />)}
          </ul>
        </details>
      ) : null}

      {eventHref || registrationUrl ? (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border px-4 py-2">
          {eventHref ? <Link href={eventHref} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand hover:underline">Voir l’événement</Link> : <span />}
          {registrationUrl ? (
            <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-muted-foreground hover:text-brand hover:underline">
              S’inscrire ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function StandaloneRaceCard({ race }: { race: PublicRace }) {
  const imageUrl = isHttpUrl(race.raceThumbnailUrl) ? race.raceThumbnailUrl : null;
  const registrationUrl = getPublicRaceRegistrationUrl(race);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {imageUrl ? <img src={imageUrl} alt="" loading="lazy" className="h-28 w-full object-cover" /> : null}
      <div className="space-y-0.5 px-4 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Course indépendante</p>
        <p className="truncate text-sm text-muted-foreground">{race.location ?? "Lieu à confirmer"}</p>
      </div>
      <ul><FormatRow race={race} showDate /></ul>
      {registrationUrl ? (
        <div className="mt-auto flex justify-end border-t border-border px-4 py-2">
          <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-muted-foreground hover:text-brand hover:underline">
            S’inscrire ↗
          </a>
        </div>
      ) : null}
    </article>
  );
}

const fieldClassName =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition focus:border-brand-border focus:ring-2 focus:ring-ring/30";

export function RaceCatalogFilter({ view }: { view: CatalogView }) {
  const eventGroups = view.groups.filter((group) => Boolean(group.eventId && group.eventName));
  const standaloneRaces = view.groups.filter((group) => !group.eventId || !group.eventName).flatMap((group) => group.races);
  const hasFilters = view.search.length > 0 || view.distance !== "all" || view.period !== "upcoming" || view.page > 1;

  return (
    <section aria-labelledby="race-catalog-heading" className="space-y-4">
      <form
        action="/courses"
        method="get"
        role="search"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur lg:sticky lg:top-2 lg:z-10 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto_auto] lg:items-end lg:gap-3 lg:p-4"
      >
        <label className="col-span-2 space-y-1 text-xs font-medium text-muted-foreground lg:col-span-1">
          Course ou lieu
          <input name="q" type="search" defaultValue={view.search} maxLength={100} placeholder="Ville, département, région, pays…" className={fieldClassName} />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Distance
          <select name="distance" defaultValue={view.distance} className={fieldClassName}>
            <option value="all">Toutes</option><option value="short">Moins de 30 km</option><option value="trail">30 à 79 km</option><option value="ultra">80 km et plus</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Période
          <select name="period" defaultValue={view.period} className={fieldClassName}>
            <option value="upcoming">À venir</option><option value="past">Passées</option><option value="all">Toutes</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light">Rechercher</button>
        <Link href="/courses" aria-disabled={!hasFilters} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface ${!hasFilters ? "pointer-events-none opacity-45" : ""}`}>Réinitialiser</Link>
      </form>

      <div className="flex items-baseline justify-between gap-3">
        <h2 id="race-catalog-heading" className="text-xl font-bold text-foreground sm:text-2xl">Événements et courses</h2>
        <p className="shrink-0 text-xs text-muted-foreground sm:text-sm">{view.filteredRaceCount} course{view.filteredRaceCount !== 1 ? "s" : ""} · {view.eventGroupCount} événement{view.eventGroupCount !== 1 ? "s" : ""}</p>
      </div>

      {view.filteredRaceCount ? (
        <div className="space-y-5">
          {eventGroups.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {eventGroups.map((group) => <EventRaceGroup key={group.key} group={group} />)}
            </div>
          ) : null}
          {standaloneRaces.length ? (
            <section aria-labelledby="standalone-races-heading" className="space-y-3">
              <h3 id="standalone-races-heading" className="text-lg font-bold text-foreground">Autres courses</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{standaloneRaces.map((race) => <StandaloneRaceCard key={race.id} race={race} />)}</div>
            </section>
          ) : null}
          {view.totalPages > 1 ? (
            <nav aria-label="Pagination du catalogue" className="flex items-center justify-between gap-3 pt-1">
              {view.page > 1 ? <Link href={getCatalogHref(view, view.page - 1) as Route} rel="prev" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-brand-surface">← Précédente</Link> : <span />}
              <span className="text-sm text-muted-foreground">Page {view.page} / {view.totalPages}</span>
              {view.page < view.totalPages ? <Link href={getCatalogHref(view, view.page + 1) as Route} rel="next" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-brand-surface">Suivante →</Link> : <span />}
            </nav>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          <p>Aucune course ne correspond à ces filtres.</p>
          <Link href="/courses" className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">Réinitialiser les filtres</Link>
        </div>
      )}
    </section>
  );
}

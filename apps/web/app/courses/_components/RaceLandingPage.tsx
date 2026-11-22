import type { Route } from "next";
import Link from "next/link";

import {
  buildLandingItemList,
  getLandingPagePath,
  type LandingLinkGroup,
  type LandingPageView,
} from "../../../lib/race-landing-pages";
import { SITE_URL } from "../../seo";
import { EventRaceGroup, StandaloneRaceCard } from "./RaceCatalogFilter";

type RaceLandingPageProps = {
  /** Base path without pagination, e.g. `/courses/regions/bretagne`. */
  basePath: string;
  eyebrow: string;
  heading: string;
  intro: string;
  breadcrumbLabel: string;
  view: LandingPageView;
  crossLinks: LandingLinkGroup[];
};

/**
 * Server-rendered distance / region / month landing page: paginated event
 * cards (same cards as /courses), ItemList for the visible page, breadcrumb,
 * crawlable previous/next links and links to the sibling selections.
 */
export function RaceLandingPage({ basePath, eyebrow, heading, intro, breadcrumbLabel, view, crossLinks }: RaceLandingPageProps) {
  const canonicalUrl = new URL(getLandingPagePath(basePath, view.page), SITE_URL).toString();
  const baseUrl = new URL(basePath, SITE_URL).toString();
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: breadcrumbLabel, item: baseUrl },
      ...(view.page > 1 ? [{ "@type": "ListItem", position: 4, name: `Page ${view.page}`, item: canonicalUrl }] : []),
    ],
  };
  const itemListData = buildLandingItemList(heading, view, SITE_URL);
  const eventGroups = view.groups.filter((group) => Boolean(group.eventId && group.eventName));
  const standaloneRaces = view.groups.filter((group) => !group.eventId || !group.eventName).flatMap((group) => group.races);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10 sm:space-y-8 sm:pt-4 lg:px-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData).replace(/</g, "\\u003c") }} />

      <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
        <Link className="shrink-0 hover:text-brand hover:underline" href="/">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link className="shrink-0 hover:text-brand hover:underline" href={"/courses" as Route}>Courses</Link>
        <span aria-hidden="true">/</span>
        {view.page > 1 ? (
          <>
            <Link className="truncate hover:text-brand hover:underline" href={basePath as Route}>{breadcrumbLabel}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="shrink-0 text-foreground">Page {view.page}</span>
          </>
        ) : (
          <span aria-current="page" className="truncate text-foreground">{breadcrumbLabel}</span>
        )}
      </nav>

      <header className="max-w-3xl space-y-2 sm:space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand sm:text-sm">{eyebrow}</p>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-5xl">{heading}</h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-lg sm:leading-8">{intro}</p>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {view.raceCount} course{view.raceCount > 1 ? "s" : ""} à venir. Vérifiez toujours les informations sur le site officiel avant de vous inscrire.
        </p>
      </header>

      <section aria-labelledby="landing-races-heading" className="space-y-4">
        <h2 id="landing-races-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Événements et courses{view.totalPages > 1 ? ` · page ${view.page} / ${view.totalPages}` : ""}
        </h2>
        {eventGroups.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {eventGroups.map((group) => <EventRaceGroup key={group.key} group={group} />)}
          </div>
        ) : null}
        {standaloneRaces.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {standaloneRaces.map((race) => <StandaloneRaceCard key={race.id} race={race} />)}
          </div>
        ) : null}
        {view.totalPages > 1 ? (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-1">
            {view.page > 1 ? <Link href={getLandingPagePath(basePath, view.page - 1) as Route} rel="prev" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-brand-surface">← Précédente</Link> : <span />}
            <span className="text-sm text-muted-foreground">Page {view.page} / {view.totalPages}</span>
            {view.page < view.totalPages ? <Link href={getLandingPagePath(basePath, view.page + 1) as Route} rel="next" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-brand-surface">Suivante →</Link> : <span />}
          </nav>
        ) : null}
      </section>

      {crossLinks.filter((group) => group.links.length).map((group) => (
        <nav key={group.heading} aria-label={group.heading} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.heading}</h2>
          <ul className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href as Route}
                  aria-current={link.current ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:border-brand-border hover:bg-brand-surface ${link.current ? "border-brand-border bg-brand-surface text-brand" : "border-border bg-card text-foreground"}`}
                >
                  {link.label}
                  <span className="rounded-full bg-brand-surface px-2 text-xs text-brand">{link.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl font-bold text-foreground">Préparer votre prochaine course</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Une fois votre format choisi, estimez gratuitement votre temps puis construisez votre stratégie d’allure, d’hydratation et de ravitaillement.
        </p>
        <Link href="/race-planner" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light">
          Créer mon plan de course
        </Link>
      </section>
    </div>
  );
}

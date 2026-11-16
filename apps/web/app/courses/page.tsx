import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicRaces } from "../../lib/public-races";
import { getIndexableDistancePages } from "../../lib/race-discovery";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../seo";
import { RaceCatalogFilter } from "./_components/RaceCatalogFilter";
import {
  getCatalogHref,
  getCatalogView,
  isCanonicalPaginationQuery,
  parseCatalogQuery,
  type CatalogSearchParams,
} from "./catalog-query";

export const revalidate = 900;

const baseMetadata: Metadata = {
  title: "Calendrier trail : courses, distances et dénivelés",
  description:
    "Découvrez les courses de trail du calendrier Pace Yourself : dates, distances, dénivelés et lieux pour préparer votre prochaine course.",
  alternates: { canonical: "/courses" },
  openGraph: {
    title: "Calendrier des courses de trail",
    description: "Trouvez une course et consultez sa distance, son dénivelé, sa date et son lieu.",
    url: new URL("/courses", SITE_URL),
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Calendrier des courses de trail",
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
    description: "Trouvez une course et consultez sa distance, son dénivelé, sa date et son lieu.",
  },
};

export function generateMetadata({ searchParams }: { searchParams?: CatalogSearchParams }): Metadata {
  const query = parseCatalogQuery(searchParams);
  const isIndexableQuery = isCanonicalPaginationQuery(searchParams, query);
  const pageSuffix = query.page > 1 ? ` - page ${query.page}` : "";

  return {
    ...baseMetadata,
    title: `${String(baseMetadata.title)}${pageSuffix}`,
    alternates: { canonical: isIndexableQuery ? getCatalogHref(query, query.page) : "/courses" },
    robots: isIndexableQuery ? undefined : { index: false, follow: true },
  };
}

const getTodayInFrance = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export default async function CoursesPage({ searchParams }: { searchParams?: CatalogSearchParams }) {
  const races = await getPublicRaces();
  const distancePages = getIndexableDistancePages(races);
  const query = parseCatalogQuery(searchParams);
  const catalogView = getCatalogView(races, query, getTodayInFrance());
  if (query.page > catalogView.totalPages) notFound();
  const visibleRaces = catalogView.groups.flatMap((group) => group.races);
  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catalogue des courses de trail",
    numberOfItems: catalogView.filteredRaceCount,
    itemListElement: visibleRaces.map((race, index) => ({
      "@type": "ListItem",
      position: catalogView.firstRacePosition + index,
      name: race.name,
      url: new URL(`/courses/${race.slug}`, SITE_URL).toString(),
    })),
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6 sm:space-y-8 sm:pt-4 lg:px-2">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData).replace(/</g, "\\u003c") }}
      />
      <header className="max-w-3xl space-y-2 sm:space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand sm:text-sm">Calendrier trail</p>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          Trouve ta prochaine course de trail
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-lg sm:leading-8">
          Parcours, dénivelé, ravitos et ton temps estimé gratuitement sur chaque course.
        </p>
      </header>

      {distancePages.length ? (
        <nav aria-labelledby="distance-selections-heading" className="space-y-2">
          <h2 id="distance-selections-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explorer par distance
          </h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {distancePages.map(({ page, races: matchingRaces }) => (
              <li key={page.slug} className="shrink-0">
                <Link
                  href={`/courses/distances/${page.slug}` as Route}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
                >
                  {page.label}
                  <span className="rounded-full bg-brand-surface px-2 text-xs text-brand">{matchingRaces.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <RaceCatalogFilter view={catalogView} />
    </div>
  );
}

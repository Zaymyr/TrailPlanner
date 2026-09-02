import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { getPublicRaces } from "../../lib/public-races";
import { getIndexableDistancePages } from "../../lib/race-discovery";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../seo";
import { RaceCatalogFilter } from "./_components/RaceCatalogFilter";

export const revalidate = 3600;

export const metadata: Metadata = {
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

export default async function CoursesPage() {
  const races = await getPublicRaces();
  const distancePages = getIndexableDistancePages(races);
  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catalogue des courses de trail",
    numberOfItems: races.length,
    itemListElement: races.map((race, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: race.name,
      url: new URL(`/courses/${race.slug}`, SITE_URL).toString(),
    })),
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData).replace(/</g, "\\u003c") }}
      />
      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Calendrier trail</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Trouvez votre prochaine course de trail
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Explorez les courses publiées sur Pace Yourself, comparez les distances et le dénivelé, puis préparez
          votre stratégie d’allure et de nutrition.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/race-planner"
            className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
          >
            Créer mon plan de course
          </Link>
          <Link
            href={"/calculateur-glucides-trail" as Route}
            className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
          >
            Calculer mes glucides par heure
          </Link>
        </div>
      </header>

      {distancePages.length ? (
        <section className="space-y-4" aria-labelledby="distance-selections-heading">
          <div className="space-y-2">
            <h2 id="distance-selections-heading" className="text-2xl font-semibold text-foreground">
              Explorer les courses par distance
            </h2>
            <p className="text-muted-foreground">
              Accédez aux sélections qui contiennent suffisamment de courses publiées pour être réellement utiles.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {distancePages.map(({ page, races: matchingRaces }) => (
              <Link
                key={page.slug}
                href={`/courses/distances/${page.slug}` as Route}
                className="rounded-xl border border-border bg-card p-5 transition hover:border-brand-border hover:bg-brand-surface"
              >
                <span className="font-semibold text-foreground">{page.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {matchingRaces.length} course{matchingRaces.length > 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <RaceCatalogFilter races={races} todayIso={getTodayInFrance()} />
    </main>
  );
}

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getDistanceLandingPage,
  getIndexableDistancePages,
  getRacesForDistancePage,
  MIN_INDEXABLE_RACES,
} from "../../../../lib/race-discovery";
import { getPublicRaces } from "../../../../lib/public-races";
import { SITE_URL } from "../../../seo";
import { PublicRaceLinks } from "../../_components/PublicRaceLinks";

export const revalidate = 3600;

type PageProps = { params: { category: string } };

export async function generateStaticParams() {
  const races = await getPublicRaces();
  return getIndexableDistancePages(races).map(({ page }) => ({ category: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = getDistanceLandingPage(params.category);
  if (!page) return { title: "Sélection de courses introuvable", robots: { index: false, follow: false } };

  const races = getRacesForDistancePage(await getPublicRaces(), page);
  if (races.length < MIN_INDEXABLE_RACES) {
    return { title: page.title, robots: { index: false, follow: true } };
  }

  const canonicalPath = `/courses/distances/${page.slug}`;
  return {
    title: `${page.title} | Calendrier trail`,
    description: page.description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: page.title,
      description: page.description,
      type: "website",
      url: new URL(canonicalPath, SITE_URL),
    },
  };
}

export default async function DistanceLandingPage({ params }: PageProps) {
  const page = getDistanceLandingPage(params.category);
  if (!page) notFound();

  const races = getRacesForDistancePage(await getPublicRaces(), page);
  if (races.length < MIN_INDEXABLE_RACES) notFound();

  const canonicalUrl = new URL(`/courses/distances/${page.slug}`, SITE_URL).toString();
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: page.shortLabel, item: canonicalUrl },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-brand hover:underline" href="/">
          Accueil
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="hover:text-brand hover:underline" href={"/courses" as Route}>
          Courses
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-foreground">
          {page.shortLabel}
        </span>
      </nav>

      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Calendrier par distance</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{page.title}</h1>
        <p className="text-lg leading-8 text-muted-foreground">{page.description}</p>
        <p className="leading-7 text-muted-foreground">
          Cette sélection contient {races.length} courses dont la distance est renseignée dans le catalogue. Les
          informations peuvent évoluer : consultez la fiche puis le site officiel avant votre inscription.
        </p>
      </header>

      <section className="space-y-5" aria-labelledby="distance-races-heading">
        <h2 id="distance-races-heading" className="text-2xl font-semibold text-foreground">
          Les courses de cette sélection
        </h2>
        <PublicRaceLinks races={races} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold text-foreground">Préparer votre prochaine course</h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          Une fois votre format choisi, utilisez le planificateur pour construire votre stratégie d’allure,
          d’hydratation et de ravitaillement.
        </p>
        <Link
          href="/race-planner"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          Créer mon plan de course
        </Link>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "../../../components/ui/card";
import { getPublicRace, getPublicRaces } from "../../../lib/public-races";
import { getOtherEventFormats, getSimilarRaces } from "../../../lib/race-discovery";
import { SITE_URL } from "../../seo";
import { PublicRaceLinks } from "../_components/PublicRaceLinks";

export const revalidate = 3600;

type PageProps = { params: { slug: string } };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (date: string | null) => {
  if (!date) return null;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
};

const buildDescription = (race: Awaited<ReturnType<typeof getPublicRace>>) => {
  if (!race) return "Fiche d’une course de trail sur Pace Yourself.";
  const details = [
    race.distanceKm !== null ? `${race.distanceKm} km` : null,
    race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : null,
    race.location,
    formatDate(race.date),
  ].filter(Boolean);
  return `${race.name} : ${details.join(", ")}. Préparez votre allure et votre nutrition de course.`;
};

export async function generateStaticParams() {
  const races = await getPublicRaces();
  return races.map((race) => ({ slug: race.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const race = await getPublicRace(params.slug);
  if (!race) return { title: "Course introuvable", robots: { index: false, follow: false } };

  const canonicalPath = `/courses/${race.slug}`;
  const description = buildDescription(race);
  return {
    title: `${race.name} : distance, D+ et date`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `${race.name} | Pace Yourself`,
      description,
      url: new URL(canonicalPath, SITE_URL),
      type: "website",
      images: race.thumbnailUrl ? [{ url: race.thumbnailUrl }] : undefined,
    },
  };
}

export default async function RacePage({ params }: PageProps) {
  const [race, races] = await Promise.all([getPublicRace(params.slug), getPublicRaces()]);
  if (!race) notFound();

  const formattedDate = formatDate(race.date);
  const canonicalUrl = new URL(`/courses/${race.slug}`, SITE_URL).toString();
  const otherFormats = getOtherEventFormats(race, races);
  const similarRaces = getSimilarRaces(race, races);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: race.name,
    url: canonicalUrl,
    startDate: race.date ?? undefined,
    image: race.thumbnailUrl ? [race.thumbnailUrl] : undefined,
    location: race.location
      ? {
          "@type": "Place",
          name: race.location,
        }
      : undefined,
    description: buildDescription(race),
  };
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: race.name, item: canonicalUrl },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
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
          {race.name}
        </span>
      </nav>

      <header className="max-w-4xl space-y-4">
        {race.eventName && race.eventName !== race.name ? (
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{race.eventName}</p>
        ) : null}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{race.name}</h1>
        <p className="text-lg text-muted-foreground">
          {[formattedDate, race.location].filter(Boolean).join(" · ") || "Informations à confirmer"}
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-6 py-7 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Distance</p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {race.distanceKm !== null ? `${race.distanceKm} km` : "À confirmer"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dénivelé positif</p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {race.elevationGainM !== null ? `${Math.round(race.elevationGainM)} m D+` : "À confirmer"}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="max-w-4xl space-y-3" aria-labelledby="race-overview-heading">
        <h2 id="race-overview-heading" className="text-2xl font-semibold text-foreground">
          À propos de cette course
        </h2>
        <p className="leading-7 text-muted-foreground">
          {race.name}
          {race.distanceKm !== null ? ` propose un parcours de ${race.distanceKm} km` : " est une course de trail"}
          {race.elevationGainM !== null ? ` avec ${Math.round(race.elevationGainM)} m de dénivelé positif` : ""}
          {race.location ? ` à ${race.location}` : ""}
          {race.date ? `, prévue le ${formattedDate}` : ""}.
          {race.eventName && race.eventName !== race.name ? ` Ce format fait partie de l’événement ${race.eventName}.` : ""}
        </p>
        <p className="leading-7 text-muted-foreground">
          Les informations affichées proviennent du catalogue publié. Vérifiez les horaires, le parcours et le
          règlement définitifs auprès de l’organisation avant le départ.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-7">
            <h2 className="text-2xl font-semibold text-foreground">Préparer cette course</h2>
            <p className="leading-7 text-muted-foreground">
              Importez la course dans le planificateur pour construire une stratégie d’allure, d’hydratation et
              de ravitaillement adaptée au parcours.
            </p>
            <Link
              href="/race-planner"
              className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
            >
              Planifier ma course
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 py-7">
            <h2 className="text-2xl font-semibold text-foreground">Estimer mes glucides</h2>
            <p className="leading-7 text-muted-foreground">
              Obtenez rapidement un premier objectif de glucides par heure à tester pendant vos entraînements.
            </p>
            <Link
              href={"/calculateur-glucides-trail" as Route}
              className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
            >
              Ouvrir le calculateur
            </Link>
          </CardContent>
        </Card>
      </section>

      {otherFormats.length ? (
        <section className="space-y-5" aria-labelledby="other-formats-heading">
          <div className="space-y-2">
            <h2 id="other-formats-heading" className="text-2xl font-semibold text-foreground">
              Autres formats du même événement
            </h2>
            <p className="text-muted-foreground">Comparez les distances publiées pour choisir le format adapté.</p>
          </div>
          <PublicRaceLinks races={otherFormats} />
        </section>
      ) : null}

      {similarRaces.length ? (
        <section className="space-y-5" aria-labelledby="similar-races-heading">
          <div className="space-y-2">
            <h2 id="similar-races-heading" className="text-2xl font-semibold text-foreground">
              Courses de distance similaire
            </h2>
            <p className="text-muted-foreground">
              Ces suggestions sont calculées à partir de la distance et, lorsqu’il est disponible, du dénivelé.
            </p>
          </div>
          <PublicRaceLinks races={similarRaces} />
        </section>
      ) : null}

      {race.externalSiteUrl ? (
        <p className="text-sm text-muted-foreground">
          Vérifiez toujours les informations finales auprès de l’organisation. {" "}
          <a className="font-semibold text-brand hover:underline" href={race.externalSiteUrl} rel="noopener noreferrer">
            Consulter le site officiel
          </a>
        </p>
      ) : null}
    </main>
  );
}

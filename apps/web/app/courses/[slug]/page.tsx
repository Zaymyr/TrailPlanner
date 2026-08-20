import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "../../../components/ui/card";
import { getPublicRace, getPublicRaces } from "../../../lib/public-races";
import { SITE_URL } from "../../seo";

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
  const race = await getPublicRace(params.slug);
  if (!race) notFound();

  const formattedDate = formatDate(race.date);
  const canonicalUrl = new URL(`/courses/${race.slug}`, SITE_URL).toString();
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

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Link className="text-sm font-semibold text-brand hover:underline" href={"/courses" as Route}>
        ← Toutes les courses
      </Link>

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

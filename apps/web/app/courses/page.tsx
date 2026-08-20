import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { getPublicRaces } from "../../lib/public-races";
import { SITE_URL } from "../seo";
import { RaceCatalogFilter } from "./_components/RaceCatalogFilter";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Calendrier trail et courses 2026 | Distance et dénivelé",
  description:
    "Découvrez les courses de trail du calendrier Pace Yourself : dates, distances, dénivelés et lieux pour préparer votre prochaine course.",
  alternates: { canonical: "/courses" },
  openGraph: {
    title: "Calendrier des courses de trail",
    description: "Trouvez une course et consultez sa distance, son dénivelé, sa date et son lieu.",
    url: new URL("/courses", SITE_URL),
    type: "website",
  },
};

export default async function CoursesPage() {
  const races = await getPublicRaces();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
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

      <RaceCatalogFilter races={races} />
    </main>
  );
}

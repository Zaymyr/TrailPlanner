import type { Metadata, Route } from "next";
import Link from "next/link";

import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../seo";

export const metadata: Metadata = {
  title: "Méthodologie des calculateurs et contenus | Pace Yourself",
  description:
    "Sources, hypothèses, limites et politique de mise à jour des calculateurs, fiches course et articles Pace Yourself.",
  alternates: { canonical: "/methodologie" },
  openGraph: {
    title: "Méthodologie Pace Yourself",
    description: "Comment sont construits nos calculateurs, fiches course et contenus de nutrition trail.",
    url: new URL("/methodologie", SITE_URL),
    type: "article",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Méthodologie Pace Yourself",
    description: "Comment sont construits nos calculateurs, fiches course et contenus de nutrition trail.",
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
  },
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Méthodologie</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Des estimations explicables, pas des chiffres magiques
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
          Cette page décrit les règles actuellement utilisées par les outils publics, l’origine des informations de
          course et la manière dont les contenus sont corrigés.
        </p>
      </header>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-foreground">Calculateur de glucides</h2>
        <Card>
          <CardContent className="space-y-4 py-6 leading-7 text-muted-foreground">
            <p>
              Le calculateur rapide utilise la durée prévue et la tolérance digestive déclarée. Les repères de durée
              progressent de 0 g/h pour un effort inférieur à 45 minutes jusqu’à une limite haute de 90 g/h pour les
              efforts longs. Le résultat est un point de départ arrondi, jamais une prescription individualisée.
            </p>
            <p>
              Les plages s’appuient notamment sur les recommandations de nutrition d’endurance publiées par {" "}
              <a
                href="https://worldathletics.org/download/download?filename=6cc94bfc-827a-484d-9f22-da43665a54b2.pdf&urlslug=Sport%2Bnutrition%2Binfographic%2B-%2BCarbohydrate%2Bintakes%2Bin%2Bendurance%2Bevents"
                className="font-semibold text-brand hover:underline"
                rel="noopener noreferrer"
              >
                World Athletics
              </a>
              . Une tolérance digestive faible réduit la valeur proposée ; elle ne doit pas masquer des symptômes
              récurrents nécessitant un avis professionnel.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-foreground">Fiches course</h2>
        <p className="leading-7 text-muted-foreground">
          Les fiches utilisent uniquement les champs publiés dans le catalogue Pace Yourself : nom, date, lieu,
          distance, dénivelé et lien officiel lorsqu’ils sont disponibles. Les informations finales doivent toujours
          être vérifiées sur le site de l’organisation, en particulier les parcours, horaires, barrières et
          ravitaillements susceptibles de changer.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-foreground">Articles et corrections</h2>
        <ul className="list-disc space-y-3 pl-5 leading-7 text-muted-foreground">
          <li>Chaque article doit traiter une intention précise et afficher sa date de publication ou de mise à jour.</li>
          <li>Les sources externes utiles sont reliées directement depuis le contenu.</li>
          <li>Une information de course ne doit pas être inventée pour compléter une fiche.</li>
          <li>Une correction vérifiable peut être signalée depuis la page support.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={"/calculateur-glucides-trail" as Route}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          Tester le calculateur
        </Link>
        <Link className="inline-flex h-11 items-center px-2 text-sm font-semibold text-brand hover:underline" href="/support">
          Proposer une correction
        </Link>
      </div>
    </main>
  );
}

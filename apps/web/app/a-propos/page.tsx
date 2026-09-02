import type { Metadata, Route } from "next";
import Link from "next/link";

import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../seo";

export const metadata: Metadata = {
  title: "À propos de Pace Yourself | Planification trail",
  description:
    "Découvrez la mission de Pace Yourself, notre approche de la planification trail et nos engagements sur la clarté des données et des conseils.",
  alternates: { canonical: "/a-propos" },
  openGraph: {
    title: "À propos de Pace Yourself",
    description: "Un outil conçu pour transformer les données d’une course en décisions simples et testables.",
    url: new URL("/a-propos", SITE_URL),
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "À propos de Pace Yourself",
    description: "Un outil conçu pour transformer les données d’une course en décisions simples et testables.",
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
  },
};

export default function AboutPage() {
  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Pace Yourself",
    url: SITE_URL,
    description: "Outils de préparation, d’allure et de nutrition pour le trail et l’ultra-trail.",
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData).replace(/</g, "\\u003c") }}
      />
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">À propos</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Préparer une course sans improviser
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
          Pace Yourself aide les traileurs à transformer une distance, un dénivelé, une durée et des ravitaillements
          en un plan d’action compréhensible. L’objectif n’est pas de promettre une stratégie parfaite, mais de
          fournir une base cohérente à tester et à adapter à l’entraînement.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-3" aria-label="Nos engagements">
        {[
          ["Clarté", "Les hypothèses et limites des calculateurs doivent rester visibles et compréhensibles."],
          ["Données utiles", "Les fiches course distinguent les informations publiées des éléments encore à confirmer."],
          ["Progressivité", "Les stratégies de nutrition et d’allure doivent être testées avant le jour de la course."],
        ].map(([title, description]) => (
          <Card key={title}>
            <CardContent className="space-y-3 py-6">
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="leading-7 text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Ce que Pace Yourself ne remplace pas</h2>
        <p className="leading-7 text-muted-foreground">
          Les contenus et estimations du site sont informatifs. Ils ne remplacent ni un diagnostic médical, ni le
          suivi d’un professionnel de santé ou d’un diététicien du sport. Une douleur, des nausées récurrentes ou une
          difficulté inhabituelle à s’alimenter pendant l’effort doivent être discutées avec un professionnel qualifié.
        </p>
      </section>

      <nav className="flex flex-wrap gap-3" aria-label="En savoir plus">
        <Link
          href={"/methodologie" as Route}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          Consulter notre méthodologie
        </Link>
        <Link
          href="/support"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
        >
          Signaler une erreur
        </Link>
      </nav>
    </main>
  );
}

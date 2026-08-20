import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { SITE_URL } from "../seo";
import { CarbCalculator } from "./CarbCalculator";

export const metadata: Metadata = {
  title: "Calculateur de glucides par heure pour le trail",
  description:
    "Estimez rapidement vos glucides par heure et la quantité totale à prévoir selon la durée, la distance, le dénivelé et votre objectif.",
  alternates: { canonical: "/calculateur-glucides-trail" },
  openGraph: {
    title: "Calculateur glucides trail : combien de grammes par heure ?",
    description: "Un calcul simple pour définir un premier objectif nutritionnel à tester à l’entraînement.",
    url: new URL("/calculateur-glucides-trail", SITE_URL),
    type: "website",
  },
};

export default function CarbCalculatorPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculateur de glucides par heure pour le trail",
    url: new URL("/calculateur-glucides-trail", SITE_URL).toString(),
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Outil gratuit</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Combien de glucides par heure en trail ?
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Indiquez les caractéristiques de votre course pour obtenir un premier objectif simple, puis testez-le
          progressivement pendant vos sorties longues.
        </p>
      </header>

      <CarbCalculator />

      <section className="max-w-3xl space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Comment utiliser cette estimation ?</h2>
        <p className="leading-7 text-muted-foreground">
          Le résultat est un point de départ, pas une prescription médicale. Votre tolérance digestive, la chaleur,
          l’intensité et les produits choisis peuvent modifier vos besoins. Augmentez les apports progressivement et
          validez votre stratégie à l’entraînement.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <Link className="text-brand hover:underline" href="/blog/60g-glucide-par-heure">
            Comprendre l’objectif de 60 g par heure
          </Link>
          <Link className="text-brand hover:underline" href="/race-planner">
            Construire un plan complet
          </Link>
          <Link className="text-brand hover:underline" href={"/courses" as Route}>
            Choisir une course
          </Link>
        </div>
      </section>
    </main>
  );
}

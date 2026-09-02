import React from "react";

import { RACE_PLANNER_URL } from "../../seo";

export const PLANNER_META_DESCRIPTION =
  "Préparez vos glucides, votre hydratation, votre sodium, votre allure et vos ravitaillements pour chaque segment de votre trail.";

export const plannerStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Pace Yourself — Planificateur de nutrition trail",
  description: PLANNER_META_DESCRIPTION,
  url: RACE_PLANNER_URL,
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: 0,
    priceCurrency: "EUR",
  },
};

export const plannerFallback = (
  <section className="mx-auto w-full max-w-5xl space-y-5 px-4 py-10 sm:px-6 lg:px-8">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Planificateur trail</p>
    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
      Planifiez votre nutrition et votre allure de trail
    </h1>
    <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
      Préparez un plan segment par segment avec vos objectifs de glucides, d’eau et de sodium, votre allure et les
      ravitaillements de votre parcours.
    </p>
    <ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
      <li>Importez votre trace GPX ou choisissez une course.</li>
      <li>Estimez votre temps et vos besoins nutritionnels.</li>
      <li>Répartissez votre stratégie entre les ravitaillements.</li>
    </ul>
  </section>
);

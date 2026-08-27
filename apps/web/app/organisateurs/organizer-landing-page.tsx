"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type SVGProps } from "react";
import type { Route } from "next";

import { trackGoogleAnalyticsEvent } from "../../lib/google-analytics";
import type { OrganizerAttribution } from "../../lib/organizer-acquisition";

type OrganizerLandingPageProps = {
  attribution: OrganizerAttribution;
  creationHref: string;
};

type DemoKey = "course" | "dossards" | "materiel" | "acces";

const demoViews: Array<{
  key: DemoKey;
  label: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}> = [
  {
    key: "course",
    label: "Parcours & ravitos",
    title: "Le parcours et ses points clés",
    description: "Trace, profil, horaires, barrières et ravitaillements restent réunis dans une vue conçue pour le jour de course.",
    image: "/landing/organisateurs/tst-course-ravitos.jpeg",
    imageAlt: "Race Book TST affichant les horaires, barrières et ravitaillements du parcours Ultra des Cimes",
  },
  {
    key: "dossards",
    label: "Dossards & horaires",
    title: "Les informations à retrouver avant le départ",
    description: "Adresses, créneaux de retrait, documents et horaires sont accessibles sans rechercher un ancien email ou un PDF.",
    image: "/landing/organisateurs/tst-dossards.jpeg",
    imageAlt: "Race Book TST affichant les lieux, horaires et documents nécessaires au retrait du dossard",
  },
  {
    key: "materiel",
    label: "Matériel",
    title: "Le matériel obligatoire clairement identifié",
    description: "Chaque équipement obligatoire ou conseillé reste facile à vérifier avant de préparer son sac.",
    image: "/landing/organisateurs/tst-materiel.jpeg",
    imageAlt: "Race Book TST affichant la liste du matériel obligatoire et conseillé pour l’Ultra des Cimes",
  },
  {
    key: "acces",
    label: "Accès & navettes",
    title: "Les accès et transports réunis au même endroit",
    description: "Départ, arrivée, parkings, navettes et restrictions sont consultables directement depuis le Race Book.",
    image: "/landing/organisateurs/tst-acces.jpeg",
    imageAlt: "Race Book TST affichant les lieux de départ et d’arrivée, parkings, navettes et restrictions d’accès",
  },
];

const runnerInformation = [
  "Parcours et traces GPX",
  "Horaires de départ",
  "Retrait des dossards",
  "Ravitaillements",
  "Matériel obligatoire",
  "Barrières horaires",
  "Parkings et navettes",
  "Consignes importantes",
];

const scatteredSources = ["Site internet", "Règlement PDF", "Réseaux sociaux", "Emails", "Roadbook", "Messages de dernière minute"];

const setupSteps = [
  { number: "01", title: "Créez votre événement", description: "Renseignez son nom, ses dates, son lieu et ses différents formats." },
  { number: "02", title: "Ajoutez les informations utiles", description: "Complétez parcours, horaires, ravitaillements, matériel et logistique à partir de vos contenus existants." },
  { number: "03", title: "Publiez votre Race Book", description: "Après validation, vos coureurs retrouvent les informations directement dans Pace Yourself." },
];

const ArrowIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);

const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
  </svg>
);

export function OrganizerLandingPage({ attribution, creationHref }: OrganizerLandingPageProps) {
  const [activeDemo, setActiveDemo] = useState<DemoKey>("course");
  const selectedDemo = demoViews.find((view) => view.key === activeDemo) ?? demoViews[0];

  const trackCta = (kind: "primary" | "secondary", placement: "hero" | "demo" | "final", destination: string) => {
    trackGoogleAnalyticsEvent("organizer_landing_cta_clicked", {
      event_category: "organizer_acquisition",
      cta_kind: kind,
      placement,
      destination,
      ...attribution,
    });
  };

  const primaryCta = (placement: "hero" | "demo" | "final", label: string) => (
    <Link
      href={creationHref as Route}
      onClick={() => trackCta("primary", placement, "/organizers")}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-center text-sm font-semibold text-brand-foreground shadow-lg shadow-[rgba(45,80,22,0.18)] transition hover:-translate-y-px hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
    >
      {label}
      <ArrowIcon className="h-4 w-4" />
    </Link>
  );

  const secondaryCta = (placement: "hero" | "final") => (
    <Link
      href="#exemple-tst"
      onClick={() => trackCta("secondary", placement, "#exemple-tst")}
      className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-5 py-3 text-center text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:border-emerald-300 dark:hover:text-emerald-100"
    >
      Voir un exemple complet
    </Link>
  );

  return (
    <div className="space-y-12 pb-12 sm:space-y-16 sm:pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted p-5 shadow-[0_24px_70px_rgba(45,80,22,0.10)] sm:p-8 lg:p-12">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-surface blur-3xl dark:bg-emerald-500/10" aria-hidden />
        <div className="relative grid items-center gap-9 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
              Pour les organisateurs de courses
            </p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Le Race Book de votre trail, directement dans la poche de vos coureurs
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Centralisez parcours, horaires, ravitaillements, matériel, retrait des dossards et informations pratiques dans un Race Book mobile clair et facile à consulter.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {primaryCta("hero", "Créer mon Race Book")}
              {secondaryCta("hero")}
            </div>
            <p className="text-sm text-muted-foreground">Vos informations existent déjà. Pace Yourself les rend simplement plus faciles à retrouver.</p>
          </div>
          <div className="mx-auto w-full max-w-[360px]">
            <div className="overflow-hidden rounded-[2rem] border border-border bg-card p-2 shadow-2xl shadow-[rgba(45,80,22,0.14)] sm:p-3">
              <Image
                src="/landing/organisateurs/tst-materiel.jpeg"
                alt="Race Book TST affichant le matériel obligatoire et conseillé pour l’Ultra des Cimes"
                width={712}
                height={1600}
                priority
                sizes="(min-width: 1024px) 360px, 82vw"
                className="h-auto w-full rounded-[1.45rem]"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="runner-result-title" className="space-y-7">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Côté coureur</p>
          <h2 id="runner-result-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Toutes les informations utiles avant le départ, au même endroit</h2>
          <p className="text-base leading-7 text-muted-foreground">Un Race Book simple à parcourir sur téléphone, quand une question se pose à la maison, sur la route ou au village départ.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {runnerInformation.map((item) => (
            <li key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground shadow-sm">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-surface text-brand dark:bg-emerald-400/10 dark:text-emerald-200"><CheckIcon className="h-4 w-4" /></span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-7 rounded-3xl border border-border bg-muted/60 p-6 sm:p-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Plus simple à retrouver</p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">L’essentiel ne devrait pas se perdre entre vos différents supports</h2>
          <p className="leading-7 text-muted-foreground">Pace Yourself ne remplace pas votre site, vos emails ou vos réseaux sociaux. Il rassemble les informations essentielles dans un format mobile pratique pour les coureurs.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {scatteredSources.map((source) => <div key={source} className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm font-medium text-muted-foreground shadow-sm">{source}</div>)}
        </div>
      </section>

      <section aria-labelledby="setup-title" className="space-y-7">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Une mise en place légère</p>
          <h2 id="setup-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Vous avez déjà les informations. Il ne reste qu’à les rendre faciles à consulter.</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {setupSteps.map((step) => (
            <li key={step.number} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="font-mono text-sm font-semibold text-brand dark:text-emerald-200">{step.number}</span>
              <h3 className="mt-5 text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="exemple-tst" aria-labelledby="demo-title" className="scroll-mt-6 space-y-7 rounded-3xl border border-border bg-card p-5 shadow-[0_18px_45px_rgba(45,80,22,0.08)] sm:p-9">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Exemple complet · TST</p>
            <h2 id="demo-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Voyez concrètement ce que peuvent retrouver vos coureurs</h2>
            <p className="leading-7 text-muted-foreground">Découvrez les informations réellement publiées dans le Race Book de notre course de démonstration.</p>
          </div>
          {primaryCta("demo", "Créer le Race Book de mon événement")}
        </div>

        <div className="overflow-x-auto" role="tablist" aria-label="Vues du Race Book TST">
          <div className="flex min-w-max gap-2 border-b border-border pb-2">
            {demoViews.map((view) => (
              <button
                key={view.key}
                type="button"
                role="tab"
                aria-selected={activeDemo === view.key}
                aria-controls={`demo-panel-${view.key}`}
                id={`demo-tab-${view.key}`}
                onClick={() => setActiveDemo(view.key)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${activeDemo === view.key ? "bg-brand text-brand-foreground dark:bg-emerald-400 dark:text-slate-950" : "bg-muted text-muted-foreground hover:bg-brand-surface hover:text-brand"}`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div id={`demo-panel-${selectedDemo.key}`} role="tabpanel" aria-labelledby={`demo-tab-${selectedDemo.key}`} className="grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-foreground">{selectedDemo.title}</h3>
            <p className="leading-7 text-muted-foreground">{selectedDemo.description}</p>
          </div>
          <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[2rem] border-[8px] border-foreground bg-background shadow-xl dark:border-emerald-950">
            <Image
              src={selectedDemo.image}
              alt={selectedDemo.imageAlt}
              width={712}
              height={1600}
              sizes="(min-width: 1024px) 430px, 88vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between dark:border-emerald-400/30 dark:bg-emerald-400/10">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Informations importantes</p>
          <h2 className="text-2xl font-semibold text-foreground">Prévenez vos coureurs lorsqu’une information change</h2>
          <p className="leading-7 text-muted-foreground">Modification de parcours, horaire, parking ou dernière consigne : l’organisation peut publier une information ciblée sans alourdir le Race Book.</p>
        </div>
        <div className="grid flex-none grid-cols-2 gap-2 text-xs font-medium text-foreground sm:grid-cols-3 lg:max-w-sm">
          {["Horaire", "Parcours", "Matériel", "Parking", "Navette", "Consigne"].map((item) => <span key={item} className="rounded-full border border-brand-border bg-card px-3 py-2 text-center dark:border-emerald-400/30">{item}</span>)}
        </div>
      </section>

      <section className="rounded-3xl bg-foreground px-5 py-10 text-center text-background sm:px-10 sm:py-14 dark:bg-emerald-950 dark:text-emerald-50">
        <div className="mx-auto max-w-3xl space-y-5">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Votre prochain Race Book peut être prêt en quelques minutes</h2>
          <p className="text-base leading-7 text-background/75 dark:text-emerald-100/80">Commencez avec les informations que vous possédez déjà, puis complétez votre événement à votre rythme.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {primaryCta("final", "Créer le Race Book de mon événement")}
            {secondaryCta("final")}
          </div>
        </div>
      </section>
    </div>
  );
}

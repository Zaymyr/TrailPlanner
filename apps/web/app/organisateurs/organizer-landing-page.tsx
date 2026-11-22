"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type SVGProps } from "react";
import type { Route } from "next";

import { trackGoogleAnalyticsEvent } from "../../lib/google-analytics";
import type { OrganizerAttribution } from "../../lib/organizer-acquisition";
import { ANDROID_APP_STORE_URL, PUBLIC_IOS_APP_STORE_URL } from "../../lib/app-store";
import { ORGANIZER_TIER_PRICE_EUR } from "../../lib/organizer-modules";
import type { OrganizerSocialProof } from "../../lib/organizer-social-proof";
import { formatProofCount as formatCount, ProofLogo } from "../../components/landing/ProofLogo";
import { RaceBookPhoneMockup } from "../../components/landing/RaceBookPhoneMockup";
import { OrganizerDemoRequestForm } from "./organizer-demo-request-form";

type OrganizerLandingPageProps = {
  attribution: OrganizerAttribution;
  creationHref: string;
  socialProofs: OrganizerSocialProof[];
};

type DemoKey = "course" | "dossards" | "materiel" | "acces";

const PLAY_STORE_URL = ANDROID_APP_STORE_URL;
const APP_STORE_URL = PUBLIC_IOS_APP_STORE_URL;
const formatPriceEur = (value: number) => `${value} €`;

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
    imageAlt: "Livret coureur TST affichant les horaires, barrières et ravitaillements du parcours Ultra des Cimes",
  },
  {
    key: "dossards",
    label: "Dossards & horaires",
    title: "Les informations à retrouver avant le départ",
    description: "Adresses, créneaux de retrait, documents et horaires sont accessibles sans rechercher un ancien email ou un PDF.",
    image: "/landing/organisateurs/tst-dossards.jpeg",
    imageAlt: "Livret coureur TST affichant les lieux, horaires et documents nécessaires au retrait du dossard",
  },
  {
    key: "materiel",
    label: "Matériel",
    title: "Le matériel obligatoire clairement identifié",
    description: "Chaque équipement obligatoire ou conseillé reste facile à vérifier avant de préparer son sac.",
    image: "/landing/organisateurs/tst-materiel.jpeg",
    imageAlt: "Livret coureur TST affichant la liste du matériel obligatoire et conseillé pour l’Ultra des Cimes",
  },
  {
    key: "acces",
    label: "Accès & navettes",
    title: "Les accès et transports réunis au même endroit",
    description: "Départ, arrivée, parkings, navettes et restrictions sont consultables directement depuis le Livret coureur.",
    image: "/landing/organisateurs/tst-acces.jpeg",
    imageAlt: "Livret coureur TST affichant les lieux de départ et d’arrivée, parkings, navettes et restrictions d’accès",
  },
];

const livretProducts = [
  {
    key: "coureur",
    eyebrow: "Pour vos coureurs",
    name: "Livret coureur",
    features: ["Parcours, GPX et ravitos", "Horaires, dossards et matériel", "Accès, parkings et navettes"],
    access: "Dans l’app Pace Yourself",
    href: "/livret-coureur",
  },
  {
    key: "supporter",
    eyebrow: "Pour leurs proches",
    name: "Livret supporter",
    features: ["Programme jour par jour", "Points de suivi et d’encouragement", "Accès, séjour et infos pratiques"],
    access: "Lien web et QR code, sans compte",
    href: "/livret-supporter",
  },
] as const;

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
  { number: "03", title: "Publiez vos deux livrets", description: "Après validation, vos coureurs retrouvent le Livret coureur dans Pace Yourself et vous partagez le Livret supporter par lien ou QR code." },
];

const tstDiscoverySteps = [
  {
    number: "01",
    title: "Téléchargez Pace Yourself",
    description: "Installez gratuitement l’application depuis l’App Store ou Google Play, puis ouvrez-la.",
  },
  {
    number: "02",
    title: "Recherchez Trail TST",
    description: "Dans l’onglet Courses, utilisez la recherche et ouvrez la fiche Trail TST.",
  },
  {
    number: "03",
    title: "Ouvrez son Livret coureur",
    description: "Choisissez l’un des trois formats, puis appuyez sur « Livret coureur » pour parcourir toutes les informations.",
  },
] as const;

const organizerOffers = [
  {
    name: "Essentiel",
    price: formatPriceEur(ORGANIZER_TIER_PRICE_EUR.essential),
    description: "Livret coureur et Livret supporter, l’essentiel",
    features: ["Livret coureur et Livret supporter", "Course et GPX", "Matériel et dossard", "Accès principal et ravitos simples"],
    recommended: false,
    cta: { label: "Créer mon Livret coureur", kind: "create" },
  },
  {
    name: "Complet",
    price: formatPriceEur(ORGANIZER_TIER_PRICE_EUR.complete),
    description: "La logistique avancée",
    features: ["Tout Essentiel", "Vagues de départ (SAS) et barrières horaires", "Services et navettes", "Podiums et notifications"],
    recommended: true,
    cta: { label: "Créer mon Livret coureur", kind: "create" },
  },
  {
    name: "Signature",
    price: formatPriceEur(ORGANIZER_TIER_PRICE_EUR.signature),
    description: "L’expérience personnalisée",
    features: ["Tout Complet", "Relais et produits officiels", "Partenaires et statistiques de clics", "Identité visuelle et import assisté"],
    recommended: false,
    cta: { label: "Parler de Signature", kind: "talk" },
  },
] as const;

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

export function OrganizerLandingPage({ attribution, creationHref, socialProofs }: OrganizerLandingPageProps) {
  const [activeDemo, setActiveDemo] = useState<DemoKey>("course");
  const selectedDemo = demoViews.find((view) => view.key === activeDemo) ?? demoViews[0];
  const featuredProof = socialProofs[0] ?? null;

  const trackCta = (kind: "primary" | "secondary", placement: "hero" | "demo" | "final" | "pricing", destination: string) => {
    trackGoogleAnalyticsEvent("organizer_landing_cta_clicked", {
      event_category: "organizer_acquisition",
      cta_kind: kind,
      placement,
      destination,
      ...attribution,
    });
  };

  const primaryCta = (placement: "hero" | "demo" | "final" | "pricing", label: string, className = "") => (
    <Link
      href={creationHref as Route}
      onClick={() => trackCta("primary", placement, "/organizers")}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-center text-sm font-semibold text-brand-foreground shadow-lg shadow-[rgba(45,80,22,0.18)] transition hover:-translate-y-px hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 ${className}`}
    >
      {label}
      <ArrowIcon className="h-4 w-4" />
    </Link>
  );

  const appCta = (placement: "hero" | "demo" | "final", label = "Télécharger l’app et voir TST") => (
    <div className="flex flex-col gap-2 sm:flex-row">
      {[
        { name: "App Store", url: APP_STORE_URL },
        { name: "Google Play", url: PLAY_STORE_URL },
      ].map((store) => (
        <a
          key={store.name}
          href={store.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackCta("secondary", placement, store.url)}
          aria-label={`${label} sur ${store.name}`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-5 py-3 text-center text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:border-emerald-300 dark:hover:text-emerald-100"
        >
          Télécharger sur {store.name}
        </a>
      ))}
    </div>
  );

  const demoCta = () => (
    <a
      href="#exemple-tst"
      onClick={() => trackCta("secondary", "hero", "#exemple-tst")}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card/90 px-5 py-3 text-center text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:border-emerald-300 dark:hover:text-emerald-100"
    >
      Voir la démo du Livret
      <ArrowIcon className="h-4 w-4 rotate-90" />
    </a>
  );

  return (
    <div className="space-y-10 pb-10 sm:space-y-14 sm:pb-14 lg:space-y-16 lg:pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface via-card to-muted p-5 shadow-[0_28px_80px_rgba(45,80,22,0.14)] sm:p-7 lg:p-8 xl:p-10 dark:border-emerald-400/25 dark:from-emerald-400/10 dark:via-card dark:to-card">
        <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-card/80 blur-3xl dark:bg-emerald-300/5" aria-hidden />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-brand/10 blur-3xl dark:bg-emerald-300/10" aria-hidden />
        <div className="relative grid items-start gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.75fr)] md:gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(240px,0.72fr)] lg:gap-9 xl:gap-12">
          <div className="space-y-5 lg:space-y-6">
            <p className="inline-flex rounded-full border border-brand-border bg-card/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand shadow-sm dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-100">
              Livret coureur + Livret supporter
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-[2rem] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-[2.25rem] lg:text-[clamp(2.1rem,3.2vw,2.75rem)]">
                Une seule source d’information pour vos coureurs et leurs proches.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Publiez vos informations une fois : vos coureurs ont leur Livret coureur, leurs familles et amis le Livret supporter pour suivre la course.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-start lg:flex-row">
              {primaryCta("hero", "Créer mon Livret coureur")}
              {demoCta()}
            </div>
            <a href="#demande-demo" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline-offset-4 hover:underline dark:text-emerald-200">
              Besoin d’en parler ? Demander une démo
            </a>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/80" aria-label="Avantages de l’offre">
              {[`Les deux livrets dès ${formatPriceEur(ORGANIZER_TIER_PRICE_EUR.essential)} HT par édition`, "Tous vos formats inclus", "Présence au catalogue gratuite"].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-foreground dark:bg-emerald-400 dark:text-slate-950">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            {featuredProof ? (
              <a
                href="#preuve-sociale"
                className="flex max-w-2xl items-center gap-4 rounded-2xl border border-brand-border bg-card/95 p-3 pr-4 shadow-sm transition hover:border-brand hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-emerald-400/25 dark:bg-card/80"
              >
                <ProofLogo proof={featuredProof} className="h-12 w-12 sm:h-14 sm:w-14" />
                <span className="min-w-0 space-y-1">
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brand dark:text-emerald-200">
                    Ils l’ont utilisé · {featuredProof.eventName}
                  </span>
                  {featuredProof.quoteText ? (
                    <span className="line-clamp-3 text-sm font-medium leading-5 text-foreground sm:line-clamp-2">« {featuredProof.quoteText} »</span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">
                    {formatCount(featuredProof.uniqueReaders)} lecteurs uniques estimés · {formatCount(featuredProof.totalOpens)} ouvertures
                  </span>
                </span>
              </a>
            ) : null}
            <ul className="grid grid-cols-2 gap-2 sm:gap-3" aria-label="Les deux livrets inclus">
              {livretProducts.map((product) => (
                <li
                  key={product.key}
                  className="rounded-2xl border border-brand-border bg-card/90 p-3 shadow-sm sm:p-4 dark:border-emerald-400/25 dark:bg-card/80"
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{product.eyebrow}</p>
                  <h2 className="mt-1 text-base font-semibold leading-tight text-foreground sm:text-lg">
                    <Link href={product.href as Route} className="underline-offset-4 hover:text-brand hover:underline">{product.name}</Link>
                  </h2>
                  <ul className="mt-2 hidden space-y-1.5 text-sm text-foreground/85 sm:block">
                    {product.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand dark:text-emerald-300" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-semibold leading-snug text-brand sm:mt-3 dark:text-emerald-200">{product.access}</p>
                </li>
              ))}
            </ul>
            {featuredProof ? null : (
              <p className="text-sm text-muted-foreground">Vos informations existent déjà. Pace Yourself les rend simplement plus faciles à retrouver.</p>
            )}
          </div>

          <RaceBookPhoneMockup
            showSupporterCard
            className="mx-auto mb-6 w-full max-w-[260px] sm:max-w-[280px] md:mt-1 md:max-w-[260px] md:justify-self-end lg:max-w-[clamp(240px,calc(40svh-56px),290px)]"
          />
        </div>
      </section>

      {socialProofs.length > 0 ? (
        <section id="preuve-sociale" aria-labelledby="social-proof-title" className="scroll-mt-6 space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Ils l’ont utilisé en course</p>
            <h2 id="social-proof-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Ce qu’en disent les organisateurs
            </h2>
          </div>
          <div className="space-y-5">
            {socialProofs.map((proof, index) => (
              <article
                key={proof.id}
                className={`grid gap-6 rounded-3xl border bg-card p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-10 ${index === 0 ? "border-brand-border shadow-[0_24px_70px_rgba(45,80,22,0.14)] dark:border-emerald-400/25" : "border-border shadow-sm"}`}
              >
                <figure className="space-y-5">
                  <div className="flex items-center gap-4">
                    <ProofLogo proof={proof} className="h-16 w-16 sm:h-20 sm:w-20" />
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight text-foreground">{proof.eventName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Édition {proof.editionYear}{proof.location ? ` · ${proof.location}` : ""}
                      </p>
                    </div>
                  </div>
                  {proof.quoteText ? (
                    <>
                      <blockquote className="relative border-l-4 border-brand pl-5 text-xl font-medium leading-relaxed text-foreground sm:text-2xl dark:border-emerald-300">
                        <p>« {proof.quoteText} »</p>
                      </blockquote>
                      {proof.quoteAuthorName || proof.quoteAuthorRole ? (
                        <figcaption className="pl-6 text-sm text-muted-foreground">
                          {proof.quoteAuthorName ? <strong className="font-semibold text-foreground">{proof.quoteAuthorName}</strong> : null}
                          {proof.quoteAuthorName && proof.quoteAuthorRole ? " · " : null}
                          {proof.quoteAuthorRole}
                        </figcaption>
                      ) : null}
                    </>
                  ) : null}
                </figure>
                <div className="space-y-3 self-end border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Usage mesuré</p>
                  <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                    <div className="flex flex-col">
                      <dt className="order-2 text-xs leading-5 text-muted-foreground">lecteurs uniques estimés</dt>
                      <dd className="order-1 text-2xl font-semibold tracking-tight text-brand dark:text-emerald-200">{formatCount(proof.uniqueReaders)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="order-2 text-xs leading-5 text-muted-foreground">ouvertures du Livret</dt>
                      <dd className="order-1 text-2xl font-semibold tracking-tight text-foreground">{formatCount(proof.totalOpens)}</dd>
                    </div>
                  </dl>
                  <p className="text-[0.68rem] leading-4 text-muted-foreground">Statistiques agrégées, hors comptes internes et de test.</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="runner-result-title" className="space-y-7">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Côté coureur</p>
          <h2 id="runner-result-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Toutes les informations utiles avant le départ, au même endroit</h2>
          <p className="text-base leading-7 text-muted-foreground">Un Livret coureur simple à parcourir sur téléphone, quand une question se pose à la maison, sur la route ou au village départ.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {runnerInformation.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs font-medium text-foreground shadow-sm sm:gap-3 sm:p-4 sm:text-sm">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-surface text-brand sm:h-7 sm:w-7 dark:bg-emerald-400/10 dark:text-emerald-200"><CheckIcon className="h-4 w-4" /></span>
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
        <ol className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {setupSteps.map((step) => (
            <li key={step.number} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
            <p className="leading-7 text-muted-foreground">Découvrez les informations réellement publiées dans le Livret coureur de notre course de démonstration.</p>
          </div>
          {appCta("demo", "Télécharger l’app")}
        </div>

        <ol className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {tstDiscoverySteps.map((step) => (
            <li key={step.number} className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
              <span className="font-mono text-sm font-semibold text-brand dark:text-emerald-200">{step.number}</span>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="snap-x snap-mandatory overflow-x-auto" role="tablist" aria-label="Vues du Livret coureur TST">
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
                className={`snap-start rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${activeDemo === view.key ? "bg-brand text-brand-foreground dark:bg-emerald-400 dark:text-slate-950" : "bg-muted text-muted-foreground hover:bg-brand-surface hover:text-brand"}`}
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
          <div className="mx-auto w-fit max-w-full overflow-hidden rounded-[1.5rem] border-[6px] border-foreground bg-background shadow-xl dark:border-emerald-950">
            <Image
              src={selectedDemo.image}
              alt={selectedDemo.imageAlt}
              width={712}
              height={1600}
              sizes="(min-width: 640px) 280px, 62vw"
              className="h-auto max-h-[min(58vh,620px)] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between dark:border-emerald-400/30 dark:bg-emerald-400/10">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Informations importantes</p>
          <h2 className="text-2xl font-semibold text-foreground">Prévenez vos coureurs lorsqu’une information change</h2>
          <p className="leading-7 text-muted-foreground">Modification de parcours, horaire, parking ou dernière consigne : l’organisation peut publier une information ciblée sans alourdir le Livret coureur.</p>
        </div>
        <div className="grid flex-none grid-cols-2 gap-2 text-xs font-medium text-foreground sm:grid-cols-3 lg:max-w-sm">
          {["Horaire", "Parcours", "Matériel", "Parking", "Navette", "Consigne"].map((item) => <span key={item} className="rounded-full border border-brand-border bg-card px-3 py-2 text-center dark:border-emerald-400/30">{item}</span>)}
        </div>
      </section>

      <section aria-labelledby="offers-title" className="space-y-7">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Une offre adaptée à chaque course</p>
          <h2 id="offers-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Activez seulement les sections dont vous avez besoin</h2>
          <p className="leading-7 text-muted-foreground">Prix HT par édition, sans abonnement, quel que soit le nombre de formats ou de participants. La présence au catalogue reste gratuite.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {organizerOffers.map((offer) => (
            <article
              key={offer.name}
              className={`flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${offer.recommended ? "border-brand shadow-[0_18px_45px_rgba(45,80,22,0.14)] dark:border-emerald-300" : "border-border"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand dark:text-emerald-200">{offer.name}</p>
                {offer.recommended ? (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-brand-foreground dark:bg-emerald-400 dark:text-slate-950">Recommandé</span>
                ) : null}
              </div>
              <p className="mt-2 text-3xl font-semibold text-foreground">{offer.price} <span className="text-sm font-normal text-muted-foreground">HT / édition</span></p>
              <p className="mt-2 text-sm text-muted-foreground">{offer.description}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-foreground">
                {offer.features.map((feature) => <li key={feature} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{feature}</li>)}
              </ul>
              <div className="mt-6 flex">
                {offer.cta.kind === "create" ? (
                  primaryCta("pricing", offer.cta.label, "w-full")
                ) : (
                  <a
                    href="#demande-demo"
                    onClick={() => trackCta("secondary", "pricing", "#demande-demo")}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-brand-border bg-card px-5 py-3 text-center text-sm font-semibold text-brand transition hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-emerald-300/60 dark:text-emerald-100"
                  >
                    {offer.cta.label}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="demande-demo" aria-labelledby="demo-request-title" className="scroll-mt-6 grid gap-6 rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center dark:border-emerald-400/30 dark:bg-emerald-400/10">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">Démo personnalisée</p>
          <h2 id="demo-request-title" className="text-3xl font-semibold tracking-tight text-foreground">Voyez le Livret appliqué à votre course</h2>
          <p className="leading-7 text-muted-foreground">Laissez votre e-mail et le lien de votre course : nous vous montrons ce que vos coureurs verraient, avec vos informations, et répondons à vos questions.</p>
        </div>
        <OrganizerDemoRequestForm attribution={attribution} />
      </section>

      <section className="rounded-3xl bg-foreground px-5 py-10 text-center text-background sm:px-10 sm:py-14 dark:bg-emerald-950 dark:text-emerald-50">
        <div className="mx-auto max-w-3xl space-y-5">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vos Livrets coureur et supporter peuvent être prêts en quelques minutes</h2>
          <p className="text-base leading-7 text-background/75 dark:text-emerald-100/80">Commencez avec les informations que vous possédez déjà, puis complétez votre événement à votre rythme.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {primaryCta("final", "Créer le Livret coureur de mon événement")}
            {appCta("final")}
          </div>
          <a href="#demande-demo" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-background underline underline-offset-4 dark:text-emerald-50">
            Ou demander une démo
          </a>
        </div>
      </section>
    </div>
  );
}

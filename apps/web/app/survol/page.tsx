import type { Metadata } from "next";

import { SITE_URL } from "../seo";
import { FlyoverOrderForm } from "./flyover-order-form";

const canonicalPath = "/survol";
const title = "Vidéo de survol 3D de votre parcours";
const description =
  "Envoyez le GPX de votre course : nous créons sous 24 h une vidéo de survol 3D avec voix off et récit, publiée en collaboration sur Instagram ou livrée en MP4.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: canonicalPath },
  openGraph: {
    title,
    description,
    url: new URL(canonicalPath, SITE_URL).toString(),
    siteName: "Pace Yourself",
    locale: "fr_FR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

const STEPS = [
  { title: "Votre GPX", text: "Le tracé, le nom de la course et, si vous le souhaitez, vos ravitaillements." },
  { title: "Votre style", text: "Quatre fonds de carte et un relief plus ou moins accentué." },
  { title: "Sous 24 h", text: "Survol 3D, voix off et récit écrits pour votre parcours, au format reel vertical." },
];

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

/** Standalone order page of the organizer flyover video (independent of the livret offers). */
export default function FlyoverOrderPage({ searchParams }: PageProps) {
  const cancelled = searchParams?.paiement === "annule";
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface via-card to-muted p-5 shadow-[0_28px_80px_rgba(45,80,22,0.14)] sm:p-8 dark:border-emerald-400/25 dark:from-emerald-400/10 dark:via-card dark:to-card">
        <p className="inline-flex rounded-full border border-brand-border bg-card/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand shadow-sm dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-100">
          Organisateurs · Vidéo de survol
        </p>
        <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-[2.5rem]">
          Faites survoler votre parcours en 3D à vos futurs coureurs.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Une vidéo verticale prête pour Instagram : le tracé qui se dessine sur le relief, les montées clés, vos ravitos, une voix off et un récit écrits pour votre course.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand dark:text-emerald-300">Étape {index + 1}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="flyover-order-title" className="space-y-4">
        <h2 id="flyover-order-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Commander la vidéo</h2>
        <FlyoverOrderForm cancelled={cancelled} />
      </section>

      <section aria-labelledby="flyover-faq-title" className="space-y-3 text-sm leading-6 text-muted-foreground">
        <h2 id="flyover-faq-title" className="text-xl font-semibold text-foreground">Bon à savoir</h2>
        <p><strong className="text-foreground">Collaboration Instagram.</strong> Le reel est publié sur le compte Pace Yourself à la date choisie. Instagram envoie alors une invitation de collaboration au compte de votre événement : acceptez-la pour qu’il apparaisse aussi sur votre profil.</p>
        <p><strong className="text-foreground">Téléchargement.</strong> Vous recevez un lien pour télécharger le MP4 (1080 × 1920), à utiliser librement. Il reste disponible 30 jours.</p>
        <p><strong className="text-foreground">Le GPX.</strong> Il doit contenir les altitudes (export standard de Strava, Garmin, Visorando, OpenRunner…). Il sert uniquement à fabriquer la vidéo.</p>
      </section>
    </div>
  );
}

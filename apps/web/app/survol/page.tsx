import type { Metadata } from "next";

import { SITE_URL } from "../seo";
import { FlyoverOrderForm } from "./flyover-order-form";
import { buildFlyoverStructuredData } from "./flyover-structured-data";

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
  { title: "Votre GPX", text: "Le tracé et vos ravitos, importés directement depuis le fichier." },
  { title: "L’aperçu", text: "Le survol 3D se joue dans la page : fond de carte et relief au choix." },
  { title: "Sous 24 h", text: "La vidéo finale avec voix off et récit, en reel vertical." },
];

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

/** Standalone order page of the organizer flyover video (independent of the livret offers). */
export default function FlyoverOrderPage({ searchParams }: PageProps) {
  const cancelled = searchParams?.paiement === "annule";
  const structuredData = buildFlyoverStructuredData(canonicalPath, description);
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12 sm:space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <section className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface via-card to-muted p-4 shadow-[0_28px_80px_rgba(45,80,22,0.14)] sm:p-8 dark:border-emerald-400/25 dark:from-emerald-400/10 dark:via-card dark:to-card">
        <p className="inline-flex rounded-full border border-brand-border bg-card/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand shadow-sm dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-100">
          Organisateurs · Vidéo de survol
        </p>
        <h1 className="mt-3 max-w-3xl text-[1.75rem] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:mt-4 sm:text-[2.5rem]">
          Faites survoler votre parcours en 3D à vos futurs coureurs.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:mt-4 sm:text-lg">
          Déposez votre GPX : l’aperçu 3D se joue tout de suite. Choisissez le fond de carte et le relief, la voix off et le récit sont écrits pour votre course.
        </p>
        <ol className="mt-6 hidden gap-3 sm:grid sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand dark:text-emerald-300">Étape {index + 1}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <FlyoverOrderForm cancelled={cancelled} />

      <section aria-labelledby="flyover-faq-title" className="space-y-3 text-sm leading-6 text-muted-foreground">
        <h2 id="flyover-faq-title" className="text-xl font-semibold text-foreground">Bon à savoir</h2>
        <p><strong className="text-foreground">Collaboration Instagram.</strong> Le reel est publié sur le compte Pace Yourself à la date choisie. Instagram envoie alors une invitation de collaboration au compte de votre événement : acceptez-la pour qu’il apparaisse aussi sur votre profil.</p>
        <p><strong className="text-foreground">Téléchargement.</strong> Vous recevez un lien pour télécharger le MP4 (1080 × 1920), à utiliser librement. Il reste disponible 30 jours.</p>
        <p><strong className="text-foreground">Le GPX.</strong> Il doit contenir les altitudes (export standard de Strava, Garmin, Visorando, OpenRunner…). Il sert uniquement à fabriquer la vidéo.</p>
      </section>
    </div>
  );
}

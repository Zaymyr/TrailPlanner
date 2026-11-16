import type { Metadata, Route } from "next";
import Link from "next/link";

import { LivretProductPage } from "../../components/landing/LivretProductPage";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../seo";

const path = "/livret-supporter";
const title = "Livret supporter : suivre un trail et encourager un coureur";
const description =
  "Programme, départs, points d’encouragement, ravitos accessibles, parkings et navettes : le Livret supporter aide la famille, les amis et le public à suivre une course de trail. Gratuit, sans compte.";

export const metadata: Metadata = {
  title: "Livret supporter : suivre un trail et encourager un coureur | Pace Yourself",
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: new URL(path, SITE_URL), type: "website", images: [DEFAULT_SOCIAL_IMAGE] },
  twitter: { card: "summary_large_image", title, description, images: [DEFAULT_SOCIAL_IMAGE_PATH] },
};

const previewRows = [
  { tag: "Départ · 07:00", title: "Départ de l’ultra" },
  { tag: "Suivi · km 12", title: "Point d’encouragement" },
  { tag: "Ravito · km 18", title: "Accompagnateurs autorisés" },
  { tag: "Arrivée", title: "Village et podiums" },
] as const;

function SupporterPreview() {
  return (
    <figure className="overflow-hidden rounded-[1.75rem] border-[6px] border-foreground bg-card shadow-2xl dark:border-emerald-950" aria-label="Illustration du Livret supporter">
      <div className="bg-brand px-4 pb-4 pt-5 text-brand-foreground dark:bg-emerald-800 dark:text-emerald-50">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] opacity-80">Livret supporter</p>
        <p className="mt-1 text-lg font-semibold leading-tight">Suivre la course</p>
        <div className="mt-3 flex gap-1 text-[0.65rem] font-semibold">
          {["Programme", "Suivre", "Séjour", "Pratique"].map((tab, index) => (
            <span key={tab} className={`rounded-full px-2 py-1 ${index === 1 ? "bg-card text-brand" : "bg-white/15"}`}>{tab}</span>
          ))}
        </div>
      </div>
      <ol className="space-y-2 p-3">
        {previewRows.map((row) => (
          <li key={row.tag} className="rounded-xl border border-border bg-background/70 px-3 py-2">
            <span className="block text-[0.6rem] font-semibold uppercase tracking-wide text-brand">{row.tag}</span>
            <span className="block text-sm font-semibold text-foreground">{row.title}</span>
          </li>
        ))}
      </ol>
      <figcaption className="border-t border-border px-3 py-2 text-[0.65rem] text-muted-foreground">Illustration · contenu publié par chaque organisation</figcaption>
    </figure>
  );
}

const primaryButton = "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-light";

export default function LivretSupporterPage() {
  return (
    <LivretProductPage
      path={path}
      eyebrow="Livret supporter"
      title="Suivre un trail et encourager ton coureur, au bon endroit et au bon moment"
      intro="Le Livret supporter est le guide des proches et du public : programme des départs, points d’encouragement, ravitos accessibles, parkings et infos pratiques. Il s’ouvre dans le navigateur, par lien ou QR code, sans compte."
      actions={<Link href={"/courses" as Route} className={primaryButton}>Trouver une course à suivre</Link>}
      visual={<SupporterPreview />}
      sectionsTitle="Ce que contient le Livret supporter"
      sections={[
        { title: "Programme", description: "Les départs, barrières d’arrivée et podiums de chaque format, jour par jour." },
        { title: "Points de suivi", description: "Où encourager ou assister les coureurs, avec le kilomètre et l’accès à chaque point." },
        { title: "Ravitos accessibles", description: "Les ravitos ouverts aux accompagnateurs et l’heure de passage du dernier coureur." },
        { title: "Sur place", description: "Les services proposés sur le site : récupération et autres services de l’organisation." },
        { title: "Séjour", description: "Restauration et hébergement proposés autour de l’événement." },
        { title: "Pratique", description: "Accès, parkings, navettes, retrait de dossard par un tiers et liens officiels." },
      ]}
      stepsTitle="Comment ouvrir le Livret supporter"
      steps={[
        { title: "Récupère le lien ou le QR code", description: "L’organisation le partage avec les inscrits : il suffit de le transmettre à tes proches." },
        { title: "Ou cherche la course", description: "Sur la fiche événement Pace Yourself, appuie sur « Suivre la course »." },
        { title: "Ouvre-le dans le navigateur", description: "Pas de compte ni d’application à installer, en français ou en anglais." },
      ]}
      questions={[
        { question: "Faut-il installer une application ?", answer: "Non. Le Livret supporter s’ouvre dans le navigateur du téléphone, sans compte. Il est aussi disponible dans l’app Pace Yourself." },
        { question: "Est-ce un suivi GPS en direct ?", answer: "Non. Le Livret supporter indique le programme, les points de suivi et les horaires publiés par l’organisation, pas la position des coureurs en temps réel." },
        { question: "Toutes les courses ont-elles un Livret supporter ?", answer: "Il est disponible quand l’organisation l’a publié sur Pace Yourself. Dans ce cas, la fiche de l’événement propose « Suivre la course »." },
        { question: "C’est payant pour les proches ?", answer: "Non, il est gratuit pour les coureurs, leurs proches et le public : c’est l’organisation qui le publie." },
      ]}
      crossLink={{ href: "/livret-coureur", label: "Découvrir le Livret coureur", description: "toutes les infos officielles de la course pour les coureurs." }}
    />
  );
}

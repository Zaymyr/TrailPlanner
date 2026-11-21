import type { Metadata, Route } from "next";
import Link from "next/link";

import { LivretProductPage } from "../../components/landing/LivretProductPage";
import { ANDROID_APP_STORE_URL, PUBLIC_IOS_APP_STORE_URL } from "../../lib/app-store";
import { SITE_URL } from "../seo";

const path = "/livret-coureur";
const title = "Livret coureur trail : toutes les infos de ta course dans ton téléphone";
const description =
  "Parcours, horaires, barrières, ravitos, dossards, matériel obligatoire et accès : le Livret coureur officiel de ta course, gratuit dans l’app Pace Yourself.";
const ogImage = new URL("/landing/organisateurs/tst-course-ravitos.jpeg", SITE_URL).toString();

export const metadata: Metadata = {
  title: "Livret coureur : les infos officielles de ta course",
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: new URL(path, SITE_URL), type: "website", images: [{ url: ogImage, alt: "Livret coureur affichant les ravitaillements d’un trail" }] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
};

const primaryButton = "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-light";
const secondaryButton = "inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface";

export default function LivretCoureurPage() {
  return (
    <LivretProductPage
      path={path}
      eyebrow="Livret coureur"
      title="Toutes les infos officielles de ta course, dans ton téléphone"
      intro="Le Livret coureur réunit ce que l’organisation publie pour ta course : parcours, horaires, ravitos, dossards, matériel et accès. Fini de chercher entre le site, le règlement PDF et les emails."
      actions={(
        <>
          <a href={ANDROID_APP_STORE_URL} target="_blank" rel="noreferrer" className={primaryButton}>Télécharger sur Google Play</a>
          <a href={PUBLIC_IOS_APP_STORE_URL} target="_blank" rel="noreferrer" className={secondaryButton}>Télécharger sur l’App Store</a>
          <Link href={"/courses" as Route} className={secondaryButton}>Trouver ma course</Link>
        </>
      )}
      visual={{ src: "/landing/organisateurs/tst-course-ravitos.jpeg", alt: "Livret coureur du Trail TST affichant horaires, barrières et ravitaillements" }}
      sectionsTitle="Ce que contient le Livret coureur"
      sections={[
        { title: "Parcours et trace GPX", description: "Le tracé, le profil et les points clés du parcours, tels que publiés par l’organisation." },
        { title: "Horaires et barrières", description: "Heure de départ, vagues, barrières horaires et heure limite d’arrivée." },
        { title: "Ravitaillements", description: "Position de chaque ravito, ce qu’on y trouve et les règles d’assistance." },
        { title: "Retrait des dossards", description: "Lieux, créneaux et documents à présenter pour récupérer ton dossard." },
        { title: "Matériel obligatoire", description: "La liste du matériel obligatoire et conseillé, à cocher en préparant ton sac." },
        { title: "Accès, parkings et navettes", description: "Départ, arrivée, stationnement et navettes pour arriver sereinement." },
      ]}
      stepsTitle="Comment ouvrir le Livret coureur de ta course"
      steps={[
        { title: "Télécharge Pace Yourself", description: "L’application est gratuite sur Google Play et l’App Store." },
        { title: "Cherche ta course", description: "Dans l’onglet Courses, recherche ton événement et choisis ton format." },
        { title: "Ouvre « Livret coureur »", description: "Toutes les informations publiées par l’organisation sont regroupées, prêtes pour le jour J." },
      ]}
      questions={[
        { question: "Le Livret coureur est-il gratuit ?", answer: "Oui pour les coureurs : il est publié par l’organisation de la course et se consulte gratuitement dans l’app Pace Yourself." },
        { question: "Toutes les courses ont-elles un Livret coureur ?", answer: "Non. Il est disponible quand l’organisation l’a publié. Les autres courses du catalogue affichent leur fiche publique : distance, dénivelé, ravitos connus et liens officiels." },
        { question: "Les informations sont-elles officielles ?", answer: "Oui, elles sont saisies et validées par l’organisation. En cas de doute, le règlement officiel de l’épreuve fait foi." },
        { question: "Et mes proches qui viennent m’encourager ?", answer: "Ils ont leur propre Livret supporter : programme, points de suivi et accès, à ouvrir par lien ou QR code, sans compte." },
      ]}
      crossLink={{ href: "/livret-supporter", label: "Découvrir le Livret supporter", description: "le guide pour la famille, les amis et le public." }}
    />
  );
}

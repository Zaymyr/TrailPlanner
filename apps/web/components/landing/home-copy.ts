import type { LandingPageTranslations } from "../../locales/types";

/**
 * Marketing copy overrides for the home page (CRO pass, 2026-11-22).
 *
 * TODO: fold these strings back into `locales/fr.ts` / `locales/en.ts` once the
 * locale files are free of parallel claims; they are layered over `t.landing` so
 * the locale files stay untouched until then.
 */
export type HomeLandingCopy = LandingPageTranslations & {
  hero: LandingPageTranslations["hero"] & { runnerLabel: string; organizerLabel: string; organizerCta: string };
  faq: LandingPageTranslations["faq"] & { ctaEyebrow: string };
  proofStrip: { label: string; readers: string; opens: string; link: string };
  demo: LandingPageTranslations["demo"] & { gaugesLabel: string; gaugesNote: string };
};

const fr = {
  hero: {
    heading: "Les infos officielles de ta course et ton plan perso sur ce parcours",
    subheading:
      "Retrouve dans l’app le Livret coureur publié par l’organisation, puis prépare ton allure et ta nutrition sur le même tracé. Pour le trail, la route et toutes les courses à pied.",
    bullets: [
      "Livret coureur : parcours, horaires, ravitos, dossards et matériel publiés par l’organisation",
      "Livret supporter : programme et points de suivi pour tes proches, sans compte",
      "Plan perso : temps estimé et passages aux ravitos gratuits, plan nutrition adapté à ton parcours",
    ],
    heroImageAlt: "Aperçu du Livret coureur dans l’app mobile Pace Yourself.",
    runnerLabel: "Je suis coureur",
    organizerLabel: "Je suis organisateur",
    organizerCta: "Créer mon Livret coureur",
  },
  howItWorks: {
    title: "Comment ça marche",
    steps: [
      {
        title: "Retrouve le Livret coureur de ta course",
        description:
          "Quand l’organisation l’a publié, tu as parcours, horaires, ravitos, dossards et matériel réunis dans l’app, sur ton téléphone.",
      },
      {
        title: "Importe ou définis ton parcours",
        description:
          "Ajoute la distance, le D+ et ton allure, ou importe un GPX pour placer les ravitos automatiquement, puis fixe tes cibles de glucides, d’eau et de sodium.",
      },
      {
        title: "Débloque ton plan pour le jour J",
        description:
          "L’estimation reste gratuite. Le déblocage donne accès au plan nutrition complet et à son export imprimable.",
      },
    ],
  },
  demo: {
    gaugesLabel: "Exemple de cibles pour un 50K",
    gaugesNote: "Exemple illustratif, tes valeurs dépendent de ton allure, de ta nutrition et de ton parcours.",
  },
  faq: {
    subtitle: "Pensé pour les coureurs de trail, d’ultra et de route qui veulent un plan simple et fiable.",
    items: [
      {
        question: "Puis-je utiliser mes propres gels ou boisson énergétique ?",
        answer:
          "Oui. Ajoute tes produits dans Paramètres et le plan utilisera tes valeurs de glucides et sodium automatiquement.",
      },
      {
        question: "Est-ce que ça marche sans fichier GPX ?",
        answer:
          "Bien sûr. Indique la distance, le D+ et ton allure pour obtenir immédiatement les cibles par ravito.",
      },
      {
        question: "Comment gères-tu la chaleur et l’altitude ?",
        answer:
          "Ajuste la température et les cibles d’hydratation évoluent. Les entrées d’allure te permettent de modéliser les sections plus raides et lentes.",
      },
      {
        question: "Puis-je imprimer ou partager le plan ?",
        answer: "Oui. Après déblocage, exporte un plan propre et imprimable pour le jour J et partage-le avec ton assistance.",
      },
      {
        question: "Est-ce payant ?",
        answer:
          "L’estimation du temps et des passages aux ravitos est gratuite. Le plan complet et son export se débloquent à 9,99 € TTC la course, ou 29,99 € TTC par an pour toutes les courses. Les plans existants restent gratuits.",
      },
    ],
    ctaEyebrow: "Prêt à t’y mettre ?",
  },
  proofStrip: {
    label: "Utilisé en course",
    readers: "lecteurs uniques estimés",
    opens: "ouvertures du Livret",
    link: "Voir l’avis des organisateurs",
  },
};

const en = {
  hero: {
    heading: "Your race’s official info and your personal plan on this course",
    subheading:
      "Find the organizer’s Race Book in the app, then prepare your pacing and fueling on the same route. For trail, road and any running event.",
    bullets: [
      "Race Book: course, schedule, aid stations, bib pickup and gear published by the organizer",
      "Supporter Guide: schedule and cheering points for your supporters, no account needed",
      "Personal plan: free estimated time and aid-station passages, fueling plan adapted to your course",
    ],
    heroImageAlt: "Preview of the Race Book in the Pace Yourself mobile app.",
    runnerLabel: "I am a runner",
    organizerLabel: "I am an organizer",
    organizerCta: "Create my Race Book",
  },
  howItWorks: {
    title: "How it works",
    steps: [
      {
        title: "Find your race’s Race Book",
        description:
          "When the organizer has published it, course, schedule, aid stations, bib pickup and gear are together in the app on your phone.",
      },
      {
        title: "Import or set your course",
        description:
          "Add distance, elevation and pacing, or import a GPX to place aid stations automatically, then set your carb, water and sodium targets.",
      },
      {
        title: "Unlock your race-day plan",
        description: "The estimate stays free. Unlocking gives access to the full fueling plan and its printable export.",
      },
    ],
  },
  demo: {
    gaugesLabel: "Example targets for a 50K",
    gaugesNote: "Illustrative example, your values depend on your pace, nutrition and course.",
  },
  faq: {
    subtitle: "Built for trail, ultra and road runners who need a simple, accurate plan.",
    ctaEyebrow: "Ready to start?",
  },
  proofStrip: {
    label: "Used in races",
    readers: "estimated unique readers",
    opens: "Race Book opens",
    link: "See what organizers say",
  },
};

export function getHomeLandingCopy(locale: "fr" | "en", landing: LandingPageTranslations): HomeLandingCopy {
  const o = locale === "fr" ? fr : en;
  return {
    ...landing,
    hero: { ...landing.hero, ...o.hero } as HomeLandingCopy["hero"],
    howItWorks: { ...landing.howItWorks, ...o.howItWorks },
    demo: { ...landing.demo, ...o.demo },
    faq: { ...landing.faq, ...o.faq, ctaEyebrow: o.faq.ctaEyebrow } as HomeLandingCopy["faq"],
    proofStrip: o.proofStrip,
  };
}

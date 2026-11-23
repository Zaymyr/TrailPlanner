export type PremiumLocale = "fr" | "en";

export type PremiumCopy = {
  heroTitle: string;
  heroTitleRace: (name: string) => string;
  heroSub: string;
  courseTitle: string;
  courseTitleRace: (name: string) => string;
  annualTitle: string;
  courseTag: string;
  annualTag: string;
  courseBullets: string[];
  annualBullets: string[];
  courseCta: string;
  annualCta: string;
  anonymousCta: string;
  chooseRaceCta: string;
  chooseRaceHint: string;
  comparisonTitle: string;
  comparisonFree: string;
  comparisonPaid: string;
  comparisonRows: { label: string; free: string; paid: string }[];
  deliverablesTitle: string;
  deliverables: { title: string; text: string }[];
  reassurance: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  methodologyText: string;
  methodologyLink: string;
};

export const PREMIUM_COPY: Record<PremiumLocale, PremiumCopy> = {
  fr: {
    heroTitle: "Arrive au bout sans coup de barre",
    heroTitleRace: (name) => `Arrive au bout de ${name} sans coup de barre`,
    heroSub:
      "Ton temps estimé est gratuit, sans compte. Ce que tu achètes, c’est le plan : l’allure à tenir sur chaque section et ce que tu manges à chaque ravito.",
    courseTitle: "Cette course",
    courseTitleRace: (name) => `Cette course — ${name}`,
    annualTitle: "Toutes mes courses",
    courseTag: "Paiement unique, sans abonnement",
    annualTag: "Abonnement annuel renouvelable",
    courseBullets: [
      "Plan complet pour cette course uniquement",
      "Allures ajustables section par section",
      "Produits et quantités à chaque ravito",
      "Fiche à imprimer, fiche assistance, exports GPX et PDF",
    ],
    annualBullets: [
      "Toutes tes courses de l’année, sans limite",
      "Les mêmes outils que l’achat à la course",
      "Plan synchronisé sur web, Android et iOS",
      "Rentabilisé dès 3 courses dans l’année",
    ],
    courseCta: "Débloquer cette course",
    annualCta: "Passer à l’abonnement annuel",
    anonymousCta: "Créer mon compte et débloquer",
    chooseRaceCta: "Choisir ma course",
    chooseRaceHint: "Tu choisis ta course, puis tu reviens ici débloquer son plan.",
    comparisonTitle: "Gratuit ou plan complet",
    comparisonFree: "Gratuit",
    comparisonPaid: "Plan complet",
    comparisonRows: [
      { label: "Temps estimé et passages", free: "Oui, sans compte", paid: "Oui" },
      { label: "Aperçu du plan", free: "Départ + 1er ravito", paid: "Tous les ravitos" },
      { label: "Allures par section", free: "Non", paid: "Ajustables" },
      { label: "Produits et quantités", free: "Non", paid: "À chaque ravito" },
      { label: "Fiche à imprimer et fiche assistance", free: "Non", paid: "Oui" },
      { label: "Exports GPX et PDF", free: "Non", paid: "Oui" },
      { label: "Web, Android et iOS", free: "Non", paid: "Synchronisé" },
    ],
    deliverablesTitle: "Ce que tu reçois",
    deliverables: [
      { title: "La fiche ravitos à imprimer", text: "Une page : distance, heure de passage, produits et quantités pour chaque ravito. Tu la glisses dans ta poche ou ton gilet." },
      { title: "Le plan sur ton téléphone", text: "Ton plan est synchronisé sur web, Android et iOS. Tu le consultes pendant la course, tu l’ajustes avant." },
      { title: "La fiche pour ton assistance", text: "Une fiche pour tes supporters : où te retrouver, à quelle heure, et quoi te tendre à chaque point." },
    ],
    reassurance: [
      "Paiement sécurisé par Stripe",
      "Achat rattaché à ton compte : web, Android et iOS",
      "Tes plans préparés restent consultables",
    ],
    faqTitle: "Questions fréquentes",
    faq: [
      { q: "L’estimation est-elle vraiment gratuite ?", a: "Oui. Le temps estimé et les heures de passage sont gratuits et ne demandent pas de compte. Le plan détaillé est la partie payante." },
      { q: "Paiement unique ou abonnement ?", a: "Les deux existent. L’offre « cette course » est un paiement unique pour une course. L’offre annuelle couvre toutes tes courses et se renouvelle chaque année." },
      { q: "Que se passe-t-il si mon abonnement expire ?", a: "Tes plans préparés restent consultables. Pour les modifier, il faut un achat ou un réabonnement." },
      { q: "Où retrouver mon achat ?", a: "Il est rattaché à ton compte et accessible sur le web, Android et iOS." },
      { q: "Comment le plan est-il calculé ?", a: "À partir de ton objectif, du profil de la course et de règles de nutrition documentées. La méthode est publique, tu peux la lire en entier." },
    ],
    methodologyText: "Tu veux savoir d’où viennent les chiffres ?",
    methodologyLink: "Comment on calcule ton plan",
  },
  en: {
    heroTitle: "Reach the finish without hitting the wall",
    heroTitleRace: (name) => `Reach the finish of ${name} without hitting the wall`,
    heroSub:
      "Your estimated time is free, no account needed. What you buy is the plan: the pace to hold on each section and what you eat at each aid station.",
    courseTitle: "This race",
    courseTitleRace: (name) => `This race — ${name}`,
    annualTitle: "All my races",
    courseTag: "One-time payment, no subscription",
    annualTag: "Auto-renewing annual subscription",
    courseBullets: [
      "Full plan for this race only",
      "Adjustable pacing by section",
      "Products and quantities at each aid station",
      "Printable sheet, crew sheet, GPX and PDF exports",
    ],
    annualBullets: [
      "All your races of the year, no limit",
      "Same tools as the single-race purchase",
      "Plan synced on web, Android and iOS",
      "Pays for itself from 3 races in a year",
    ],
    courseCta: "Unlock this race",
    annualCta: "Choose annual access",
    anonymousCta: "Create my account and unlock",
    chooseRaceCta: "Choose my race",
    chooseRaceHint: "Pick your race, then come back here to unlock its plan.",
    comparisonTitle: "Free or full plan",
    comparisonFree: "Free",
    comparisonPaid: "Full plan",
    comparisonRows: [
      { label: "Estimated time and passage times", free: "Yes, no account", paid: "Yes" },
      { label: "Plan preview", free: "Start + 1st aid station", paid: "All aid stations" },
      { label: "Pacing by section", free: "No", paid: "Adjustable" },
      { label: "Products and quantities", free: "No", paid: "At each aid station" },
      { label: "Printable and crew sheets", free: "No", paid: "Yes" },
      { label: "GPX and PDF exports", free: "No", paid: "Yes" },
      { label: "Web, Android and iOS", free: "No", paid: "Synced" },
    ],
    deliverablesTitle: "What you get",
    deliverables: [
      { title: "A printable aid station sheet", text: "One page: distance, passage time, products and quantities for each aid station. Slip it in your pocket or vest." },
      { title: "The plan on your phone", text: "Your plan is synced on web, Android and iOS. Read it during the race, adjust it before." },
      { title: "A sheet for your crew", text: "A sheet for your supporters: where to meet you, at what time, and what to hand you at each point." },
    ],
    reassurance: [
      "Secure payment by Stripe",
      "Purchase tied to your account: web, Android and iOS",
      "Your prepared plans stay readable",
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "Is the estimate really free?", a: "Yes. The estimated time and passage times are free and need no account. The detailed plan is the paid part." },
      { q: "One-time payment or subscription?", a: "Both exist. The “this race” offer is a one-time payment for one race. The annual offer covers all your races and renews every year." },
      { q: "What happens when my subscription expires?", a: "Your prepared plans remain readable. Editing them requires a purchase or resubscription." },
      { q: "Where do I find my purchase?", a: "It belongs to your account and is available on web, Android and iOS." },
      { q: "How is the plan calculated?", a: "From your goal, the race profile and documented nutrition rules. The method is public and you can read it in full." },
    ],
    methodologyText: "Want to know where the numbers come from?",
    methodologyLink: "How we calculate your plan",
  },
};

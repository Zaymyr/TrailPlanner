export type BlogLevel = "beginner" | "intermediate" | "advanced";

export type BlogPostIndexEntry = {
  slug: string;
  title: string;
  topics: string[];
  level: BlogLevel;
  related?: string[];
  updatedAt?: string;
};

export const blogIndex: BlogPostIndexEntry[] = [
  {
    slug: "hydration-for-trail-running",
    title: "Hydratation en trail : des flasques plus intelligentes, des kilomètres plus maîtrisés",
    topics: ["hydration", "trail", "electrolytes", "heat"],
    level: "intermediate",
    related: ["soduim-heure", "ravitaillement-trail", "quelle-nutrition-pour-un-trail"],
    updatedAt: "2024-07-06T00:00:00.000Z",
  },
  {
    slug: "ravitaillement-trail",
    title: "Ravitaillement trail : planifier, tester et rester régulier",
    topics: ["ravitaillement", "nutrition", "trail"],
    level: "beginner",
    related: ["quelle-nutrition-pour-un-trail", "60g-par-heure", "quoi-manger-trail-50k"],
    updatedAt: "2024-07-03T00:00:00.000Z",
  },
  {
    slug: "60g-par-heure",
    title: "Le mythe des 60 g de glucides par heure en trail et ultra",
    topics: ["nutrition", "carbohydrates", "trail", "performance"],
    level: "advanced",
    related: ["probl-mes-digestifs-ultra", "quelle-nutrition-pour-un-trail", "soduim-heure"],
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    slug: "nutrition-hiver-trail",
    title: "Nutrition en hiver : faut-il surveiller son poids ou manger pour encaisser la charge ?",
    topics: ["nutrition", "winter", "training", "trail"],
    level: "intermediate",
  },
  {
    slug: "quelle-nutrition-pour-un-trail",
    title: "Quelle nutrition pour un trail ? Construire une stratégie qui tient la distance",
    topics: ["nutrition", "trail", "ultra-trail", "hydration"],
    level: "beginner",
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    slug: "soduim-heure",
    title: "Faut-il prendre des électrolytes en trail ? Combien de sodium par heure ?",
    topics: ["trail", "hydration", "electrolytes", "sodium"],
    level: "intermediate",
    related: ["hydration-for-trail-running", "60g-par-heure", "probl-mes-digestifs-ultra"],
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    slug: "probl-mes-digestifs-ultra",
    title: "Comment éviter les problèmes digestifs (nausées, diarrhée) en trail et ultra",
    topics: ["nutrition", "digestion", "trail", "ultra-trail"],
    level: "intermediate",
    related: ["60g-par-heure", "hydration-for-trail-running", "quoi-manger-trail-50k"],
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    slug: "quoi-manger-trail-50k",
    title: "Que manger et boire sur un trail de 30–50 km ? (exemple concret)",
    topics: ["nutrition", "hydration", "ravitaillement", "trail"],
    level: "intermediate",
    related: ["60g-par-heure", "ravitaillement-trail", "soduim-heure"],
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    slug: "estimer-temps-trail-dplus",
    title: "Comment estimer son temps en trail avec D+ (et éviter les plans irréalistes)",
    topics: ["trail", "pacing", "denivele", "nutrition", "hydration"],
    level: "beginner",
    related: ["quelle-nutrition-pour-un-trail", "60g-par-heure", "ravitaillement-trail"],
    updatedAt: "2026-02-22T00:00:00.000Z",
  },
  {
    slug: "trail-de-nuit-nutrition-cafeine-froid",
    title: "Trail de nuit : comment gérer nutrition, caféine et froid ?",
    topics: ["trail", "nutrition", "night-running", "caffeine", "sodium"],
    level: "advanced",
    related: ["quelle-nutrition-pour-un-trail", "soduim-heure", "probl-mes-digestifs-ultra"],
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    slug: "marathon-mont-blanc-preparation",
    title: "Marathon du Mont-Blanc : ce que j'ai appris en 9h12 de souffrance",
    topics: ["trail", "race", "preparation", "nutrition"],
    level: "intermediate",
    related: ["60g-par-heure", "soduim-heure", "ravitaillement-trail"],
    updatedAt: "2026-03-17T00:00:00.000Z",
  },
  {
    slug: "trail-des-templier",
    title: "Trail des Templiers : guide (vraiment utile) pour découvrir une course mythique, technique et chargée d’émotion",
    topics: ["trail", "race", "preparation", "nutrition"],
    level: "beginner",
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
];

const warnOnIndexIssues = (entries: BlogPostIndexEntry[]) => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const seen = new Map<string, number>();
  const slugs = new Set(entries.map((entry) => entry.slug));
  const duplicates: string[] = [];
  const missingRelated: string[] = [];

  entries.forEach((entry) => {
    const count = seen.get(entry.slug) ?? 0;
    if (count === 1) {
      duplicates.push(entry.slug);
    }
    seen.set(entry.slug, count + 1);

    entry.related?.forEach((relatedSlug) => {
      if (!slugs.has(relatedSlug)) {
        missingRelated.push(`${entry.slug} -> ${relatedSlug}`);
      }
    });
  });

  if (duplicates.length > 0) {
    console.warn(`[blogIndex] Duplicate slugs detected: ${duplicates.join(", ")}`);
  }

  if (missingRelated.length > 0) {
    console.warn(`[blogIndex] Related slugs missing from index: ${missingRelated.join(", ")}`);
  }
};

warnOnIndexIssues(blogIndex);

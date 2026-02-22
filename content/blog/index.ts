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
    slug: "trail-nutrition-planner",
    title: "Trail Nutrition Planner: How to Design Fueling That Actually Works",
    topics: ["nutrition", "fueling", "planning", "trail"],
    level: "beginner",
    related: ["ultra-trail-fueling-tips", "ravitaillement-trail"],
    updatedAt: "2024-07-02T00:00:00.000Z",
  },
  {
    slug: "hydration-for-trail-running",
    title: "Hydratation en trail : des flasques plus intelligentes, des kilomètres plus maîtrisés",
    topics: ["hydration", "trail", "electrolytes", "heat"],
    level: "intermediate",
    related: ["ravitaillement-trail", "trail-nutrition-planner"],
    updatedAt: "2024-07-06T00:00:00.000Z",
  },
  {
    slug: "ultra-trail-fueling-tips",
    title: "Ultra Trail Fueling Tips: Stay Ahead of the Bonk",
    topics: ["ultra", "fueling", "race-strategy", "trail"],
    level: "intermediate",
    related: ["trail-nutrition-planner", "60g-par-heure"],
    updatedAt: "2024-07-05T00:00:00.000Z",
  },
  {
    slug: "ravitaillement-trail",
    title: "Ravitaillement trail : planifier, tester et rester régulier",
    topics: ["ravitaillement", "nutrition", "trail"],
    level: "beginner",
    related: ["nutrition-hiver-trail", "60g-par-heure"],
    updatedAt: "2024-07-03T00:00:00.000Z",
  },
  {
    slug: "60g-par-heure",
    title: "Le mythe des 60 g de glucides par heure en trail et ultra",
    topics: ["nutrition", "carbohydrates", "trail", "performance"],
    level: "advanced",
    related: ["nutrition-hiver-trail", "quelle-nutrition-pour-un-trail"],
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
  },
  {
    slug: "sodium-par-heure",
    title: "Faut-il prendre des électrolytes en trail ? Combien de sodium par heure ?",
    topics: ["trail", "hydration", "electrolytes", "sodium"],
    level: "intermediate",
    related: ["hydration-for-trail-running", "quelle-nutrition-pour-un-trail"],
  },
  {
    slug: "problemes-digestifs-ultra",
    title: "Comment éviter les problèmes digestifs (nausées, diarrhée) en trail et ultra",
    topics: ["nutrition", "digestion", "trail", "ultra-trail"],
    level: "intermediate",
    related: ["quelle-nutrition-pour-un-trail", "sodium-par-heure"],
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
    related: ["quelle-nutrition-pour-un-trail", "sodium-par-heure", "problemes-digestifs-ultra"],
    updatedAt: "2026-02-10T00:00:00.000Z",
  },
  {
    slug: "trail-des-templier",
    title: "Trail des Templiers : guide (vraiment utile) pour découvrir une course mythique, technique et chargée d’émotion",
    topics: ["trail", "race", "preparation", "nutrition"],
    level: "beginner",
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

/**
 * Blog guides suggested on a public format page, chosen from the format distance.
 * Slugs must match apps/web/content/blog canonical slugs; unknown slugs are
 * dropped at render time, so a renamed article never produces a broken link.
 */
export const RELATED_ARTICLES_BY_DISTANCE = {
  short: ["quelle-nutrition-pour-un-trail", "sodium-par-heure"],
  medium: ["nutrition-trail-30-50-km", "60g-glucide-par-heure"],
  long: ["problemes-digestifs-ultra", "60g-glucide-par-heure"],
} as const;

const ALWAYS = ["estimer-temps-trail-dplus", "ravitaillement-trail"] as const;

export const getRelatedArticleSlugs = (distanceKm: number | null | undefined, max = 3): string[] => {
  const bucket = distanceKm == null || !Number.isFinite(distanceKm)
    ? RELATED_ARTICLES_BY_DISTANCE.short
    : distanceKm >= 80
      ? RELATED_ARTICLES_BY_DISTANCE.long
      : distanceKm >= 30
        ? RELATED_ARTICLES_BY_DISTANCE.medium
        : RELATED_ARTICLES_BY_DISTANCE.short;
  return [...new Set([ALWAYS[0], ...bucket, ALWAYS[1]])].slice(0, max);
};

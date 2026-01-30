/**
 * Blog slug redirect table (old -> canonical).
 *
 * | Old slug | Canonical slug | Redirect |
 * | --- | --- | --- |
 * | 60g-par-heure | 60g-glucide-par-heure | /blog/60g-par-heure → /blog/60g-glucide-par-heure |
 * | quoi-manger-trail-50k | nutrition-trail-30-50-km | /blog/quoi-manger-trail-50k → /blog/nutrition-trail-30-50-km |
 * | trail-des-templier | trail-des-templiers | /blog/trail-des-templier → /blog/trail-des-templiers |
 */
export const blogSlugRedirects = {
  "60g-par-heure": "60g-glucide-par-heure",
  "quoi-manger-trail-50k": "nutrition-trail-30-50-km",
  "trail-des-templier": "trail-des-templiers",
} as const;

export const getCanonicalBlogSlug = (slug: string): string =>
  blogSlugRedirects[slug as keyof typeof blogSlugRedirects] ?? slug;

export const buildBlogCanonicalPath = (slug: string): string => `/blog/${getCanonicalBlogSlug(slug)}`;

export const blogRedirectMap = Object.fromEntries(
  Object.entries(blogSlugRedirects).map(([oldSlug, canonicalSlug]) => [
    `/blog/${oldSlug}`,
    `/blog/${canonicalSlug}`,
  ]),
) as Record<string, string>;

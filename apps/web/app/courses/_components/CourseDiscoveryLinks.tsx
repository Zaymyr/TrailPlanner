import type { Route } from "next";
import Link from "next/link";

import { getPublicRaces } from "../../../lib/public-races";
import { buildLandingCrossLinks, getTodayInFrance } from "../../../lib/race-landing-pages";

type FeaturedLink = { href: string; label: string };

type CourseDiscoveryLinksProps = {
  title?: string;
  /** Extra links shown first, e.g. the event an article is about. */
  featured?: FeaturedLink[];
  /** Cap per group so the block stays compact on content pages. */
  maxPerGroup?: number;
};

/**
 * Server-rendered internal links to the indexable distance, region and month
 * landing pages (same selection rules as /courses: upcoming formats, five
 * minimum). Used on the home page and blog articles so crawlers reach the
 * catalogue from every content page.
 */
export async function CourseDiscoveryLinks({ title = "Trouver ta course", featured = [], maxPerGroup = 8 }: CourseDiscoveryLinksProps) {
  const races = await getPublicRaces().catch(() => []);
  const groups = buildLandingCrossLinks(races, getTodayInFrance())
    .map((group) => ({ ...group, links: group.links.slice(0, maxPerGroup) }))
    .filter((group) => group.links.length);

  if (!groups.length && !featured.length) return null;

  return (
    <nav aria-labelledby="course-discovery-heading" className="mx-auto w-full max-w-6xl space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 id="course-discovery-heading" className="text-lg font-semibold text-foreground">{title}</h2>
      {featured.length ? (
        <ul className="flex flex-wrap gap-2">
          {featured.map((link) => (
            <li key={link.href}>
              <Link href={link.href as Route} className="inline-flex min-h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.heading} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.heading}</h3>
            <ul className="flex flex-wrap gap-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href as Route}
                    className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm text-foreground transition hover:border-brand-border hover:bg-brand-surface"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link href={"/courses" as Route} className="inline-flex text-sm font-semibold text-brand hover:underline">
        Voir tout le calendrier des courses →
      </Link>
    </nav>
  );
}

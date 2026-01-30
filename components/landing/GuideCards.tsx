import Link from "next/link";

import type { LandingPageTranslations } from "../../locales/types";

type GuideCard = {
  slug: string;
  title: string;
  excerpt: string;
  canonicalPath: string;
};

type GuideCardsProps = {
  cardsHeading: LandingPageTranslations["cardsHeading"];
  cardCta: LandingPageTranslations["cardCta"];
  guides: GuideCard[];
};

export function GuideCards({ cardsHeading, cardCta, guides }: GuideCardsProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{cardsHeading}</h2>
        <Link
          href="/blog"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-[hsl(var(--brand))] hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] dark:text-emerald-100 dark:hover:border-emerald-300 dark:hover:text-emerald-50 dark:focus-visible:outline-emerald-300"
        >
          {cardCta}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={guide.canonicalPath}
            className="group relative flex h-full flex-col justify-between gap-4 rounded-2xl border border-border bg-card/70 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-card"
          >
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground dark:text-emerald-200">
                {guide.slug.replace(/-/g, " ")}
              </p>
              <p className="text-lg font-semibold text-foreground">{guide.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{guide.excerpt}</p>
            </div>
            <span className="text-sm font-semibold text-foreground underline underline-offset-4 transition group-hover:text-[hsl(var(--brand))] dark:text-emerald-200 dark:group-hover:text-emerald-100">
              {cardCta}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

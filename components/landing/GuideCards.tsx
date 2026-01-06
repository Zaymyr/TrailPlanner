import Link from "next/link";

import type { LandingPageTranslations } from "../../locales/types";

type GuideCardsProps = {
  cardsHeading: LandingPageTranslations["cardsHeading"];
  cardCta: LandingPageTranslations["cardCta"];
  cards: LandingPageTranslations["cards"];
};

export function GuideCards({ cardsHeading, cardCta, cards }: GuideCardsProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">{cardsHeading}</h2>
        <Link
          href="/race-planner"
          className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          {cardCta}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.slug}
            href={`/${card.slug}`}
            className="group relative flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-slate-900"
          >
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">{card.slug.replace(/-/g, " ")}</p>
              <p className="text-lg font-semibold text-slate-50">{card.title}</p>
              <p className="text-sm leading-relaxed text-slate-300">{card.description}</p>
            </div>
            <span className="text-sm font-semibold text-emerald-200 underline-offset-4 transition group-hover:underline">
              {cardCta}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

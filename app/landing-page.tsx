"use client";

import Link from "next/link";

import { useI18n } from "./i18n-provider";

export function LandingPage() {
  const { t } = useI18n();
  const cards = t.landing.cards;

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">TrailPlanner</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
              {t.landing.heading}
            </h1>
            <p className="text-base text-slate-300 sm:text-lg">{t.landing.subheading}</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href="/race-planner"
              className="inline-flex items-center justify-center rounded-md border border-emerald-300/60 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-300/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {t.landing.plannerCta}
            </Link>
            <p className="text-sm leading-relaxed text-slate-400 sm:max-w-2xl sm:text-base">
              {t.landing.plannerDescription}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">{t.landing.cardsHeading}</h2>
          <Link
            href="/race-planner"
            className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            {t.homeHero.cta}
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.slug}
              href={`/${card.slug}`}
              className="group relative flex h-full flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-slate-900"
            >
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.18em] text-emerald-200">{card.slug.replace(/-/g, " ")}</p>
                <p className="text-xl font-semibold text-slate-50">{card.title}</p>
                <p className="text-sm leading-relaxed text-slate-300">{card.description}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-200 underline-offset-4 transition group-hover:underline">
                {t.landing.cardCta}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

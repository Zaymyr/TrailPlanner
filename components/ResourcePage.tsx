"use client";

import Link from "next/link";

import type { ResourcePageSlug } from "../locales/types";
import { useI18n } from "../app/i18n-provider";

export function ResourcePage({ slug }: { slug: ResourcePageSlug }) {
  const { t } = useI18n();
  const copy = t.resourcePages[slug];
  const relatedPages = t.landing.cards.filter((card) => card.slug !== slug);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">TrailPlanner</p>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">{copy.title}</h1>
            <p className="text-base text-slate-300 sm:text-lg">{copy.intro}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">{copy.benefitsHeading}</h2>
            <ul className="grid list-disc gap-3 pl-5 sm:grid-cols-2 sm:gap-4">
              {copy.benefits.map((benefit) => (
                <li key={benefit} className="text-sm leading-relaxed text-slate-300">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/race-planner"
              className="inline-flex items-center justify-center rounded-md border border-emerald-300/70 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-300/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {copy.ctaLabel}
            </Link>
            <p className="text-sm leading-relaxed text-slate-400 sm:max-w-xl">{copy.ctaNote}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">{copy.relatedHeading}</h2>
          <Link
            href="/race-planner"
            className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            {copy.plannerLabel}
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {relatedPages.map((page) => (
            <Link
              key={page.slug}
              href={`/${page.slug}`}
              className="group flex h-full flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-slate-900"
            >
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.18em] text-emerald-200">{page.slug.replace(/-/g, " ")}</p>
                <p className="text-lg font-semibold text-slate-50">{page.title}</p>
                <p className="text-sm leading-relaxed text-slate-300">{page.description}</p>
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

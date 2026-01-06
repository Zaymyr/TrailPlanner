import Link from "next/link";

import type { LandingPageTranslations } from "../../locales/types";

type FaqSectionProps = {
  faq: LandingPageTranslations["faq"];
};

export function FaqSection({ faq }: FaqSectionProps) {
  return (
    <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">{faq.title}</p>
        <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">{faq.subtitle}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {faq.items.map((item) => (
          <div
            key={item.question}
            className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-300/60"
          >
            <h3 className="text-base font-semibold text-slate-50">{item.question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.answer}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">{faq.title}</p>
          <p className="text-lg font-semibold text-slate-50">{faq.cta}</p>
        </div>
        <Link
          href="/race-planner"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-[1px] hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {faq.cta}
        </Link>
      </div>
    </section>
  );
}

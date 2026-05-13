import Link from "next/link";

import type { LandingPageTranslations } from "../../locales/types";

type FaqSectionProps = {
  faq: LandingPageTranslations["faq"];
};

export function FaqSection({ faq }: FaqSectionProps) {
  return (
    <section className="space-y-6 rounded-3xl border border-border bg-card/70 p-6 sm:p-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">{faq.title}</p>
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{faq.subtitle}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {faq.items.map((item) => (
          <div
            key={item.question}
            className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-brand-border"
          >
            <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:flex-row sm:items-center sm:p-6 dark:border-emerald-400/30 dark:bg-emerald-400/5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">{faq.title}</p>
          <p className="text-lg font-semibold text-foreground">{faq.cta}</p>
        </div>
        <Link
          href="/race-planner"
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-lg shadow-[rgba(45,80,22,0.18)] transition hover:-translate-y-[1px] hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-emerald-400 dark:text-foreground dark:hover:bg-emerald-300 dark:focus-visible:outline-emerald-400"
        >
          {faq.cta}
        </Link>
      </div>
    </section>
  );
}

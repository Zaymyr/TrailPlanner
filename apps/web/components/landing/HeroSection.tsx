import Link from "next/link";
import type { SVGProps } from "react";

import { RaceBookPhoneMockup } from "./RaceBookPhoneMockup";
import type { HomeLandingCopy } from "./home-copy";

const IconArrowRight = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M5 12h14M13 6l6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M5 12.5 10 17l9-10"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={2} />
  </svg>
);

const IconPlay = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={2} />
    <path d="M10 8.5 16 12l-6 3.5z" fill="currentColor" />
  </svg>
);

type HeroSectionProps = {
  hero: HomeLandingCopy["hero"];
};

export function HeroSection({ hero }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card/90 to-muted p-4 shadow-[0_24px_70px_rgba(45,80,22,0.10)] sm:p-8 lg:p-12">
      <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-brand-surface/80 blur-3xl dark:bg-emerald-500/10" aria-hidden />
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative space-y-6">
          <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-foreground dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
            {hero.eyebrow}
          </div>
          <div className="space-y-3">
            <h1 className="text-[1.9rem] font-semibold leading-tight text-foreground sm:text-4xl lg:text-[2.6rem]">{hero.heading}</h1>
            <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-xl">{hero.subheading}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/race-planner"
              className="group inline-flex min-h-16 items-center justify-between gap-3 rounded-lg bg-brand px-5 py-3 text-brand-foreground shadow-lg shadow-[rgba(45,80,22,0.18)] transition hover:-translate-y-[1px] hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-emerald-400 dark:text-foreground dark:hover:bg-emerald-300 dark:focus-visible:outline-emerald-400"
            >
              <span className="flex flex-col">
                <span className="text-xs font-medium opacity-80">{hero.runnerLabel}</span>
                <span className="text-sm font-semibold">{hero.primaryCta}</span>
              </span>
              <IconArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/organisateurs"
              className="group inline-flex min-h-16 items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-surface px-5 py-3 text-brand transition hover:-translate-y-[1px] hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/15 dark:focus-visible:outline-emerald-300"
            >
              <span className="flex flex-col">
                <span className="text-xs font-medium opacity-80">{hero.organizerLabel}</span>
                <span className="text-sm font-semibold">{hero.organizerCta}</span>
              </span>
              <IconArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
          <Link
            href="#demo"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 transition hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:text-emerald-200"
          >
            <IconPlay className="h-4 w-4" />
            {hero.secondaryCta}
          </Link>
          <ul className="space-y-3 text-base text-muted-foreground">
            {hero.bullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <IconCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand dark:text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium text-muted-foreground dark:text-emerald-200">{hero.socialProof}</p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-brand-surface blur-3xl dark:bg-emerald-500/20" />
          <RaceBookPhoneMockup className="mx-auto w-full max-w-[240px] sm:max-w-[270px]" />
        </div>
      </div>
    </section>
  );
}

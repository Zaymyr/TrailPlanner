import Image from "next/image";
import Link from "next/link";
import type { SVGProps } from "react";

import type { LandingPageTranslations } from "../../locales/types";

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
  hero: LandingPageTranslations["hero"];
};

export function HeroSection({ hero }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 p-8 shadow-2xl sm:p-12">
      <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative space-y-6">
          <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            {hero.eyebrow}
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">{hero.heading}</h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-200 sm:text-xl">{hero.subheading}</p>
          </div>
          <ul className="space-y-3 text-base text-slate-200">
            {hero.bullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <IconCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium text-emerald-200">{hero.socialProof}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/race-planner"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-[1px] hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {hero.primaryCta}
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-300 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <IconPlay className="h-4 w-4" />
              {hero.secondaryCta}
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-2xl shadow-emerald-500/10">
            <Image
              src="/landing/hero.svg"
              alt={hero.heroImageAlt}
              width={1321}
              height={230}
              priority
              className="w-full rounded-xl object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

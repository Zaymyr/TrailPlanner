import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { SVGProps } from "react";

import type { LandingPageTranslations } from "../../locales/types";

const IconSparkles = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 16l.8 2.2L9 19l-2.2.8L6 22l-.8-2.2L3 19l2.2-.8L6 16Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type DemoSectionProps = {
  demo: LandingPageTranslations["demo"];
  heroImageAlt: string;
  secondaryImageAlt: string;
  ctaLabel: string;
};

export function DemoSection({ demo, heroImageAlt, secondaryImageAlt, ctaLabel }: DemoSectionProps) {
  const [primarySrc, setPrimarySrc] = useState("/landing/hero.png");
  const [secondarySrc, setSecondarySrc] = useState("/landing/secondary.png");

  return (
    <section id="demo" className="space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-[0_18px_45px_rgba(45,80,22,0.06)] sm:p-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-200">
            <IconSparkles className="h-4 w-4" />
            {demo.title}
          </p>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{demo.subtitle}</h2>
        </div>
        <Link
          href="/race-planner"
          className="inline-flex items-center justify-center rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-sm font-semibold text-brand transition hover:border-brand hover:text-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-emerald-300/60 dark:bg-transparent dark:text-emerald-100 dark:hover:border-emerald-200 dark:hover:text-emerald-50 dark:focus-visible:outline-emerald-300"
        >
          {ctaLabel}
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/70 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {demo.cards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border/60 bg-card p-4">
                <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-lg shadow-[rgba(45,80,22,0.08)]">
            <Image
              src={primarySrc}
              alt={heroImageAlt}
              width={858}
              height={172}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="h-auto w-full object-cover"
              onError={() => {
                if (primarySrc !== "/landing/hero.svg") {
                  setPrimarySrc("/landing/hero.svg");
                }
              }}
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-lg shadow-[rgba(45,80,22,0.08)]">
            <Image
              src={secondarySrc}
              alt={secondaryImageAlt}
              width={770}
              height={381}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="h-auto w-full object-cover"
              onError={() => {
                if (secondarySrc !== "/landing/secondary.svg") {
                  setSecondarySrc("/landing/secondary.svg");
                }
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

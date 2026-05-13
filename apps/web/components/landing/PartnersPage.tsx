"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type SVGProps } from "react";

import type { Locale, PartnersPageTranslations } from "../../locales/types";

type PartnersPageProps = {
  copy: PartnersPageTranslations;
  locale: Locale;
};

type IconProps = SVGProps<SVGSVGElement>;

const mailtoByLocale: Record<Locale, string> = {
  fr: "mailto:faustin@pace-yourself.com?subject=Référencement%20produits%20-%20%5BNom%20de%20votre%20marque%5D",
  en: "mailto:faustin@pace-yourself.com?subject=Product%20listing%20-%20%5BYour%20brand%20name%5D",
};

const IconArrowRight = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M5 12h14M13 6l6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);

const IconEye = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth={2} />
  </svg>
);

const IconShieldCheck = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <path
      d="m8.5 12.5 2.2 2.2 4.8-5.2"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);

const IconSettings = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <path
      d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h.1a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);

const IconCheck = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M5 12.5 10 17l9-10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={2} />
  </svg>
);

type ImagePlaceholderProps = {
  src: string;
  label: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

function ImagePlaceholder({ src, label, alt, width, height, className = "", priority }: ImagePlaceholderProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-2xl shadow-emerald-500/10 ${className}`}
    >
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_34%),linear-gradient(135deg,rgba(148,163,184,0.12),rgba(15,23,42,0.04))] p-6 text-center">
          <span className="rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm backdrop-blur">
            {label}
          </span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes="(min-width: 1024px) 520px, 100vw"
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

export function PartnersPage({ copy, locale }: PartnersPageProps) {
  const mailtoHref = mailtoByLocale[locale];
  const pillars = [
    {
      Icon: IconEye,
      title: copy.why.pillar1Title,
      description: copy.why.pillar1Description,
    },
    {
      Icon: IconShieldCheck,
      title: copy.why.pillar2Title,
      description: copy.why.pillar2Description,
    },
    {
      Icon: IconSettings,
      title: copy.why.pillar3Title,
      description: copy.why.pillar3Description,
    },
  ];
  const steps = [
    {
      title: copy.process.step1Title,
      description: copy.process.step1Description,
    },
    {
      title: copy.process.step2Title,
      description: copy.process.step2Description,
    },
    {
      title: copy.process.step3Title,
      description: copy.process.step3Description,
    },
  ];
  const faqItems = [
    {
      question: copy.faq.q1Question,
      answer: copy.faq.q1Answer,
    },
    {
      question: copy.faq.q2Question,
      answer: copy.faq.q2Answer,
    },
    {
      question: copy.faq.q3Question,
      answer: copy.faq.q3Answer,
    },
    {
      question: copy.faq.q4Question,
      answer: copy.faq.q4Answer,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card/80 to-background p-6 shadow-2xl sm:p-10 lg:p-12">
        <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="relative max-w-4xl space-y-6">
          <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-foreground dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
            Pace Yourself
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">{copy.hero.title}</h1>
            <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{copy.hero.subtitle}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={mailtoHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-foreground shadow-lg shadow-emerald-500/25 transition hover:-translate-y-[1px] hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {copy.hero.ctaPrimary}
              <IconArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-emerald-300 hover:text-[hsl(var(--success))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:hover:text-emerald-100"
            >
              {copy.hero.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card/50 p-6 shadow-inner sm:p-10">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.why.title}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {pillars.map(({ Icon, title, description }) => (
              <article
                key={title}
                className="h-full rounded-2xl border border-border/80 bg-card/60 p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-300/60"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-border bg-card/70 p-6 sm:p-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.appearance.title}</h2>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{copy.appearance.subtitle}</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ImagePlaceholder
            src="/landing/partners-product-detail.png"
            alt={copy.appearance.imageProductLabel}
            label={copy.appearance.imageProductLabel}
            width={800}
            height={600}
            className="aspect-[4/3]"
          />
          <ImagePlaceholder
            src="/landing/partners-aid-station.jpeg"
            alt={copy.appearance.imageAidStationLabel}
            label={copy.appearance.imageAidStationLabel}
            width={600}
            height={800}
            className="aspect-[3/4]"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card/50 p-6 shadow-inner sm:p-10">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.process.title}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-300/60"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card/70 p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.requirements.title}</h2>
          <div className="space-y-5">
            <ul className="grid gap-3 sm:grid-cols-2">
              {copy.requirements.items.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/60 p-4">
                  <IconCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm italic leading-relaxed text-muted-foreground">{copy.requirements.reassurance}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card/50 p-6 shadow-inner sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <ImagePlaceholder
            src="/landing/faustin-trail.jpeg"
            alt={copy.about.photoAlt}
            label={copy.about.photoAlt}
            width={600}
            height={800}
            className="aspect-[3/4]"
          />
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.about.title}</h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>{copy.about.paragraph1}</p>
              <p>{copy.about.paragraph2}</p>
              <p>{copy.about.paragraph3}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-border bg-card/70 p-6 sm:p-10">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.brands.title}</h2>
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 text-sm font-medium text-muted-foreground">
          {copy.brands.emptyState}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-border bg-card/40"
              aria-hidden
            >
              <span className="h-8 w-20 rounded-full bg-muted/50" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-border bg-card/70 p-6 sm:p-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">FAQ</p>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.faq.title}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-300/60"
            >
              <summary className="cursor-pointer list-none text-base font-semibold text-foreground marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span className="text-emerald-300 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/5 p-6 text-center shadow-2xl shadow-emerald-500/10 sm:p-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{copy.finalCta.title}</h2>
          <p className="text-base text-muted-foreground sm:text-lg">{copy.finalCta.subtitle}</p>
          <a
            href={mailtoHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 text-sm font-semibold text-foreground shadow-lg shadow-emerald-500/25 transition hover:-translate-y-[1px] hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            {copy.finalCta.button}
            <IconArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SITE_URL } from "../../app/seo";

export type LivretSection = { title: string; description: string };
export type LivretStep = { title: string; description: string };
export type LivretQuestion = { question: string; answer: string };

type LivretProductPageProps = {
  path: string;
  eyebrow: string;
  title: string;
  intro: string;
  actions: ReactNode;
  visual: { src: string; alt: string } | ReactNode;
  sectionsTitle: string;
  sections: LivretSection[];
  stepsTitle: string;
  steps: LivretStep[];
  questions: LivretQuestion[];
  crossLink: { href: string; label: string; description: string };
};

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand">
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
  </svg>
);

const isImageVisual = (visual: LivretProductPageProps["visual"]): visual is { src: string; alt: string } =>
  Boolean(visual && typeof visual === "object" && "src" in visual && "alt" in visual);

/**
 * Shared layout of the public product pages (/livret-coureur, /livret-supporter):
 * one clear promise, what the booklet contains, how to open it, a short FAQ and
 * the organizer path. Server-rendered so search engines index the full copy.
 */
export function LivretProductPage(props: LivretProductPageProps) {
  const url = new URL(props.path, SITE_URL).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: props.title,
        description: props.intro,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#app` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: props.eyebrow, item: url },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10 sm:space-y-14 lg:px-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="grid items-center gap-8 rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface via-card to-muted p-5 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10 dark:border-emerald-400/25 dark:from-emerald-400/10 dark:via-card dark:to-card">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-brand-border bg-card/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {props.eyebrow}
          </p>
          <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl">{props.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{props.intro}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{props.actions}</div>
        </div>
        <div className="mx-auto w-full max-w-[280px]">
          {isImageVisual(props.visual) ? (
            <div className="overflow-hidden rounded-[1.75rem] border-[6px] border-foreground bg-background shadow-2xl dark:border-emerald-950">
              <Image src={props.visual.src} alt={props.visual.alt} width={712} height={1600} priority sizes="280px" className="h-auto w-full" />
            </div>
          ) : (
            props.visual
          )}
        </div>
      </section>

      <section aria-labelledby="livret-sections-heading" className="space-y-5">
        <h2 id="livret-sections-heading" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{props.sectionsTitle}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {props.sections.map((section) => (
            <li key={section.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="flex gap-2 font-semibold text-foreground"><CheckIcon />{section.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{section.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="livret-steps-heading" className="space-y-5">
        <h2 id="livret-steps-heading" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{props.stepsTitle}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {props.steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
              <span className="font-mono text-sm font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="livret-faq-heading" className="space-y-4">
        <h2 id="livret-faq-heading" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Questions fréquentes</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {props.questions.map((item) => (
            <details key={item.question} className="group px-4 py-3 sm:px-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-foreground">
                {item.question}
                <span aria-hidden="true" className="text-brand transition group-open:rotate-45">+</span>
              </summary>
              <p className="pb-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-foreground p-6 text-background sm:flex-row sm:items-center sm:justify-between sm:p-8 dark:bg-emerald-950 dark:text-emerald-50">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-semibold sm:text-2xl">Vous organisez un trail ?</h2>
          <p className="text-sm leading-6 text-background/75 dark:text-emerald-100/80">
            Le Livret coureur et le Livret supporter sont publiés à partir des mêmes informations, dès 99 € HT par édition.
          </p>
        </div>
        <Link href={"/organisateurs" as Route} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light dark:bg-emerald-400 dark:text-slate-950">
          Créer mes livrets
        </Link>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link href={props.crossLink.href as Route} className="font-semibold text-brand hover:underline">{props.crossLink.label}</Link>
        {" — "}
        {props.crossLink.description}
      </p>
    </div>
  );
}

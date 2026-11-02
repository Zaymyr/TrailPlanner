"use client";

import Link from "next/link";

import { useI18n } from "./i18n-provider";

const primaryLinkClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const secondaryLinkClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-brand hover:border-brand-border hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function NotFoundContent() {
  const { t } = useI18n();
  const copy = t.notFound;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{copy.eyebrow}</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{copy.title}</h1>
      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">{copy.description}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link className={primaryLinkClass} href="/">{copy.home}</Link>
        <Link className={secondaryLinkClass} href="/race-planner">{copy.planner}</Link>
        <Link className={secondaryLinkClass} href="/courses">{copy.races}</Link>
        <Link className={secondaryLinkClass} href="/blog">{copy.blog}</Link>
      </div>
    </div>
  );
}

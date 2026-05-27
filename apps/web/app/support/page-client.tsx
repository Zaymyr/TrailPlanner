"use client";

import Link from "next/link";

import { useI18n } from "../i18n-provider";
import { supportCopy, supportEmail } from "./copy";

const linkClass =
  "rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand";

export function SupportClientPage() {
  const { locale } = useI18n();
  const copy = supportCopy[locale];
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent(copy.email.subject)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-4">
      <header className="max-w-2xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{copy.eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{copy.title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{copy.intro}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">{copy.email.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.email.body}</p>
          <a
            href={mailtoHref}
            className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90"
          >
            {supportEmail}
          </a>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">{copy.response.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.response.body}</p>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{copy.response.mobileFeedback}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">{copy.links.title}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/sign-in" className={linkClass}>
            {copy.links.signIn}
          </Link>
          <Link href="/legal/privacy" className={linkClass}>
            {copy.links.privacy}
          </Link>
          <Link href="/legal/cgu" className={linkClass}>
            {copy.links.terms}
          </Link>
          <Link href="/" className={linkClass}>
            {copy.links.home}
          </Link>
        </div>
      </section>
    </div>
  );
}

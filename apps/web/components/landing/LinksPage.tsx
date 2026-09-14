import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { LinksPageTranslations, Locale } from "../../locales/types";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.paceyourself.app";
const APP_STORE_URL = "https://apps.apple.com/app/id6772180071";
const CONTACT_URL = "mailto:faustin@pace-yourself.com";

const routeByLocale: Record<Locale, { blog: Route; organizers: Route; partners: Route }> = {
  en: {
    blog: "/blog",
    organizers: "/organisateurs",
    partners: "/en/partners",
  },
  fr: {
    blog: "/blog",
    organizers: "/organisateurs",
    partners: "/partenaires",
  },
};

type LinksPageProps = {
  copy: LinksPageTranslations;
  locale: Locale;
};

type LinkCardProps = {
  emoji: string;
  href: string;
  title: string;
  subtitle: string;
  external?: boolean;
};

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[hsl(var(--brand))]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function LinkCard({ emoji, href, title, subtitle, external = false }: LinkCardProps) {
  const content = (
    <>
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon />
    </>
  );

  const className =
    "group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm shadow-[rgba(45,80,22,0.05)] transition hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lg hover:shadow-[rgba(45,80,22,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))]";

  if (external || href.startsWith("mailto:")) {
    return (
      <a
        className={className}
        href={href}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={className} href={href as Route}>
      {content}
    </Link>
  );
}

export function LinksPage({ copy, locale }: LinksPageProps) {
  const routes = routeByLocale[locale];

  const cards: LinkCardProps[] = [
    {
      emoji: "📝",
      href: routes.blog,
      title: copy.cards.blog.title,
      subtitle: copy.cards.blog.subtitle,
    },
    {
      emoji: "🏁",
      href: routes.organizers,
      title: copy.cards.organizer.title,
      subtitle: copy.cards.organizer.subtitle,
    },
    {
      emoji: "🤝",
      href: routes.partners,
      title: copy.cards.partners.title,
      subtitle: copy.cards.partners.subtitle,
    },
    {
      emoji: "✉️",
      href: CONTACT_URL,
      title: copy.cards.contact.title,
      subtitle: copy.cards.contact.subtitle,
    },
  ];

  return (
    <main className="min-h-screen bg-[#FAFAF7] px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5">
        <header className="flex flex-col items-center gap-3 py-3 text-center">
          <Image
            src="/branding/logo-horizontal-v2.png"
            alt="Pace Yourself"
            width={220}
            height={52}
            priority
            unoptimized
            className="h-auto w-[180px] sm:w-[220px]"
          />
          <p className="text-sm text-muted-foreground">{copy.tagline}</p>
        </header>

        <section
          aria-labelledby="links-download-title"
          className="rounded-2xl bg-[hsl(var(--brand))] p-6 text-white shadow-xl shadow-[rgba(45,80,22,0.18)]"
        >
          <div className="space-y-3">
            <h1 id="links-download-title" className="text-2xl font-bold tracking-tight">
              {copy.download.title}
            </h1>
            <p className="text-sm leading-6 text-white/85">{copy.download.subtitle}</p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-[hsl(var(--brand))] transition hover:scale-[1.02] hover:bg-[hsl(var(--brand-surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              href={PLAY_STORE_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              {copy.download.googlePlayCta}
            </a>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-[hsl(var(--brand))] transition hover:scale-[1.02] hover:bg-[hsl(var(--brand-surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              href={APP_STORE_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              {copy.download.appStoreCta}
            </a>
          </div>
        </section>

        <nav aria-label="Pace Yourself links" className="flex flex-col gap-4">
          {cards.map((card) => (
            <LinkCard key={`${card.title}-${card.href}`} {...card} />
          ))}
        </nav>

        <footer className="pt-4 text-center text-xs text-foreground/60">
          <p>{copy.footer.copyright}</p>
          <p className="mt-1 text-[11px]">{copy.footer.madeBy}</p>
        </footer>
      </div>
    </main>
  );
}

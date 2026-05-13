import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { LinksPageTranslations, Locale } from "../../locales/types";

const TALLY_WAITLIST_URL = "https://tally.so/r/7R1AxL";
const INSTAGRAM_URL = "https://instagram.com/pace_your.self";
const CONTACT_URL = "mailto:faustin@pace-yourself.com";

const routeByLocale: Record<Locale, { blog: Route; home: Route; partners: Route }> = {
  en: {
    blog: "/blog",
    home: "/",
    partners: "/en/partners",
  },
  fr: {
    blog: "/blog",
    home: "/",
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
      emoji: "🏔️",
      href: routes.home,
      title: copy.cards.app.title,
      subtitle: copy.cards.app.subtitle,
    },
    {
      emoji: "🤝",
      href: routes.partners,
      title: copy.cards.partners.title,
      subtitle: copy.cards.partners.subtitle,
    },
    {
      emoji: "📸",
      href: INSTAGRAM_URL,
      title: copy.cards.instagram.title,
      subtitle: copy.cards.instagram.subtitle,
      external: true,
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
          aria-labelledby="links-waitlist-title"
          className="rounded-2xl bg-[hsl(var(--brand))] p-6 text-white shadow-xl shadow-[rgba(45,80,22,0.18)]"
        >
          <div className="space-y-3">
            <h1 id="links-waitlist-title" className="text-2xl font-bold tracking-tight">
              {copy.waitlist.title}
            </h1>
            <p className="text-sm leading-6 text-white/85">{copy.waitlist.subtitle}</p>
          </div>
          <Link
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-[hsl(var(--brand))] transition hover:scale-[1.02] hover:bg-[hsl(var(--brand-surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            href={TALLY_WAITLIST_URL as Route}
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.waitlist.cta}
          </Link>
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

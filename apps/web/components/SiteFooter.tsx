"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

export function SiteFooter() {
  const pathname = usePathname();
  const isEnglishPath = pathname === "/en/partners" || pathname.startsWith("/en/");
  const partnersHref = (isEnglishPath ? "/en/partners" : "/partenaires") as Route;
  const partnersLabel = isEnglishPath ? "For brands" : "Espace marques";

  return (
    <footer className="border-t border-border pt-4 text-xs text-muted-foreground sm:pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pace Yourself</p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            className="transition hover:text-[hsl(var(--success))] dark:hover:text-emerald-200"
            href="/legal/mentions-legales"
          >
            Mentions légales
          </Link>
          <Link className="transition hover:text-[hsl(var(--success))] dark:hover:text-emerald-200" href="/legal/cgu">
            CGU
          </Link>
          <Link className="transition hover:text-[hsl(var(--success))] dark:hover:text-emerald-200" href="/legal/cgv">
            CGV
          </Link>
          <Link
            className="transition hover:text-[hsl(var(--success))] dark:hover:text-emerald-200"
            href="/legal/privacy"
          >
            Confidentialité
          </Link>
          <Link className="transition hover:text-[hsl(var(--success))] dark:hover:text-emerald-200" href={partnersHref}>
            {partnersLabel}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

import Link from "next/link";

export function SiteFooter() {
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
        </nav>
      </div>
    </footer>
  );
}

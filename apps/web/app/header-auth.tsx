"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useI18n } from "./i18n-provider";
import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "../components/ThemeToggle";

export function HeaderAuth() {
  const { t } = useI18n();
  const { session, isLoading, clearSession } = useVerifiedSession();
  const router = useRouter();
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  const handleSignOut = () => {
    clearSession();
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      router.refresh();
    }
  };

  if (isLoading) {
    return <div className="h-10 min-w-[200px]" aria-busy="true" />;
  }

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-lg border border-border px-3 text-sm font-medium text-[hsl(var(--success))] transition hover:border-[hsl(var(--brand))] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-emerald-300/40 dark:text-emerald-100">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-surface">●</span>
        {t.navigation.account}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 space-y-2 rounded-lg border border-border-strong bg-card p-3 shadow-xl">
        <div className="grid grid-cols-1 gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        {session ? (
          <nav className="grid gap-1 border-t border-border pt-2" aria-label={t.navigation.account}>
            <Link className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted" href="/profile">{t.navigation.profile}</Link>
            <Link className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted" href="/settings">{t.navigation.settings}</Link>
            {isAdmin ? <Link className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted" href="/admin">{t.navigation.admin}</Link> : null}
            <button type="button" onClick={handleSignOut} className="min-h-11 rounded-md px-3 text-left text-sm font-semibold hover:bg-muted">
              {t.racePlanner.account.auth.signOut}
            </button>
          </nav>
        ) : (
          <Link href="/sign-in" className="flex min-h-11 items-center justify-center rounded-md bg-brand px-3 text-sm font-semibold text-brand-foreground">
            {t.racePlanner.account.auth.signIn}
          </Link>
        )}
      </div>
    </details>
  );
}

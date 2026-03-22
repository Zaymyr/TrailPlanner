"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useI18n } from "./i18n-provider";
import { useVerifiedSession } from "./hooks/useVerifiedSession";

export function HeaderAuth() {
  const { t } = useI18n();
  const { session, isLoading, clearSession } = useVerifiedSession();
  const router = useRouter();

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

  if (session) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-[hsl(var(--success))] transition hover:border-[hsl(var(--brand))] hover:text-foreground dark:border-emerald-300/40 dark:text-emerald-100 dark:hover:border-emerald-200 dark:hover:text-emerald-50"
      >
        {t.racePlanner.account.auth.signOut}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/sign-in"
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-[hsl(var(--success))] transition hover:border-[hsl(var(--brand))] hover:text-foreground dark:border-emerald-300/40 dark:text-emerald-100 dark:hover:border-emerald-200 dark:hover:text-emerald-50"
      >
        {t.racePlanner.account.auth.signIn}
      </Link>
    </div>
  );
}

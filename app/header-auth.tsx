"use client";

import Link from "next/link";

import { useI18n } from "./i18n-provider";
import { useVerifiedSession } from "./hooks/useVerifiedSession";

export function HeaderAuth() {
  const { t } = useI18n();
  const { session, isLoading } = useVerifiedSession();

  if (isLoading) {
    return <div className="h-10 min-w-[200px]" aria-busy="true" />;
  }

  if (session) {
    const signedInLabel = t.racePlanner.account.auth.signedInAs.replace(
      "{email}",
      session.email ?? t.racePlanner.account.auth.status
    );

    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-sm font-medium text-emerald-100">
          {signedInLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/sign-in"
        className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-sm font-medium text-emerald-100 transition hover:border-emerald-200 hover:text-emerald-50"
      >
        {t.racePlanner.account.auth.signIn}
      </Link>
      <Link
        href="/sign-up"
        className="rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-300"
      >
        {t.racePlanner.account.auth.create}
      </Link>
    </div>
  );
}

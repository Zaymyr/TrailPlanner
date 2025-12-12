"use client";

import Link from "next/link";

import { useI18n } from "./i18n-provider";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-slate-100 shadow-lg shadow-emerald-500/5">
      <h2 className="text-xl font-semibold">{t.homeHero.heading}</h2>
      <p className="text-sm text-slate-300">{t.homeHero.description}</p>
      <Link
        className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        href="/race-planner"
      >
        {t.homeHero.cta}
      </Link>
    </div>
  );
}

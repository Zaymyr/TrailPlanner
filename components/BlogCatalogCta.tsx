"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BlogCatalogCtaProps = {
  catalogRaceId?: string;
  locale?: "fr" | "en";
};

const copy = {
  fr: {
    label: "Créer mon plan",
    sub: "Marathon du Mont-Blanc pré-chargé",
  },
  en: {
    label: "Build my race plan",
    sub: "Race pre-loaded",
  },
};

export function BlogCatalogCta({ catalogRaceId, locale = "en" }: BlogCatalogCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const href = catalogRaceId
    ? `/race-planner?catalogRaceId=${catalogRaceId}`
    : "/race-planner";

  const t = copy[locale];

  return (
    <div
      aria-hidden={!visible}
      className={[
        "fixed bottom-6 right-6 z-50 transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      ].join(" ")}
    >
      <Link
        href={href as `/race-planner${string}`}
        className="flex flex-col items-center gap-0.5 rounded-2xl border border-emerald-400/70 bg-emerald-500 px-5 py-3 text-center shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      >
        <span className="text-sm font-semibold text-white dark:text-slate-900">{t.label}</span>
        {catalogRaceId && (
          <span className="text-[11px] font-normal text-emerald-100 dark:text-emerald-900/80">{t.sub}</span>
        )}
      </Link>
    </div>
  );
}

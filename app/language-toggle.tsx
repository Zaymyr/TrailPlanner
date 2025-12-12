"use client";

import { useI18n } from "./i18n-provider";

export function LanguageToggle() {
  const { locale, toggleLocale } = useI18n();
  const isFrench = locale === "fr";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-pressed={isFrench}
      aria-label={isFrench ? "Switch to English" : "Passer en français"}
      className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-50 shadow-sm transition hover:border-emerald-300 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
    >
      <span className="text-xs uppercase tracking-[0.12em] text-slate-300">Lang</span>
      <span className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-emerald-200">
        {isFrench ? "FR" : "EN"}
      </span>
    </button>
  );
}

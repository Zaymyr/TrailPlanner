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
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-[hsl(var(--brand))] hover:text-[hsl(var(--brand))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] dark:hover:border-emerald-300 dark:hover:text-emerald-200 dark:focus-visible:outline-emerald-400"
    >
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Lang</span>
      <span className="rounded bg-background px-2 py-1 text-xs font-semibold text-[hsl(var(--success))] dark:text-emerald-200">
        {isFrench ? "FR" : "EN"}
      </span>
    </button>
  );
}

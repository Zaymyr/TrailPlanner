"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { useI18n } from "./i18n-provider";

const baseButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] dark:focus-visible:outline-emerald-300";
const outlineClass =
  "border border-border text-[hsl(var(--success))] hover:bg-muted hover:text-foreground dark:border-emerald-300 dark:text-emerald-100 dark:hover:bg-emerald-950/60";
const activeClass =
  "bg-[hsl(var(--brand))] text-[hsl(var(--brand-foreground))] hover:bg-[hsl(var(--brand)/0.9)] dark:bg-emerald-500 dark:text-foreground dark:hover:bg-emerald-400";

export function HeaderNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { session } = useVerifiedSession();

  const isSettingsActive = pathname === "/settings";
  const isAdminActive = pathname === "/admin";
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/settings"
        className={`${baseButtonClass} ${isSettingsActive ? activeClass : outlineClass}`}
      >
        {t.navigation.settings}
      </Link>
      {isAdmin ? (
        <Link
          href="/admin"
          className={`${baseButtonClass} ${isAdminActive ? activeClass : outlineClass}`}
        >
          {t.navigation.admin}
        </Link>
      ) : null}
    </div>
  );
}

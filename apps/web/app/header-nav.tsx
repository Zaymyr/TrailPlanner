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
  "border border-blue-600 bg-blue-50 text-blue-900 shadow-sm hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-50 dark:hover:bg-blue-900/40";

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function HeaderNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { session } = useVerifiedSession();

  const isSettingsActive = isActivePath(pathname, "/settings");
  const isAdminActive = isActivePath(pathname, "/admin");
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/settings"
        aria-current={isSettingsActive ? "page" : undefined}
        className={`${baseButtonClass} ${isSettingsActive ? activeClass : outlineClass}`}
      >
        {t.navigation.settings}
      </Link>
      {isAdmin ? (
        <Link
          href="/admin"
          aria-current={isAdminActive ? "page" : undefined}
          className={`${baseButtonClass} ${isAdminActive ? activeClass : outlineClass}`}
        >
          {t.navigation.admin}
        </Link>
      ) : null}
    </div>
  );
}

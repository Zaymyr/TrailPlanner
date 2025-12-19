"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { useI18n } from "./i18n-provider";

const baseButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300";
const outlineClass = "border border-emerald-300 text-emerald-100 hover:bg-emerald-950/60";
const activeClass = "bg-emerald-500 text-slate-950 hover:bg-emerald-400";

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

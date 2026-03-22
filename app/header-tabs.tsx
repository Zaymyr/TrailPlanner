"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { Route } from "next";

import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { useI18n } from "./i18n-provider";

type TabItem = {
  label: string;
  href: Route;
  active: boolean;
};

export function HeaderTabs() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { session } = useVerifiedSession();

  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");
  const isCoach = session?.role === "coach" || session?.roles?.includes("coach");

  const tabItems: TabItem[] = useMemo(
    () => [
      {
        label: t.navigation.racePlanner,
        href: "/race-planner",
        active: pathname === "/race-planner",
      },
      {
        label: t.navigation.coach,
        href: "/coach",
        active: pathname === "/coach",
      },
      {
        label: t.navigation.blog,
        href: "/blog",
        active: pathname.startsWith("/blog"),
      },
      {
        label: t.navigation.settings,
        href: "/settings",
        active: pathname === "/settings",
      },
      {
        label: t.navigation.profile,
        href: "/profile",
        active: pathname === "/profile",
      },
      {
        label: t.navigation.admin,
        href: "/admin",
        active: pathname === "/admin",
      },
    ],
    [
      pathname,
      t.navigation.admin,
      t.navigation.blog,
      t.navigation.coach,
      t.navigation.profile,
      t.navigation.racePlanner,
      t.navigation.settings,
    ]
  );

  const visibleTabs = tabItems.filter((item) => {
    if (item.href === "/admin") return isAdmin;
    if (item.href === "/coach") return isCoach;
    return true;
  });

  const isPremiumActive = pathname === "/premium";

  return (
    <nav aria-label={t.navigation.menuLabel} className="flex items-center gap-1">
      {visibleTabs.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? "bg-muted text-foreground dark:bg-emerald-500/20 dark:text-emerald-50"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:text-emerald-100 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-50"
          }`}
        >
          {item.label}
        </Link>
      ))}
      <Link
        href="/premium"
        className={`premium-glow rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
          isPremiumActive
            ? "border-amber-400/80 bg-amber-400/90 text-slate-950 dark:border-amber-300/60 dark:bg-amber-400/80"
            : "border-amber-300/50 bg-amber-400/80 text-slate-950 hover:bg-amber-400 dark:border-amber-300/40 dark:bg-amber-400/70 dark:hover:bg-amber-400/90"
        }`}
      >
        ✦ {t.navigation.premium}
      </Link>
    </nav>
  );
}

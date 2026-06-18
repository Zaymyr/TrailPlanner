"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { Route } from "next";

import { useOrganizerMembershipStatus } from "./hooks/useOrganizerMembershipStatus";
import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { useI18n } from "./i18n-provider";

type TabItem = {
  label: string;
  href: Route;
  active: boolean;
};

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function HeaderTabs() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { session } = useVerifiedSession();
  const { hasManagedRaces } = useOrganizerMembershipStatus(session?.accessToken);

  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");
  const isCoach = session?.role === "coach" || session?.roles?.includes("coach");
  const organizerLabel = locale === "fr" ? "Mes courses" : "My races";

  const tabItems: TabItem[] = useMemo(
    () => [
      {
        label: t.navigation.racePlanner,
        href: "/race-planner",
        active: isActivePath(pathname, "/race-planner"),
      },
      {
        label: organizerLabel,
        href: "/organizer",
        active: isActivePath(pathname, "/organizer"),
      },
      {
        label: t.navigation.coach,
        href: "/coach",
        active: isActivePath(pathname, "/coach"),
      },
      {
        label: t.navigation.blog,
        href: "/blog",
        active: pathname.startsWith("/blog"),
      },
      {
        label: t.navigation.settings,
        href: "/settings",
        active: isActivePath(pathname, "/settings"),
      },
      {
        label: t.navigation.profile,
        href: "/profile",
        active: isActivePath(pathname, "/profile"),
      },
      {
        label: t.navigation.admin,
        href: "/admin",
        active: isActivePath(pathname, "/admin"),
      },
    ],
    [
      organizerLabel,
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
    if (item.href === "/organizer") return hasManagedRaces;
    return true;
  });

  const isPremiumActive = pathname === "/premium";

  return (
    <nav aria-label={t.navigation.menuLabel} className="flex items-center gap-1">
      {visibleTabs.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? "border-brand-border bg-brand-surface text-brand shadow-sm dark:border-emerald-400/70 dark:bg-emerald-950/40 dark:text-emerald-50"
              : "border-transparent text-muted-foreground hover:bg-brand-surface/60 hover:text-brand dark:text-emerald-100 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-50"
          }`}
        >
          {item.label}
        </Link>
      ))}
      <Link
        href="/premium"
        aria-current={isPremiumActive ? "page" : undefined}
        className={`premium-glow rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
          isPremiumActive
            ? "border-amber-300/80 bg-amber-300/90 text-foreground shadow-sm dark:border-amber-300/60 dark:bg-amber-400/80 dark:text-slate-950"
            : "border-amber-200/70 bg-amber-300/75 text-foreground hover:bg-amber-300/90 dark:border-amber-300/40 dark:bg-amber-400/70 dark:text-slate-950 dark:hover:bg-amber-400/90"
        }`}
      >
        ✦ {t.navigation.premium}
      </Link>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const { session, clearSession } = useVerifiedSession();
  const router = useRouter();

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

  const handleSignOut = () => {
    clearSession();
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      router.refresh();
    }
  };

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
      {session ? (
        <button
          type="button"
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground dark:text-emerald-100 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-50"
          onClick={handleSignOut}
        >
          {t.racePlanner.account.auth.signOut}
        </button>
      ) : null}
    </nav>
  );
}

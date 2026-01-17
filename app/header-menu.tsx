"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";

import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { useI18n } from "./i18n-provider";

type MenuItem = {
  label: string;
  href: Route;
  active: boolean;
};

const buttonBaseClass =
  "flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-[hsl(var(--icon))] shadow-sm transition hover:border-[hsl(var(--brand))] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:text-emerald-50";

export function HeaderMenu() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { session, clearSession } = useVerifiedSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        label: t.navigation.racePlanner,
        href: "/race-planner",
        active: pathname === "/race-planner",
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
    [pathname, t.navigation.admin, t.navigation.blog, t.navigation.profile, t.navigation.racePlanner, t.navigation.settings]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleSignOut = () => {
    clearSession();
    setIsOpen(false);
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      router.refresh();
    }
  };

  const visibleMenuItems = menuItems.filter((item) => item.href !== "/admin" || isAdmin);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={buttonBaseClass}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t.navigation.menuLabel}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 z-20 mt-2 w-56 rounded-lg border border-border-strong bg-card/95 p-2 shadow-xl dark:bg-card/60 dark:backdrop-blur">
          <nav aria-label={t.navigation.menuLabel} className="space-y-1">
            {visibleMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition hover:bg-muted hover:text-foreground dark:hover:bg-emerald-500/15 dark:hover:text-emerald-50 ${
                  item.active
                    ? "bg-muted text-foreground dark:bg-emerald-500/20 dark:text-emerald-50"
                    : "text-muted-foreground dark:text-emerald-100"
                }`}
              >
                {item.label}
                {item.active ? <span className="text-[11px] uppercase tracking-wide">●</span> : null}
              </Link>
            ))}
            {session ? (
              <button
                type="button"
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-[hsl(var(--brand))] hover:bg-muted dark:text-emerald-50 dark:hover:bg-emerald-500/10"
                onClick={handleSignOut}
              >
                {t.racePlanner.account.auth.signOut}
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" d="M4.5 7.5h15" />
      <path strokeLinecap="round" d="M4.5 12h15" />
      <path strokeLinecap="round" d="M4.5 16.5h15" />
    </svg>
  );
}

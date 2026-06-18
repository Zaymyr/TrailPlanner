"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";

import { useOrganizerMembershipStatus } from "./hooks/useOrganizerMembershipStatus";
import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { useI18n } from "./i18n-provider";
import { applyTheme, getInitialTheme, type Theme } from "../lib/theme";

type MenuItem = {
  label: string;
  href: Route;
  active: boolean;
};

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const buttonBaseClass =
  "flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-[hsl(var(--icon))] shadow-sm transition hover:border-[hsl(var(--brand))] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:text-emerald-50";
const menuActionClass =
  "flex min-h-10 items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-sm font-medium text-foreground transition hover:border-[hsl(var(--brand))] hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-emerald-50 dark:hover:bg-emerald-500/10";

export function HeaderMenu() {
  const { locale, t, toggleLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { session, clearSession } = useVerifiedSession();
  const { hasManagedRaces } = useOrganizerMembershipStatus(session?.accessToken);
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");
  const organizerLabel = locale === "fr" ? "Mes courses" : "My races";

  const menuItems: MenuItem[] = useMemo(
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
      t.navigation.profile,
      t.navigation.racePlanner,
      t.navigation.settings,
    ]
  );

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.href === "/admin") {
      return isAdmin;
    }
    if (item.href === "/organizer") {
      return hasManagedRaces;
    }
    return true;
  });

  useEffect(() => {
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);
    setTheme(initialTheme);
  }, []);

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

  const handleThemeToggle = () => {
    const updatedTheme = theme === "dark" ? "light" : "dark";
    applyTheme(updatedTheme);
    window.localStorage.setItem("theme", updatedTheme);
    setTheme(updatedTheme);
  };

  const nextTheme = theme === "dark" ? "light" : "dark";

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
        <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border-strong bg-card/95 p-2 shadow-xl dark:bg-card/60 dark:backdrop-blur">
          <div className="mb-2 grid grid-cols-2 gap-2 border-b border-border pb-2">
            <button
              type="button"
              className={menuActionClass}
              aria-label={locale === "fr" ? "Passer en anglais" : "Switch to French"}
              onClick={toggleLocale}
            >
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Lang</span>
              <span className="rounded bg-background px-2 py-1 text-xs font-semibold text-[hsl(var(--success))] dark:text-emerald-200">
                {locale.toUpperCase()}
              </span>
            </button>
            <button
              type="button"
              className={menuActionClass}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={handleThemeToggle}
            >
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Theme</span>
              <span className="rounded bg-background px-2 py-1 text-xs font-semibold text-[hsl(var(--success))] dark:text-emerald-200">
                {nextTheme}
              </span>
            </button>
          </div>
          <nav aria-label={t.navigation.menuLabel} className="space-y-1">
            {visibleMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition hover:bg-muted hover:text-foreground dark:hover:bg-emerald-500/15 dark:hover:text-emerald-50 ${
                  item.active
                    ? "border-brand-border bg-brand-surface text-brand shadow-sm dark:border-emerald-400/70 dark:bg-emerald-950/40 dark:text-emerald-50"
                    : "border-transparent text-muted-foreground dark:text-emerald-100"
                }`}
              >
                {item.label}
                {item.active ? <span className="text-[11px] uppercase tracking-wide">●</span> : null}
              </Link>
            ))}
            <Link
              href="/premium"
              aria-current={pathname === "/premium" ? "page" : undefined}
              className={`premium-glow flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold transition ${
                pathname === "/premium"
                  ? "border-amber-300/80 bg-amber-300/90 text-foreground"
                  : "border-amber-200/70 bg-amber-300/75 text-foreground hover:bg-amber-300/90"
              }`}
            >
              ✦ {t.navigation.premium}
              {pathname === "/premium" ? <span className="text-[11px] uppercase tracking-wide">●</span> : null}
            </Link>
            {session ? (
              <button
                type="button"
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-[hsl(var(--brand))] hover:bg-muted dark:text-emerald-50 dark:hover:bg-emerald-500/10"
                onClick={handleSignOut}
              >
                {t.racePlanner.account.auth.signOut}
              </button>
            ) : (
              <Link
                href="/sign-in"
                className="mt-1 flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-[hsl(var(--brand))] hover:bg-muted dark:text-emerald-50 dark:hover:bg-emerald-500/10"
              >
                {t.racePlanner.account.auth.signIn}
              </Link>
            )}
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

"use client";

import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "../../../../components/ui/button";
import { useCommandPaletteShortcut } from "../../../../components/ui/CommandPalette";
import { Drawer } from "../../../../components/ui/Drawer";
import { ToastProvider } from "../../../../components/ui/Toast";
import { cn } from "../../../../components/utils";
import { useVerifiedSession } from "../../../hooks/useVerifiedSession";
import { breadcrumbFor } from "../../admin-routes";
import { inboxTotals, useInboxCounts } from "../useInboxCounts";
import { AdminAccessProvider } from "./AdminAccess";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { AdminSidebar } from "./AdminSidebar";
import { RUNNER_MODE_LABELS, useAdminModes } from "./useAdminModes";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-admin-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-admin-mono", display: "swap" });

function ModePill({ href, children, label }: { href: string; children: ReactNode; label: string }) {
  return (
    <Link
      href={href as Route}
      title={label}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#fef1e6] px-2.5 py-1 text-xs font-semibold text-[#a54d0f] hover:bg-[#fde3cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-orange-950/60 dark:text-orange-100"
    >
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#f0873a]" />
      <span className="sr-only">{label} : </span>
      {children}
    </Link>
  );
}

function AccessMessage({ children }: { children: ReactNode }) {
  return <div className="mx-auto mt-10 flex max-w-xl flex-col gap-4 rounded-[14px] border border-border bg-card p-6 shadow-sm">{children}</div>;
}

/**
 * Admin console frame for every `/admin/*` page: sidebar (drawer below `lg`), top bar (breadcrumb, ⌘K,
 * test modes, « À traiter » bell), toasts, and the verified admin token for the pages. The server
 * layout has already rejected non-admin cookies; this repeats the check on the client session.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const { session, isLoading } = useVerifiedSession();
  const isAdmin = Boolean(session && (session.role === "admin" || session.roles?.includes("admin")));
  const accessToken = isAdmin ? session?.accessToken ?? null : null;
  const counts = inboxTotals(useInboxCounts(accessToken).data);
  const modes = useAdminModes(accessToken);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const crumbs = breadcrumbFor(pathname);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.platform || window.navigator.userAgent));
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);
  const openPalette = useCallback(() => {
    if (accessToken) setPaletteOpen(true);
  }, [accessToken]);
  useCommandPaletteShortcut(openPalette);

  const shortcut = isMac ? "⌘K" : "Ctrl K";
  const sidebarCounts = { inbox: counts.total, organizers: counts.organizers };

  let content: ReactNode = children;
  if (isLoading) {
    content = (
      <AccessMessage>
        <h1 className="text-xl font-semibold">Administration</h1>
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </AccessMessage>
    );
  } else if (!session) {
    content = (
      <AccessMessage>
        <h1 className="text-xl font-semibold">Administration</h1>
        <p className="text-sm text-muted-foreground">Connecte-toi avec un compte administrateur pour accéder à la console.</p>
        <div>
          <Link href="/sign-in">
            <Button>Se connecter</Button>
          </Link>
        </div>
      </AccessMessage>
    );
  } else if (!isAdmin || !accessToken) {
    content = (
      <AccessMessage>
        <h1 className="text-xl font-semibold">Administration</h1>
        <p className="text-sm text-amber-700 dark:text-amber-200">Accès réservé aux administrateurs.</p>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Retour au site
        </Link>
      </AccessMessage>
    );
  }

  return (
    <ToastProvider>
      <div className={cn(sans.variable, mono.variable, "admin-console min-h-screen bg-[#f4f2ec] text-[#1c2113] dark:bg-background dark:text-foreground lg:grid lg:grid-cols-[248px_minmax(0,1fr)]")}>
        <a
          href="#admin-main"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-brand px-4 py-3 font-semibold text-brand-foreground opacity-0 shadow-lg transition focus-visible:translate-y-0 focus-visible:opacity-100"
        >
          Aller au contenu
        </a>
        <aside className="sticky top-0 hidden h-screen lg:block">
          <AdminSidebar pathname={pathname} counts={sidebarCounts} email={session?.email} />
        </aside>
        <Drawer
          open={menuOpen}
          onOpenChange={setMenuOpen}
          title="Menu de l’administration"
          hideTitle
          side="left"
          widthClassName="w-[min(18rem,85vw)]"
          className="bg-[#1f2a12] text-[#dfe6d3]"
        >
          <AdminSidebar pathname={pathname} counts={sidebarCounts} email={session?.email} onNavigate={() => setMenuOpen(false)} />
        </Drawer>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-[#e6e2d8] bg-[rgba(244,242,236,0.85)] px-3.5 py-2.5 backdrop-blur-md dark:border-border dark:bg-background/85 sm:gap-3 sm:px-7 sm:py-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Ouvrir le menu de l’administration"
              aria-expanded={menuOpen}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#e6e2d8] bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:border-border lg:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <nav aria-label="Fil d’Ariane" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1 text-[13px] text-[#8a917e]">
                {crumbs.map((crumb, index) => {
                  const last = index === crumbs.length - 1;
                  return (
                    <li key={`${crumb.label}-${index}`} className={cn("flex min-w-0 items-center gap-1", !last && "hidden sm:flex")}>
                      {crumb.href && !last ? (
                        <Link href={crumb.href as Route} className="truncate hover:text-foreground hover:underline">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "font-semibold text-[#1c2113] dark:text-foreground")}>
                          {crumb.label}
                        </span>
                      )}
                      {!last ? <span aria-hidden="true">/</span> : null}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <button
              type="button"
              onClick={openPalette}
              aria-label={`Rechercher (${shortcut})`}
              aria-keyshortcuts="Meta+K Control+K"
              className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-[10px] border border-[#e6e2d8] bg-card px-2.5 text-[#8a917e] transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:border-border md:w-[min(380px,32vw)] md:px-3"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="hidden truncate text-sm md:inline">Course, coureur, page…</span>
              <kbd className="ml-auto hidden rounded-md border border-[#d6d1c4] bg-[#faf9f5] px-1.5 font-mono text-[11px] text-[#4a5140] dark:border-border dark:bg-muted dark:text-muted-foreground md:inline">
                {shortcut}
              </kbd>
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              {modes.instagramDryRun ? (
                <ModePill href="/admin/system/integrations" label="Instagram en simulation, rien n’est publié réellement">
                  Instagram : simulation
                </ModePill>
              ) : null}
              {modes.runnerMode && modes.runnerMode !== "real" ? (
                <ModePill href="/profile" label="Simulation des droits coureur active sur cette session">
                  Droits : {RUNNER_MODE_LABELS[modes.runnerMode]}
                </ModePill>
              ) : null}
            </div>
            <Link
              href={"/admin/inbox" as Route}
              aria-label={counts.total ? `À traiter : ${counts.total}` : "À traiter"}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#e6e2d8] bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:border-border"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
              </svg>
              {counts.total ? (
                <span aria-hidden="true" className="absolute -right-[5px] -top-[5px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e05252] px-[5px] font-mono text-[10.5px] font-bold text-white">
                  {counts.total}
                </span>
              ) : null}
            </Link>
          </header>
          {modes.instagramDryRun || (modes.runnerMode && modes.runnerMode !== "real") ? (
            <div className="flex flex-wrap gap-2 border-b border-[#e6e2d8] px-3.5 py-2 dark:border-border sm:hidden">
              {modes.instagramDryRun ? <ModePill href="/admin/system/integrations" label="Instagram en simulation">Instagram : simulation</ModePill> : null}
              {modes.runnerMode && modes.runnerMode !== "real" ? (
                <ModePill href="/profile" label="Simulation des droits coureur">Droits : {RUNNER_MODE_LABELS[modes.runnerMode]}</ModePill>
              ) : null}
            </div>
          ) : null}
          <main id="admin-main" tabIndex={-1} className="w-full min-w-0 max-w-[1440px] px-3.5 pb-12 pt-5 outline-none sm:px-7 sm:pt-6">
            <AdminAccessProvider value={accessToken}>{content}</AdminAccessProvider>
          </main>
        </div>
      </div>
      {accessToken ? <AdminCommandPalette accessToken={accessToken} open={paletteOpen} onOpenChange={setPaletteOpen} /> : null}
    </ToastProvider>
  );
}

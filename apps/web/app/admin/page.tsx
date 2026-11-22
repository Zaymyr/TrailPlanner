"use client";

import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "../../components/ui/button";
import { TabsList } from "../../components/ui/tabs";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import AdminGrowthSection from "./components/AdminGrowthSection";
import AdminRaceCatalogSection from "./components/AdminRaceCatalogSection";
import AdminSocialTemplatesSection from "./components/AdminSocialTemplatesSection";
import { AdminOrganizerClaimsTab } from "./_components/AdminOrganizerClaimsTab";
import { AdminOrganizerSocialProofsTab } from "./_components/AdminOrganizerSocialProofsTab";
import { AdminPartnerLinksTab } from "./_components/AdminPartnerLinksTab";
import { AdminProductsTab } from "./_components/AdminProductsTab";
import { AdminMessagingTab } from "./_components/AdminMessagingTab";
import { AdminUsersTab } from "./_components/AdminUsersTab";
import { useInboxCounts, withCount } from "./_components/useInboxCounts";
import { ADMIN_TABS, readAdminTab, readRaceParam, replaceLocationSearch, searchForTab, type AdminTabId } from "./admin-tabs";

export default function AdminPage() {
  const { t } = useI18n();
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const [activeTab, setActiveTabState] = useState<AdminTabId>("produits");
  useEffect(() => {
    setActiveTabState(readAdminTab(window.location.search));
  }, []);
  const setActiveTab = useCallback((next: string) => {
    const tab = readAdminTab(`?onglet=${next}`);
    setActiveTabState(tab);
    replaceLocationSearch(searchForTab(window.location.search, tab));
  }, []);

  const accessToken = session?.accessToken ?? null;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");
  const inboxCounts = useInboxCounts(isAdmin ? accessToken : null);

  if (sessionLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-foreground dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-muted-foreground dark:text-slate-300">{t.admin.access.checking}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-foreground dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-muted-foreground dark:text-slate-300">{t.admin.access.signIn}</p>
        <div>
          <Link href="/sign-in">
            <Button>{t.admin.access.signInCta}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-foreground dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-amber-700 dark:text-amber-200">{t.admin.access.forbidden}</p>
        <div className="flex items-center gap-3">
          <Link href="/race-planner" className="text-brand underline-offset-4 hover:underline dark:text-emerald-200">
            {t.homeHero.cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground dark:text-slate-50">{t.admin.title}</h1>
          <p className="text-sm text-muted-foreground dark:text-slate-300">{t.admin.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={"/admin/video-generator" as Route}>
            <Button variant="outline">Générateur vidéo 3D</Button>
          </Link>
          <Link href={"/admin/publications" as Route}>
            <Button variant="outline">Publications</Button>
          </Link>
          <Link href="/race-planner" className="text-brand underline-offset-4 hover:underline dark:text-emerald-200">
            {t.homeHero.cta}
          </Link>
          <Link href="/settings" className="text-brand underline-offset-4 hover:underline dark:text-emerald-200">
            {t.navigation.settings}
          </Link>
        </div>
      </div>

      <TabsList
        tabs={ADMIN_TABS.map((tab) => ({
          id: tab.id,
          label:
            tab.id === "produits" ? t.admin.products.title
            : tab.id === "utilisateurs" ? t.admin.users.title
            : tab.id === "templates" ? t.admin.socialTemplates.title
            : tab.id === "courses" ? t.admin.raceCatalog.title
            : tab.id === "partenaires" ? t.admin.partnerLinks.title
            : tab.id === "croissance" ? t.admin.growth.title
            : tab.id === "organisateurs" ? withCount(tab.label, inboxCounts.data?.organizerTotal)
            : tab.id === "messagerie" ? withCount(tab.label, inboxCounts.data ? inboxCounts.data.bug + inboxCounts.data.feedback + inboxCounts.data.raceRequests + inboxCounts.data.demoRequests : undefined)
            : tab.label,
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "produits" && <AdminProductsTab accessToken={accessToken} />}
      {activeTab === "utilisateurs" && <AdminUsersTab accessToken={accessToken} />}
      {activeTab === "messagerie" && <AdminMessagingTab accessToken={accessToken} />}
      {activeTab === "templates" && (
        <AdminSocialTemplatesSection accessToken={accessToken} t={t.admin.socialTemplates} />
      )}
      {activeTab === "courses" && <AdminRaceCatalogSection accessToken={accessToken ?? undefined} t={t.admin.raceCatalog} initialRaceId={readRaceParam(typeof window === "undefined" ? "" : window.location.search)} />}
      {activeTab === "organisateurs" && <AdminOrganizerClaimsTab accessToken={accessToken} />}
      {activeTab === "preuves" && <AdminOrganizerSocialProofsTab accessToken={accessToken} />}
      {activeTab === "partenaires" && <AdminPartnerLinksTab accessToken={accessToken} />}
      {activeTab === "croissance" && <AdminGrowthSection accessToken={accessToken ?? undefined} t={t.admin.growth} />}
    </div>
  );
}

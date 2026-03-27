"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "../../components/ui/button";
import { TabsList } from "../../components/ui/tabs";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import AdminGrowthSection from "./components/AdminGrowthSection";
import AdminRaceCatalogSection from "./components/AdminRaceCatalogSection";
import { AdminAnalyticsTab } from "./_components/AdminAnalyticsTab";
import { AdminProductsTab } from "./_components/AdminProductsTab";
import { AdminUsersTab } from "./_components/AdminUsersTab";

export default function AdminPage() {
  const { t } = useI18n();
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const [activeTab, setActiveTab] = useState("products");

  const accessToken = session?.accessToken ?? null;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  if (sessionLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.admin.access.checking}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.admin.access.signIn}</p>
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
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-amber-700 dark:text-amber-200">{t.admin.access.forbidden}</p>
        <div className="flex items-center gap-3">
          <Link href="/race-planner" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
            {t.homeHero.cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t.admin.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/race-planner" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
            {t.homeHero.cta}
          </Link>
          <Link href="/settings" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
            {t.navigation.settings}
          </Link>
        </div>
      </div>

      <TabsList
        tabs={[
          { id: "products", label: t.admin.products.title },
          { id: "users", label: t.admin.users.title },
          { id: "races", label: t.admin.raceCatalog.title },
          { id: "growth", label: t.admin.growth.title },
          { id: "analytics", label: t.admin.analytics.title },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "products" && <AdminProductsTab accessToken={accessToken} />}
      {activeTab === "users" && <AdminUsersTab accessToken={accessToken} />}
      {activeTab === "races" && <AdminRaceCatalogSection accessToken={accessToken} t={t.admin.raceCatalog} />}
      {activeTab === "growth" && <AdminGrowthSection accessToken={accessToken} t={t.admin.growth} />}
      {activeTab === "analytics" && <AdminAnalyticsTab accessToken={accessToken} />}
    </div>
  );
}

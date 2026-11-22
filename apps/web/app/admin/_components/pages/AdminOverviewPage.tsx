"use client";

import AdminGrowthSection from "../../components/AdminGrowthSection";
import { useI18n } from "../../../i18n-provider";
import { useAdminAccessToken } from "../shell/AdminAccess";
import { AdminPageHeader } from "../shell/AdminPageHeader";

/** Lot 1: the overview shows the growth section; the dashboard of the ADR (§5) replaces it in lot 2. */
export function AdminOverviewPage() {
  const accessToken = useAdminAccessToken();
  const { t } = useI18n();
  return (
    <>
      <AdminPageHeader title="Vue d’ensemble" description="Synthèse provisoire : la croissance. Le tableau de bord complet (indicateurs, à traiter, santé) arrive au lot 2." />
      <AdminGrowthSection accessToken={accessToken} t={t.admin.growth} />
    </>
  );
}

"use client";

import AdminGrowthSection from "../components/AdminGrowthSection";
import { useI18n } from "../../i18n-provider";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";

/** Analytique: the growth section (KPI, curves, revenue, funnel, organizers to follow up). */
export default function AdminAnalyticsPage() {
  const accessToken = useAdminAccessToken();
  const { t } = useI18n();
  return (
    <>
      <AdminPageHeader title="Analytique" description="Croissance, activation, revenus et organisateurs à relancer." />
      <AdminGrowthSection accessToken={accessToken} t={t.admin.growth} />
    </>
  );
}

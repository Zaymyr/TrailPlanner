"use client";

import { AdminSurveysTab } from "../../_components/AdminSurveysTab";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

export default function AdminMessagingSurveysPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader title="Questionnaires" description="Campagnes de questionnaires envoyées aux coureurs et leurs réponses." />
      <AdminSurveysTab accessToken={accessToken} />
    </>
  );
}

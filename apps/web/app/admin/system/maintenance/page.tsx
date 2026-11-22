"use client";

import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";
import { MaintenancePanel } from "../../_components/system/MaintenancePanel";
import { useSystemHealth } from "../../_components/system/system-api";

/** Maintenance (lot 3): the admin routes that had no screen, each with its explanation, confirmation and result. */
export default function AdminSystemMaintenancePage() {
  const accessToken = useAdminAccessToken();
  const health = useSystemHealth(accessToken);
  const nowMs = health.data ? Date.parse(health.data.generatedAt) : Date.now();
  return (
    <>
      <AdminPageHeader
        title="Maintenance"
        description="Relance d’une tâche planifiée, synchronisation Resend, rattrapage et nettoyage des livrets, import Betrail."
      />
      <MaintenancePanel accessToken={accessToken} tasks={health.data?.tasks ?? null} nowMs={nowMs} />
    </>
  );
}

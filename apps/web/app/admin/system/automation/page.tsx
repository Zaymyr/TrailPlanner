"use client";

import type { Route } from "next";
import Link from "next/link";

import { PublicationAutomationSettings } from "../../publications/PublicationViews";
import { usePublicationsWorkspace } from "../../publications/usePublicationsWorkspace";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";
import { ScheduledTasksCard } from "../../_components/system/SystemPanels";
import { errorMessage, useSystemHealth } from "../../_components/system/system-api";

/** Automatisations: the reel and carousel switches (former Publications « Paramètres ») and, since lot 3, the scheduled tasks. */
export default function AdminSystemAutomationPage() {
  const accessToken = useAdminAccessToken();
  const workspace = usePublicationsWorkspace(accessToken);
  const health = useSystemHealth(accessToken);
  const nowMs = health.data ? Date.parse(health.data.generatedAt) : Date.now();
  return (
    <>
      <AdminPageHeader
        title="Automatisations"
        description="Tâches planifiées (dernier passage, échecs), reels et carrousels automatiques : rythme, heure de publication, séries."
        actions={
          <Link href={"/admin/system/integrations" as Route} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
            Compte Instagram →
          </Link>
        }
      />
      <div className="space-y-6">
        <ScheduledTasksCard
          health={health.data}
          loading={health.isLoading}
          error={health.isError ? errorMessage(health.error, "La santé des systèmes n’a pas pu être lue.") : null}
          onRetry={health.refetch}
          nowMs={nowMs}
        />
        <PublicationAutomationSettings workspace={workspace} />
      </div>
    </>
  );
}

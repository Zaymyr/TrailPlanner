"use client";

import { PublicationsAgenda } from "../publications/PublicationViews";
import { usePublicationsWorkspace } from "../publications/usePublicationsWorkspace";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";

/** Calendrier: the former Publications « Agenda » tab (à surveiller + calendar). */
export default function AdminContentCalendarPage() {
  const workspace = usePublicationsWorkspace(useAdminAccessToken());
  return (
    <>
      <AdminPageHeader title="Calendrier" description="Rendus en cours, échecs, brouillons à relire et publications des prochains jours." />
      <PublicationsAgenda workspace={workspace} />
    </>
  );
}

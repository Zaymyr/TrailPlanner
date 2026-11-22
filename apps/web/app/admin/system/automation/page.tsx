"use client";

import type { Route } from "next";
import Link from "next/link";

import { PublicationAutomationSettings } from "../../publications/PublicationViews";
import { usePublicationsWorkspace } from "../../publications/usePublicationsWorkspace";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

/** Automatisations: the reel and carousel switches of the former Publications « Paramètres » tab. */
export default function AdminSystemAutomationPage() {
  const workspace = usePublicationsWorkspace(useAdminAccessToken());
  return (
    <>
      <AdminPageHeader
        title="Automatisations"
        description="Reels et carrousels automatiques : rythme, heure de publication, séries."
        actions={
          <Link href={"/admin/system/integrations" as Route} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
            Compte Instagram →
          </Link>
        }
      />
      <PublicationAutomationSettings workspace={workspace} />
    </>
  );
}

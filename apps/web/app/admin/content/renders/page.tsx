"use client";

import { RendersPanel } from "../../publications/PublicationViews";
import { usePublicationsWorkspace } from "../../publications/usePublicationsWorkspace";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

/** Rendus (provisional): the reel and carousel render lists of the last 24 h; one queue in lot 6. */
export default function AdminContentRendersPage() {
  const workspace = usePublicationsWorkspace(useAdminAccessToken());
  return (
    <>
      <AdminPageHeader title="Rendus" description="Rendus de reels et de carrousels des dernières 24 h. Provisoire : une file unique (studio compris) arrive au lot 6." />
      <RendersPanel workspace={workspace} />
    </>
  );
}

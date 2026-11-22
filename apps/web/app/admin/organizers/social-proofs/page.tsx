"use client";

import { AdminOrganizerSocialProofsTab } from "../../_components/AdminOrganizerSocialProofsTab";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

export default function AdminOrganizerSocialProofsPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader title="Preuves sociales" description="Témoignages et chiffres publiés sur la page Organisateurs." />
      <AdminOrganizerSocialProofsTab accessToken={accessToken} />
    </>
  );
}

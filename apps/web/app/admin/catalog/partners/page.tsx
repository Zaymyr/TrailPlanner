"use client";

import { AdminPartnerLinksTab } from "../../_components/AdminPartnerLinksTab";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

export default function AdminCatalogPartnersPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader title="Liens partenaires" description="Liens Booking et Decathlon affichés aux coureurs." />
      <AdminPartnerLinksTab accessToken={accessToken} />
    </>
  );
}

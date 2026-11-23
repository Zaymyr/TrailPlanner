"use client";

import { AdminProductsTab } from "../../_components/AdminProductsTab";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

export default function AdminCatalogProductsPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader title="Produits nutrition" description="Import, mise en ligne, brouillons et archives du catalogue produits." />
      <AdminProductsTab accessToken={accessToken} />
    </>
  );
}

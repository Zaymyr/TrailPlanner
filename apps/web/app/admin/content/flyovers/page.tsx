"use client";

import { FlyoverOrdersCard } from "../../publications/FlyoverOrdersCard";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

export default function AdminContentFlyoversPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader title="Vidéos de survol" description="Commandes des organisateurs : paiement, génération, livraison." />
      <FlyoverOrdersCard accessToken={accessToken} />
    </>
  );
}
